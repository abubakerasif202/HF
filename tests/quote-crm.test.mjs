import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import * as datesLib from "../lib/admin/dates.ts";
import * as quoteLib from "../lib/admin/quote-crm.ts";
import * as availabilityLib from "../lib/booking/availability.ts";
import * as vehiclesLib from "../lib/booking/vehicles.ts";
import * as packageLib from "../lib/booking/package-request.ts";
import * as siteData from "../lib/site-data.ts";

const require = createRequire(import.meta.url);

/** Loads a TS module into a VM with collaborators replaced by stubs (same technique as the other API tests). */
function load(path, stubs) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(output, {
    exports, console: { error() {} }, URL, Date, Set, Map, Object, JSON, Promise, Array, Number, String, Intl, Uint8Array, Error, RegExp, Math, Buffer,
    require: (id) => {
      for (const [needle, value] of Object.entries(stubs)) if (id.includes(needle)) return value;
      if (id === "server-only") return {};
      return require(id);
    },
  });
  return exports;
}

class NextResponse {
  constructor(body, init = {}) { this.body = body; this.status = init.status ?? 200; this.headers = init.headers ?? {}; }
  static json(body, init = {}) { return new NextResponse(body, init); }
}

const unauth = { status: "unauthenticated" };
const forbidden = { status: "forbidden" };
const owner = { status: "authorized", session: { userId: "owner-1", email: "admin@hfremovalsadelaide.com.au" } };
const ID = "00000000-0000-4000-8000-000000000001";
const ID2 = "00000000-0000-4000-8000-000000000002";
const ORIGIN = "https://hf.test";

/** Recording query builder: every chained method is logged; awaiting resolves to handler(record). */
function makeSupabase(handler) {
  const calls = [];
  const from = (table) => {
    const record = { table, ops: [] };
    const proxy = new Proxy(function () {}, {
      get: (_t, prop) => {
        if (prop === "then") {
          return (resolve, reject) => {
            calls.push(record);
            try { resolve(handler(record)); } catch (error) { reject(error); }
          };
        }
        return (...args) => { record.ops.push([prop, args]); return proxy; };
      },
    });
    return proxy;
  };
  return { calls, client: { from } };
}

const has = (record, method, predicate = () => true) => record.ops.some(([name, args]) => name === method && predicate(args));
const opArgs = (record, method) => record.ops.find(([name]) => name === method)?.[1];

function guardAndAuth(auth, supabase) {
  const stubs = {
    "next/server": { NextResponse },
    "supabase-ssr": { getAdminAuthState: async () => auth },
    "/supabase.ts": { getSupabaseAdmin: () => supabase.client },
    "config.ts": { supabaseConfig: { isConfigured: () => true } },
  };
  const guard = load("../lib/server/admin-api-guard.ts", stubs);
  const repo = load("../lib/server/quote-crm-repo.ts", { ...stubs, "admin/dates": datesLib, "quote-crm.ts": quoteLib });
  return { stubs, guard, repo };
}

function req(method, path, body, { origin = ORIGIN } = {}) {
  const headers = new Headers({ "content-type": "application/json" });
  if (origin) headers.set("origin", origin);
  return new Request(`${ORIGIN}${path}`, { method, headers, body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body) });
}

// ---------------------------------------------------------------------------
// Pure rules
// ---------------------------------------------------------------------------

test("migration 0021 adds the CRM columns additively and keeps service_role-only access", () => {
  const path = new URL("../supabase/migrations/0021_quote_crm_fields.sql", import.meta.url);
  assert.ok(existsSync(path));
  const sql = readFileSync(path, "utf8");
  for (const column of ["notes text", "follow_up_at timestamptz", "status_changed_at timestamptz default now()", "first_response_at timestamptz", "quoted_amount_cents integer", "lost_reason text", "booking_id uuid references public.bookings(id) on delete set null"]) {
    assert.ok(sql.includes(column), `missing ${column}`);
  }
  assert.match(sql, /quoted_amount_cents >= 0/);
  assert.match(sql, /create index if not exists quote_requests_status_follow_up_idx on public\.quote_requests \(quote_status, follow_up_at\)/);
  assert.doesNotMatch(sql, /\bdrop\s|\bgrant\s|\bdelete\s+from\b|\btruncate\b/i);
});

