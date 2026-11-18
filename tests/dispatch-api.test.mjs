import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
const require = createRequire(import.meta.url);
const source = readFileSync(new URL("../app/api/admin/dispatch/route.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
function harness({ auth = "authorized", databaseError, calendarError, clashes } = {}) {
  const calls = [];
  const exports = {};
  vm.runInNewContext(output, { exports, console: { error() {} }, URL, Date, Set, Object, JSON,
    require: (id) => {
      if (id === "server-only") return {};
      if (id === "next/server") return { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200, headers: options.headers }) } };
      if (id.includes("supabase-ssr")) return { getAdminAuthState: async () => ({ status: auth, session: { userId: "owner" } }) };
      if (id.includes("google-calendar")) return { reconcileBookingCalendar: async (id) => { calls.push(["calendar", id]); if (calendarError) throw calendarError; } };
      if (id.includes("booking-conflicts")) return { findClashingBookings: async (query) => { calls.push(["clash-lookup", query]); return clashes ?? []; } };
      if (id.includes("supabase.ts")) return { getSupabaseAdmin: () => ({
        rpc: async (name, args) => { calls.push([name, args]); return { data: !databaseError, error: databaseError }; },
        from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { starts_at: "2026-11-20T00:00:00Z", ends_at: "2026-11-20T03:00:00Z", crew_id: "crew-1", vehicle_id: null, dispatch_additional_vehicle_ids: [] } }) }) }) }),
      }) };
      if (id.includes("booking-repo") || id.includes("timezone") || id.endsWith("dispatch.ts")) return {};
      return require(id);
    },
  });
  const request = (body, origin = "https://hf.test") => ({ nextUrl: { origin: "https://hf.test" }, headers: new Headers({ origin }), text: async () => JSON.stringify(body) });
  return { calls, patch: (body, origin) => exports.PATCH(request(body, origin)) };
}
const input = { bookingId: "00000000-0000-4000-8000-000000000001", crewId: null };
test("dispatch PATCH authorizes and checks origin before its transaction", async () => {
  for (const auth of ["forbidden", "unauthenticated"]) { const h = harness({ auth }); assert.equal((await h.patch(input)).status, auth === "forbidden" ? 403 : 401); assert.equal(h.calls.length, 0); }
  const h = harness(); assert.equal((await h.patch(input, "https://elsewhere.test")).status, 403); assert.equal(h.calls.length, 0);
});
test("dispatch PATCH reconciles only after successful atomic persistence", async () => {
  const h = harness(); assert.equal((await h.patch(input)).status, 200);
  assert.equal(h.calls[0][0], "update_dispatch_booking"); assert.equal(h.calls[1][0], "calendar"); assert.equal(h.calls[1][1], input.bookingId);
  const rejected = harness({ databaseError: { code: "23P01" } }); assert.equal((await rejected.patch(input)).status, 409); assert.equal(rejected.calls.some(([name]) => name === "calendar"), false, "no Calendar reconcile after a refused assignment"); assert.equal(rejected.calls.filter(([name]) => name === "update_dispatch_booking").length, 1);
});
test("a refused assignment names the conflicting booking so staff can open it", async () => {
  const h = harness({ databaseError: { code: "23P01" }, clashes: [{ id: "00000000-0000-4000-8000-000000000009", bookingNumber: "HF-2026-00044", kind: "crew" }] });
  const response = await h.patch({ ...input, crewId: "00000000-0000-4000-8000-0000000000aa" });
  assert.equal(response.status, 409);
  assert.match(response.body.error, /already assigned/);
  assert.match(response.body.error, /HF-2026-00044 \(crew\)/);
  assert.equal(response.body.conflicts[0].bookingNumber, "HF-2026-00044");
  // The new crew from the request, not the stored one, is what was checked.
  assert.equal(h.calls.find(([name]) => name === "clash-lookup")[1].crewId, "00000000-0000-4000-8000-0000000000aa");
});
test("a failed clash lookup never hides the 409", async () => {
  const h = harness({ databaseError: { code: "23P01" } });
  const response = await h.patch(input);
  assert.equal(response.status, 409);
  assert.deepEqual([...response.body.conflicts], []);
});
test("dispatch PATCH reports saved state if Calendar reconciliation fails after commit", async () => {
  const h = harness({ calendarError: new Error("database unavailable") }); const response = await h.patch(input);
  assert.equal(response.status, 200); assert.equal(response.body.updated, true); assert.equal(response.body.calendarSync, "pending"); assert.match(response.body.warning, /saved/i);
});
