import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import { googleEventToBlock } from "../lib/calendar-google-blocks.ts";

const tz = "Australia/Adelaide";
const ev = (o) => ({ id: "e1", summary: "Sample external event", starts_at: null, ends_at: null, all_day_start: null, all_day_end: null, event_status: "confirmed", ...o });

test("Google events become labelled calendar blocks", () => {
  const timed = googleEventToBlock(ev({ starts_at: "2026-11-20T00:00:00Z", ends_at: "2026-11-20T02:00:00Z" }), tz);
  assert.deepEqual([timed.startsAt, timed.endsAt, timed.reason, timed.vehicleId, timed.crewId], ["2026-11-20T00:00:00.000Z", "2026-11-20T02:00:00.000Z", "Sample external event", null, null]);
  assert.equal(timed.allDay, false);
  assert.equal(timed.source, "google");
  const open = googleEventToBlock(ev({ starts_at: "2026-11-20T00:00:00Z" }), tz);
  assert.equal(open.endsAt, "2026-11-20T01:00:00.000Z");
  assert.match(open.reason, /no finish time/);
  assert.match(googleEventToBlock(ev({ starts_at: "2026-11-20T00:00:00Z", ends_at: "2026-11-20T01:00:00Z", event_status: "tentative", summary: null }), tz).reason, /Busy.*tentative/);
});

test("all-day events span Adelaide midnight to midnight, DST included", () => {
  const day = googleEventToBlock(ev({ all_day_start: "2026-11-20", all_day_end: "2026-11-21" }), tz);
  assert.deepEqual([day.startsAt, day.endsAt], ["2026-11-19T13:30:00.000Z", "2026-11-20T13:30:00.000Z"]);
  assert.equal(day.allDay, true);
  assert.equal(day.source, "google");
  assert.equal(day.reason, "Sample external event");
  const dst = googleEventToBlock(ev({ all_day_start: "2026-04-05", all_day_end: "2026-04-06" }), tz); // 25-hour day
  assert.equal((Date.parse(dst.endsAt) - Date.parse(dst.startsAt)) / 3_600_000, 25);
});

test("cancelled and unplaceable events are not shown", () => {
  assert.equal(googleEventToBlock(ev({ starts_at: "2026-11-20T00:00:00Z", ends_at: "2026-11-20T01:00:00Z", event_status: "cancelled" }), tz), null);
  assert.equal(googleEventToBlock(ev({}), tz), null);
  assert.equal(googleEventToBlock(ev({ starts_at: "2026-11-20T02:00:00Z", ends_at: "2026-11-20T01:00:00Z" }), tz), null);
});

const require = createRequire(import.meta.url);
function cron({ secret = "s3cret", google = true, pending = ["b1", "b2"], importError } = {}) {
  const calls = [];
  const source = readFileSync(new URL("../app/api/cron/google-sync/route.ts", import.meta.url), "utf8");
  const out = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const tidyCalls = [];
  const chain = { select: () => chain, in: () => chain, order: () => chain, limit: async () => ({ data: pending.map((id) => ({ id })), error: null }),
    update: (patch) => { tidyCalls.push(patch); return chain; }, eq: () => chain, is: () => chain, then: (resolve) => resolve({ data: [{ id: "x1" }, { id: "x2" }, { id: "x3" }], error: null }) };
  const exports = {};
  vm.runInNewContext(out, { exports, console: { error() {} }, Date, Number, String, Array, Object, Promise, require: (id) => {
    if (id === "next/server") return { NextResponse: { json: (body, init = {}) => ({ body, status: init.status ?? 200 }) } };
    if (id.includes("lib/calendar-sync.ts")) return { SYNCABLE_STATUSES: ["confirmed", "assigned", "in_progress", "completed", "cancelled"] };
    if (id.includes("config.ts")) return { cronConfig: { isConfigured: () => Boolean(secret), secret: () => secret }, supabaseConfig: { isConfigured: () => true }, googleCalendarConfig: { isConfigured: () => google } };
    if (id.includes("lib/server/supabase.ts")) return { getSupabaseAdmin: () => ({ from: () => chain }) };
    if (id.includes("google-calendar-import")) return { importGoogleCalendarRange: async (a, b) => { calls.push(["import", a, b]); if (importError) throw importError; return 3; } };
    if (id.includes("google-calendar.ts")) return { reconcileBookingCalendar: async (bid) => { calls.push(["push", bid]); } };
    return require(id);
  } });
  return { calls, tidyCalls, get: (auth) => exports.GET({ headers: new Headers(auth ? { authorization: auth } : {}) }) };
}

test("sync cron requires the cron secret and does nothing otherwise", async () => {
  for (const auth of [undefined, "Bearer wrong", "s3cret"]) {
    const h = cron();
    assert.equal((await h.get(auth)).status, 401);
    assert.equal(h.calls.length, 0);
  }
  assert.equal((await cron({ secret: "" }).get("Bearer ")).status, 503);
  assert.equal((await cron({ google: false }).get("Bearer s3cret")).status, 503);
});

test("sync cron imports Google events then pushes pending bookings", async () => {
  const h = cron();
  const response = await h.get("Bearer s3cret");
  assert.equal(response.status, 200);
  assert.deepEqual({ ...response.body }, { imported: 3, importError: null, pushed: 2, pushFailed: 0, tidied: 3 });
  assert.deepEqual({ ...h.tidyCalls[0] }, { calendar_sync_status: "not_applicable", calendar_sync_error: null }, "expired holds are tidied in the database only");
  assert.deepEqual(h.calls.map((c) => c[0]), ["import", "push", "push"]);
  const [, from, to] = h.calls[0];
  assert.ok(Date.parse(to) - Date.parse(from) > 100 * 86_400_000, "imports roughly the next 120 days");
});

test("a Google import failure does not stop the booking push", async () => {
  const h = cron({ importError: Object.assign(new Error("x"), { code: 503 }) });
  const response = await h.get("Bearer s3cret");
  assert.equal(response.status, 207);
  assert.equal(response.body.pushed, 2);
  assert.equal(response.body.importError, "503");
});

test("vercel schedules the sync every 15 minutes", () => {
  const crons = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8")).crons;
  assert.ok(crons.some((c) => c.path === "/api/cron/google-sync" && c.schedule === "*/15 * * * *"));
});