test("business minutes only count the open window in Adelaide time", () => {
  // 2026-03-10 is ACDT (+10:30). 11:00 -> 15:30 local on one day = 4.5 business hours.
  const created = new Date("2026-03-10T00:30:00Z");
  const now = new Date("2026-03-10T05:00:00Z");
  assert.equal(quoteLib.businessMinutesBetween(created, now, "08:00", "18:00"), 270);
  // 17:00 Monday -> 09:00 Tuesday local = 1h Monday + 1h Tuesday.
  assert.equal(quoteLib.businessMinutesBetween(new Date("2026-03-09T06:30:00Z"), new Date("2026-03-09T22:30:00Z"), "08:00", "18:00"), 120);
  assert.equal(quoteLib.businessMinutesBetween(now, created, "08:00", "18:00"), 0);
});

test("response badge: ok, amber after 4 business hours, red after 24 hours, replied", () => {
  const now = new Date("2026-03-10T05:00:00Z"); // 15:30 Tue Adelaide
  const base = { status: "new", firstResponseAt: null, now, openHm: "08:00", closeHm: "18:00" };
  const fresh = quoteLib.responseBadge({ ...base, createdAt: "2026-03-10T03:00:00Z" });
  assert.deepEqual([fresh.level, fresh.age, fresh.label], ["ok", "2 h", "Waiting 2 h"]);
  assert.equal(quoteLib.responseBadge({ ...base, createdAt: "2026-03-10T00:30:00Z" }).level, "amber");
  // Overnight wait is wall-clock long but only 2 business hours: still ok.
  assert.equal(quoteLib.responseBadge({ ...base, now: new Date("2026-03-09T22:30:00Z"), createdAt: "2026-03-09T06:30:00Z" }).level, "ok");
  const stale = quoteLib.responseBadge({ ...base, createdAt: "2026-03-07T05:00:00Z" });
  assert.deepEqual([stale.level, stale.age], ["red", "3 d"]);
  const replied = quoteLib.responseBadge({ ...base, status: "quote_sent", createdAt: "2026-03-10T00:00:00Z", firstResponseAt: "2026-03-10T03:00:00Z" });
  assert.deepEqual([replied.level, replied.label], ["none", "Replied in 3 h"]);
  assert.equal(quoteLib.responseBadge({ ...base, status: "lost", createdAt: "2026-03-01T00:00:00Z" }).level, "none");
});

test("follow-up dates are stored at 9am Adelaide and classified by Adelaide day", () => {
  const now = new Date("2026-03-10T05:00:00Z");
  assert.equal(quoteLib.followUpInstant("2026-03-10"), "2026-03-09T22:30:00.000Z");
  assert.equal(quoteLib.followUpYmd("2026-03-09T22:30:00.000Z"), "2026-03-10");
  assert.equal(quoteLib.followUpState(quoteLib.followUpInstant("2026-03-09"), "follow_up", now), "overdue");
  assert.equal(quoteLib.followUpState(quoteLib.followUpInstant("2026-03-10"), "quote_sent", now), "due");
  assert.equal(quoteLib.followUpState(quoteLib.followUpInstant("2026-03-11"), "new", now), "upcoming");
  assert.equal(quoteLib.followUpState(quoteLib.followUpInstant("2026-03-09"), "booked", now), "none");
  assert.equal(quoteLib.followUpState(null, "new", now), "none");
  assert.equal(quoteLib.isValidYmd("2026-02-30"), false);
  assert.equal(quoteLib.isValidYmd("2026-02-28"), true);
  const summary = quoteLib.summariseQuotes([
    { quote_status: "new", follow_up_at: null },
    { quote_status: "follow_up", follow_up_at: quoteLib.followUpInstant("2026-03-08") },
    { quote_status: "quote_sent", follow_up_at: quoteLib.followUpInstant("2026-03-10") },
    { quote_status: "lost", follow_up_at: quoteLib.followUpInstant("2026-03-01") },
  ], now);
  assert.deepEqual([summary.counts.new, summary.counts.lost, summary.due, summary.overdue], [1, 1, 2, 1]);
});

test("quoted amounts parse to integer cents and reject junk", () => {
  assert.equal(quoteLib.parseDollarsToCents("850"), 85000);
  assert.equal(quoteLib.parseDollarsToCents("$1,234.5"), 123450);
  assert.equal(quoteLib.parseDollarsToCents("  "), null);
  for (const bad of ["abc", "-5", "1.234", "1e3", "999999999"]) assert.equal(quoteLib.parseDollarsToCents(bad), "invalid", bad);
  assert.equal(quoteLib.formatCentsAsDollars(85050), "850.50");
});

test("first_response_at is stamped once, when the status first leaves new", () => {
  const now = "2026-03-10T05:00:00.000Z";
  const fromNew = quoteLib.statusChangeFields({ quote_status: "new", first_response_at: null }, "quote_sent", now);
  assert.deepEqual(fromNew, { quote_status: "quote_sent", status_changed_at: now, lost_reason: null, first_response_at: now });
  assert.equal("first_response_at" in quoteLib.statusChangeFields({ quote_status: "quote_sent", first_response_at: null }, "follow_up", now), false);
  assert.equal("first_response_at" in quoteLib.statusChangeFields({ quote_status: "new", first_response_at: "2026-03-01T00:00:00Z" }, "lost", now), false);
  assert.equal(quoteLib.statusChangeFields({ quote_status: "follow_up", first_response_at: now }, "lost", now, "price").lost_reason, "price");
  assert.equal(quoteLib.statusChangeFields({ quote_status: "lost", first_response_at: now }, "new", now, "price").lost_reason, null);
});

test("reply template is plain text built from the enquiry and never states a price", () => {
  const text = quoteLib.buildReplyTemplate({ name: "Sam Citizen", moving_from: "Glenelg", moving_to: "Mawson Lakes", preferred_moving_date: "2026-03-14" });
  assert.match(text, /^Hi Sam,/);
  assert.match(text, /move from Glenelg to Mawson Lakes on Saturday 14 March 2026\./);
  assert.match(text, /HF Removals Adelaide/);
  assert.doesNotMatch(text, /\$\d/);
  const bare = quoteLib.buildReplyTemplate({});
  assert.match(bare, /^Hi,/);
  assert.doesNotMatch(bare, /undefined/);
});

// ---------------------------------------------------------------------------
// GET / PATCH /api/admin/quotes
// ---------------------------------------------------------------------------

function quotesHarness({ auth = owner, handler = () => ({ data: [], error: null, count: 0 }) } = {}) {
  const supabase = makeSupabase(handler);
  const { stubs, repo } = guardAndAuth(auth, supabase);
  const route = load("../app/api/admin/quotes/route.ts", { ...stubs, "quote-crm-repo": repo, "admin/dates": datesLib, "quote-crm.ts": quoteLib });
  return { calls: supabase.calls, route };
}

test("quote list and update are owner-only (401 / 403) and never cached", async () => {
  for (const [auth, status] of [[unauth, 401], [forbidden, 403]]) {
    const h = quotesHarness({ auth });
    const list = await h.route.GET(req("GET", "/api/admin/quotes"));
    const patch = await h.route.PATCH(req("PATCH", "/api/admin/quotes", { id: ID, notes: "x" }));
    assert.equal(list.status, status);
    assert.equal(patch.status, status);
    assert.match(list.headers["Cache-Control"], /no-store/);
    assert.equal(h.calls.length, 0, "no query for an unauthorised caller");
  }
});

test("quote list validates tab, sort and status, and filters follow-ups by Adelaide day", async () => {
  const h = quotesHarness();
  for (const query of ["tab=bogus", "sort=sideways", "status=bogus"]) {
    assert.equal((await h.route.GET(req("GET", `/api/admin/quotes?${query}`))).status, 400, query);
  }
  assert.equal(h.calls.length, 0);

  const needsReply = quotesHarness();
  assert.equal((await needsReply.route.GET(req("GET", "/api/admin/quotes?tab=needs_reply&sort=oldest"))).status, 200);
  const list = needsReply.calls.find((record) => has(record, "range"));
  assert.deepEqual(opArgs(list, "eq"), ["quote_status", "new"]);
  assert.equal(opArgs(list, "order")[1].ascending, true);

  const overdue = quotesHarness();
  await overdue.route.GET(req("GET", "/api/admin/quotes?tab=overdue"));
  const overdueQuery = overdue.calls.find((record) => has(record, "range"));
  const today = datesLib.adelaideDay(0);
  assert.deepEqual(opArgs(overdueQuery, "lt"), ["follow_up_at", today.start]);
  assert.ok(has(overdueQuery, "in", ([column, values]) => column === "quote_status" && values.join() === "new,quote_sent,follow_up"));

  const due = quotesHarness();
  await due.route.GET(req("GET", "/api/admin/quotes?tab=due"));
  assert.deepEqual(opArgs(due.calls.find((record) => has(record, "range")), "lt"), ["follow_up_at", today.end]);
});

test("quote list returns rows, the total and a status/follow-up summary", async () => {
  const rows = [{ id: ID, quote_status: "new", follow_up_at: null }];
  const h = quotesHarness({ handler: (record) => (has(record, "range") ? { data: rows, error: null, count: 7 } : { data: rows, error: null }) });
  const response = await h.route.GET(req("GET", "/api/admin/quotes"));
  assert.equal(response.status, 200);
  assert.equal(response.body.total, 7);
  assert.equal(response.body.data.length, 1);
  assert.equal(response.body.summary.counts.new, 1);
});

test("quote PATCH rejects bad origin, bad JSON and every invalid field before touching data", async () => {
  const h = quotesHarness();
  assert.equal((await h.route.PATCH(req("PATCH", "/api/admin/quotes", { id: ID, notes: "x" }, { origin: "https://evil.test" }))).status, 403);
  assert.equal((await h.route.PATCH(req("PATCH", "/api/admin/quotes", { id: ID, notes: "x" }, { origin: "" }))).status, 403);
  assert.equal((await h.route.PATCH(req("PATCH", "/api/admin/quotes", "[1]"))).status, 400);
  const bad = [
    { id: "nope", notes: "x" },
    { id: ID },
    { id: ID, quote_status: "bogus" },
    { id: ID, notes: "x".repeat(4001) },
    { id: ID, follow_up_at: "2026-02-30" },
    { id: ID, follow_up_at: "tomorrow" },
    { id: ID, quoted_amount_cents: -1 },
    { id: ID, quoted_amount_cents: 12.5 },
    { id: ID, lost_reason: "boredom" },
    { id: ID, notes: "x", extra: true },
  ];
  for (const body of bad) {
    const response = await h.route.PATCH(req("PATCH", "/api/admin/quotes", body));
    assert.equal(response.status, 400, JSON.stringify(body));
  }
  assert.equal(h.calls.length, 0, "validation happens before any query");
});

test("quote PATCH returns 404 for an unknown enquiry and 400 for a stray lost reason", async () => {
  const missing = quotesHarness({ handler: () => ({ data: null, error: null }) });
  assert.equal((await missing.route.PATCH(req("PATCH", "/api/admin/quotes", { id: ID, notes: "x" }))).status, 404);

  const stray = quotesHarness({ handler: () => ({ data: { quote_status: "new", first_response_at: null }, error: null }) });
  const response = await stray.route.PATCH(req("PATCH", "/api/admin/quotes", { id: ID, lost_reason: "price" }));
  assert.equal(response.status, 400);
  assert.equal(stray.calls.filter((record) => has(record, "update")).length, 0);
});

test("quote PATCH saves notes, follow-up date and quoted amount and stamps first response", async () => {
  const current = { quote_status: "new", first_response_at: null };
  const updated = { id: ID, quote_status: "quote_sent" };
  const h = quotesHarness({ handler: (record) => (has(record, "update") ? { data: updated, error: null } : { data: current, error: null }) });
  const response = await h.route.PATCH(req("PATCH", "/api/admin/quotes", {
    id: ID, quote_status: "quote_sent", notes: "  Called, will send quote  ", follow_up_at: "2026-03-10", quoted_amount_cents: 85000,
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data, updated);
  assert.match(response.headers["Cache-Control"], /no-store/);
  const update = opArgs(h.calls.find((record) => has(record, "update")), "update")[0];
  assert.equal(update.quote_status, "quote_sent");
  assert.equal(update.notes, "Called, will send quote");
  assert.equal(update.follow_up_at, "2026-03-09T22:30:00.000Z");
  assert.equal(update.quoted_amount_cents, 85000);
  assert.equal(update.lost_reason, null);
  assert.ok(update.first_response_at && update.status_changed_at);
});

test("quote PATCH keeps first_response_at on later moves, clears fields and records lost reasons", async () => {
  const current = { quote_status: "quote_sent", first_response_at: "2026-03-01T00:00:00Z" };
  const h = quotesHarness({ handler: (record) => (has(record, "update") ? { data: { id: ID }, error: null } : { data: current, error: null }) });
  await h.route.PATCH(req("PATCH", "/api/admin/quotes", { id: ID, quote_status: "lost", lost_reason: "price", notes: "", follow_up_at: null, quoted_amount_cents: null }));
  const update = opArgs(h.calls.find((record) => has(record, "update")), "update")[0];
  assert.equal(update.quote_status, "lost");
  assert.equal(update.lost_reason, "price");
  assert.equal("first_response_at" in update, false);
  assert.equal(update.notes, null);
  assert.equal(update.follow_up_at, null);
  assert.equal(update.quoted_amount_cents, null);

  // Same status again is not a status change: nothing but the requested field is written.
  const same = quotesHarness({ handler: (record) => (has(record, "update") ? { data: { id: ID }, error: null } : { data: current, error: null }) });
  await same.route.PATCH(req("PATCH", "/api/admin/quotes", { id: ID, quote_status: "quote_sent", notes: "n" }));
  assert.deepEqual(Object.keys(opArgs(same.calls.find((record) => has(record, "update")), "update")[0]), ["notes"]);
});

test("quote PATCH reports a database failure without leaking details", async () => {
  const h = quotesHarness({ handler: (record) => (has(record, "update") ? { data: null, error: { code: "42703", message: "column missing" } } : { data: { quote_status: "new", first_response_at: null }, error: null }) });
  const response = await h.route.PATCH(req("PATCH", "/api/admin/quotes", { id: ID, notes: "x" }));
  assert.equal(response.status, 503);
  assert.doesNotMatch(JSON.stringify(response.body), /column missing/);
});

// ---------------------------------------------------------------------------
// POST /api/admin/quotes/bulk
// ---------------------------------------------------------------------------

function bulkHarness({ auth = owner, handler = () => ({ data: [], error: null }) } = {}) {
  const supabase = makeSupabase(handler);
  const { stubs, guard, repo } = guardAndAuth(auth, supabase);
  const route = load("../app/api/admin/quotes/bulk/route.ts", { ...stubs, "admin-api-guard": guard, "quote-crm-repo": repo, "quote-crm.ts": quoteLib });
  return { calls: supabase.calls, route };
}

test("bulk status route is owner-only, same-origin and validates before writing", async () => {
  for (const [auth, status] of [[unauth, 401], [forbidden, 403]]) {
    const h = bulkHarness({ auth });
    assert.equal((await h.route.POST(req("POST", "/api/admin/quotes/bulk", { ids: [ID], quote_status: "lost" }))).status, status);
    assert.equal(h.calls.length, 0);
  }
  const h = bulkHarness();
  assert.equal((await h.route.POST(req("POST", "/api/admin/quotes/bulk", { ids: [ID], quote_status: "lost" }, { origin: "https://evil.test" }))).status, 403);
  const tooMany = Array.from({ length: 101 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`);
  const bad = [
    { ids: [], quote_status: "lost" },
    { ids: tooMany, quote_status: "lost" },
    { ids: [ID, ID], quote_status: "lost" },
    { ids: ["nope"], quote_status: "lost" },
    { ids: [ID], quote_status: "bogus" },
    { ids: [ID], quote_status: "booked", lost_reason: "price" },
    { ids: [ID], quote_status: "lost", extra: 1 },
  ];
  for (const body of bad) assert.equal((await h.route.POST(req("POST", "/api/admin/quotes/bulk", body))).status, 400, JSON.stringify(body));
  assert.equal((await h.route.POST(req("POST", "/api/admin/quotes/bulk", "not json"))).status, 400);
  assert.equal(h.calls.length, 0);
});

test("bulk status route updates the selected enquiries and stamps first responses afterwards", async () => {
  const handler = (record) => {
    if (has(record, "update") && has(record, "neq")) return { data: [{ id: ID }, { id: ID2 }], error: null };
    if (has(record, "update")) return { data: null, error: null };
    return { data: [{ id: ID }], error: null };
  };
  const h = bulkHarness({ handler });
  const response = await h.route.POST(req("POST", "/api/admin/quotes/bulk", { ids: [ID, ID2], quote_status: "lost", lost_reason: "no_response" }));
  assert.equal(response.status, 200);
  assert.deepEqual([response.body.updated, response.body.requested], [2, 2]);
  assert.match(response.headers["Cache-Control"], /no-store/);
  const statusUpdate = h.calls.find((record) => has(record, "update") && has(record, "neq"));
  const patch = opArgs(statusUpdate, "update")[0];
  assert.equal(patch.quote_status, "lost");
  assert.equal(patch.lost_reason, "no_response");
  assert.deepEqual(opArgs(statusUpdate, "in"), ["id", [ID, ID2]]);
  assert.deepEqual(opArgs(statusUpdate, "neq"), ["quote_status", "lost"]);
  const stamp = h.calls.filter((record) => has(record, "update") && !has(record, "neq")).at(-1);
  assert.ok(opArgs(stamp, "update")[0].first_response_at);
  assert.deepEqual(opArgs(stamp, "in"), ["id", [ID]], "only rows that were new and actually changed are stamped");
});

test("bulk status route surfaces a failed update as 503", async () => {
  const h = bulkHarness({ handler: (record) => (has(record, "update") ? { data: null, error: { code: "x" } } : { data: [], error: null }) });
  assert.equal((await h.route.POST(req("POST", "/api/admin/quotes/bulk", { ids: [ID], quote_status: "follow_up" }))).status, 503);
});

// ---------------------------------------------------------------------------
// POST /api/admin/quotes/convert
// ---------------------------------------------------------------------------

const SETTINGS = {
  timezone: "Australia/Adelaide", businessOpenTime: "08:00", businessCloseTime: "18:00", bookingHoldMinutes: 30,
  minBookingLeadHours: 2, maxBookingHorizonDays: 365, defaultEstimatedDurationMinutes: 240, minimumBookingMinutes: 180,
};
const address = { addressLine: "1 Jetty Rd", suburb: "Glenelg", state: "SA", postcode: "5045" };

function convertHarness({ auth = owner, quote = { id: ID, quote_status: "new", first_response_at: null, booking_id: null }, service = { id: "svc-1", bookable: true }, busy = [], duplicates = 0, hold, linkResult } = {}) {
  const holds = [];
  const repoCalls = { customers: [], numbers: 0 };
  const supabase = makeSupabase((record) => {
    if (record.table === "quote_requests" && has(record, "update")) return linkResult ?? { data: { id: ID, quote_status: "booked", booking_id: "booking-1" }, error: null };
    if (record.table === "quote_requests") return { data: quote, error: null };
    if (record.table === "services") return { data: service, error: null };
    if (record.table === "bookings") return { count: duplicates, data: null, error: null };
    return { data: null, error: null };
  });
  class SlotUnavailableError extends Error {}
  const bookingRepo = {
    SlotUnavailableError,
    getBusinessSettings: async () => SETTINGS,
    getActiveVehicles: async () => [{ id: "veh-1", vehicleType: "HR 16 ton" }],
    getBusyIntervals: async () => busy,
    getBlockedIntervals: async () => [],
    findOrCreateCustomer: async (input) => { repoCalls.customers.push(input); return "cust-1"; },
    generateBookingNumber: async () => { repoCalls.numbers += 1; return "HF-1001"; },
    createBookingHold: async (input) => {
      if (hold) return hold(input);
      holds.push(input);
      return { id: "booking-1", booking_number: "HF-1001", hold_expires_at: "2099-01-01T00:00:00Z" };
    },
  };
  const { stubs, guard, repo } = guardAndAuth(auth, supabase);
  const route = load("../app/api/admin/quotes/convert/route.ts", {
    ...stubs,
    "admin-api-guard": guard,
    "quote-crm-repo": repo,
    "booking-repo": bookingRepo,
    "availability.ts": availabilityLib,
    "vehicles.ts": vehiclesLib,
    "package-request.ts": packageLib,
    "site-data.ts": siteData,
    "quote-crm.ts": quoteLib,
  });
  return { route, holds, repoCalls, calls: supabase.calls, SlotUnavailableError };
}

const startsAt = () => new Date(Date.now() + 10 * 86_400_000).toISOString();
const convertBody = (over = {}) => ({
  quoteId: ID, serviceSlug: "residential-removals", packageId: "3-men", startsAt: startsAt(),
  pickupAddress: address, destinationAddress: { ...address, suburb: "Mawson Lakes", postcode: "5095" },
  customer: { name: "Sam Citizen", email: "Sam@Example.com", phone: "0400 000 000" }, ...over,
});

test("convert route is owner-only, same-origin and validates before any lookup", async () => {
  for (const [auth, status] of [[unauth, 401], [forbidden, 403]]) {
    const h = convertHarness({ auth });
    assert.equal((await h.route.POST(req("POST", "/api/admin/quotes/convert", convertBody()))).status, status);
    assert.equal(h.calls.length, 0);
  }
  const h = convertHarness();
  assert.equal((await h.route.POST(req("POST", "/api/admin/quotes/convert", convertBody(), { origin: "https://evil.test" }))).status, 403);
  const bad = [
    convertBody({ quoteId: "nope" }),
    convertBody({ startsAt: "tomorrow" }),
    convertBody({ packageId: "" }),
    convertBody({ customer: { name: "", email: "a@b.co" } }),
    convertBody({ customer: { name: "Sam", email: "not-an-email" } }),
    convertBody({ pickupAddress: { ...address, suburb: "" } }),
    convertBody({ estimatedDurationMinutes: 5 }),
    { ...convertBody(), extra: true },
  ];
  for (const body of bad) assert.equal((await h.route.POST(req("POST", "/api/admin/quotes/convert", body))).status, 400, JSON.stringify(body).slice(0, 80));
  assert.equal(h.calls.length, 0);
});

test("convert route refuses unknown quotes, already-linked quotes, bad packages and unbookable services", async () => {
  assert.equal((await convertHarness({ quote: null }).route.POST(req("POST", "/api/admin/quotes/convert", convertBody()))).status, 404);
  const linked = await convertHarness({ quote: { id: ID, quote_status: "booked", first_response_at: null, booking_id: "b" } }).route.POST(req("POST", "/api/admin/quotes/convert", convertBody()));
  assert.equal(linked.status, 409);
  assert.equal(linked.body.code, "already_converted");
  const pkg = convertHarness();
  assert.equal((await pkg.route.POST(req("POST", "/api/admin/quotes/convert", convertBody({ packageId: "no-such-package" })))).status, 400);
  assert.equal((await convertHarness({ service: { id: "s", bookable: false } }).route.POST(req("POST", "/api/admin/quotes/convert", convertBody()))).status, 400);
  assert.equal(pkg.holds.length, 0);
});

test("convert route enforces the booking window, duplicate guard and vehicle availability", async () => {
  const soon = convertHarness();
  const tooSoon = await soon.route.POST(req("POST", "/api/admin/quotes/convert", convertBody({ startsAt: new Date(Date.now() + 30 * 60_000).toISOString() })));
  assert.equal(tooSoon.status, 400);
  assert.match(tooSoon.body.error, /notice/);

  const duplicate = await convertHarness({ duplicates: 1 }).route.POST(req("POST", "/api/admin/quotes/convert", convertBody()));
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.code, "duplicate_booking");

  const when = new Date(Date.now() + 10 * 86_400_000);
  const busy = [{ vehicleId: "veh-1", startsAt: new Date(when.getTime() - 3_600_000), endsAt: new Date(when.getTime() + 8 * 3_600_000) }];
  const taken = convertHarness({ busy });
  const response = await taken.route.POST(req("POST", "/api/admin/quotes/convert", convertBody({ startsAt: when.toISOString() })));
  assert.equal(response.status, 409);
  assert.equal(response.body.code, "slot_unavailable");
  assert.equal(taken.holds.length, 0);
});

test("convert route creates the booking draft through createBookingHold, links the quote and marks it booked", async () => {
  const h = convertHarness();
  const response = await h.route.POST(req("POST", "/api/admin/quotes/convert", convertBody({ customerNotes: "Piano on level 2" })));
  assert.equal(response.status, 200);
  assert.equal(response.body.bookingNumber, "HF-1001");
  assert.equal(response.body.bookingId, "booking-1");
  assert.equal(h.holds.length, 1);
  const hold = h.holds[0];
  assert.equal(hold.vehicleId, "veh-1");
  assert.equal(hold.customerId, "cust-1");
  assert.equal(hold.serviceId, "svc-1");
  assert.equal(hold.packageId, "3-men");
  assert.equal(hold.crewSize, 3);
  assert.equal(hold.customerNotes, "Piano on level 2");
  assert.equal(hold.holdMinutes, 2880);
  assert.equal(hold.estimatedDurationMinutes, 240);
  assert.deepEqual({ ...hold.moveDetails }, { service: "residential-removals", source: "admin_quote_conversion", quote_request_id: ID });
  assert.equal(h.repoCalls.customers[0].email, "Sam@Example.com".trim(), "customer lookup normalises the email itself");
  const link = h.calls.find((record) => record.table === "quote_requests" && has(record, "update"));
  const patch = opArgs(link, "update")[0];
  assert.equal(patch.quote_status, "booked");
  assert.equal(patch.booking_id, "booking-1");
  assert.ok(patch.first_response_at, "converting counts as the first response");
  assert.deepEqual(opArgs(link, "is"), ["booking_id", null], "link only applies while the quote is still unlinked");
  assert.match(response.headers["Cache-Control"], /no-store/);
});

test("convert route maps a lost slot race to 409 and reports a link failure with the booking number", async () => {
  let h;
  h = convertHarness({ hold: () => { throw new h.SlotUnavailableError(); } });
  const raced = await h.route.POST(req("POST", "/api/admin/quotes/convert", convertBody()));
  assert.equal(raced.status, 409);
  assert.equal(raced.body.code, "slot_unavailable");

  const unlinked = convertHarness({ linkResult: { data: null, error: null } });
  const failed = await unlinked.route.POST(req("POST", "/api/admin/quotes/convert", convertBody()));
  assert.equal(failed.status, 500);
  assert.equal(failed.body.code, "link_failed");
  assert.equal(failed.body.bookingNumber, "HF-1001");
});

// ---------------------------------------------------------------------------
// Sidebar + page wiring
// ---------------------------------------------------------------------------

test("sidebar badge counts new enquiries plus overdue open follow-ups", async () => {
  const supabase = makeSupabase((record) => (has(record, "eq") ? { count: 4, error: null } : { count: 2, error: null }));
  const repo = load("../lib/server/quote-crm-repo.ts", { "/supabase.ts": { getSupabaseAdmin: () => supabase.client }, "admin/dates": datesLib, "quote-crm.ts": quoteLib });
  assert.equal(await repo.countQuotesNeedingAttention(new Date("2026-03-10T05:00:00Z")), 6);
  const overdue = supabase.calls.find((record) => has(record, "lt"));
  assert.deepEqual(opArgs(overdue, "lt"), ["follow_up_at", datesLib.adelaideDay(0, new Date("2026-03-10T05:00:00Z")).start]);
  assert.ok(has(overdue, "in", ([column, values]) => column === "quote_status" && values.join() === "quote_sent,follow_up"));

  const failing = makeSupabase((record) => (has(record, "eq") ? { count: null, error: { code: "x" } } : { count: 0, error: null }));
  const failedRepo = load("../lib/server/quote-crm-repo.ts", { "/supabase.ts": { getSupabaseAdmin: () => failing.client }, "admin/dates": datesLib, "quote-crm.ts": quoteLib });
  assert.equal(await failedRepo.countQuotesNeedingAttention(), null);
});

test("the quotes page still guards with requireAdmin and the layout uses the shared attention count", () => {
  const page = readFileSync(new URL("../app/admin/(protected)/quotes/page.tsx", import.meta.url), "utf8");
  assert.match(page, /await requireAdmin\(\)/);
  const layout = readFileSync(new URL("../app/admin/(protected)/layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /countQuotesNeedingAttention/);
  for (const file of ["app/api/admin/quotes/bulk/route.ts", "app/api/admin/quotes/convert/route.ts"]) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    assert.match(source, /denyUnlessAdmin\(\)/, `${file} must authorise first`);
    assert.match(source, /denyCrossOrigin\(request\)/, `${file} must check origin`);
  }
  const guard = readFileSync(new URL("../lib/server/admin-api-guard.ts", import.meta.url), "utf8");
  assert.match(guard, /status === "forbidden" \? 403 : 401/);
  assert.match(guard, /private, no-store, max-age=0/);
});
