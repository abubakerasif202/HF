import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import {
  CLOSEOUT_STATUSES, daysSinceEnd, isCloseoutStatus, isPastEnd, stepsToInProgress,
} from "../lib/admin/closeout.ts";
import { canTransition } from "../lib/booking/state-machine.ts";

const require = createRequire(import.meta.url);
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const ACTIONS = "app/admin/(protected)/closeout/actions.ts";
const ID = "00000000-0000-4000-8000-000000000001";
const PAST = "2026-10-04T05:00:00Z";
const FUTURE = "2099-01-01T00:00:00Z";

function transpile(path) {
  return ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
}

function loadModule(path, requireFn) {
  const exports = {};
  vm.runInNewContext(transpile(path), { exports, require: requireFn, console, Date, Number, Math, Set, Object, Array, Promise, Error, JSON, URL }, { filename: path });
  return exports;
}

/** Runs the real actions.ts against mocked auth, database and the existing booking actions. */
function harness({ auth = true, booking = { booking_status: "confirmed", ends_at: PAST }, bookingError = null, transition = {}, finalise = {}, eventError = null } = {}) {
  const calls = [];
  const stateMachine = loadModule("lib/booking/state-machine.ts", require);
  const closeout = loadModule("lib/admin/closeout.ts", (id) => (id.endsWith("state-machine.ts") ? stateMachine : require(id)));
  const mocks = (id) => {
    if (id === "next/cache") return { revalidatePath: (path) => calls.push(["revalidate", path]) };
    if (id.includes("supabase-ssr")) return { getStaffSession: async () => (auth ? { userId: "owner-1" } : null) };
    if (id.endsWith("lib/admin/closeout.ts")) return closeout;
    if (id.endsWith("bookings/[id]/actions.ts")) {
      return {
        transitionBookingStatusAction: async (bookingId, to) => { calls.push(["transition", bookingId, to]); return transition[to] ?? {}; },
        finalizeJobAction: async (bookingId, minutes) => { calls.push(["finalize", bookingId, minutes]); return finalise; },
      };
    }
    if (id.endsWith("lib/server/supabase.ts")) {
      return {
        getSupabaseAdmin: () => ({
          from: (table) => ({
            select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: bookingError ? null : booking, error: bookingError }) }) }),
            insert: async (row) => { calls.push(["insert", table, row]); return { error: eventError }; },
          }),
        }),
      };
    }
    return require(id);
  };
  return { calls, actions: loadModule(ACTIONS, mocks) };
}

/* ---------- pure rules ---------- */

test("closeout statuses are exactly confirmed, assigned and in_progress (no new statuses)", () => {
  assert.deepEqual([...CLOSEOUT_STATUSES], ["confirmed", "assigned", "in_progress"]);
  assert.equal(isCloseoutStatus("completed"), false);
  assert.equal(isCloseoutStatus("cancelled"), false);
  assert.equal(isCloseoutStatus("held"), false);
});

test("stepsToInProgress walks only valid transitions and ends at in_progress", () => {
  assert.deepEqual(stepsToInProgress("confirmed"), ["assigned", "in_progress"]);
  assert.deepEqual(stepsToInProgress("assigned"), ["in_progress"]);
  assert.deepEqual(stepsToInProgress("in_progress"), []);
  for (const from of CLOSEOUT_STATUSES) {
    let current = from;
    for (const next of stepsToInProgress(from)) {
      assert.equal(canTransition(current, next), true, `${current} -> ${next}`);
      current = next;
    }
    assert.equal(canTransition("in_progress", "completed"), true);
    assert.equal(canTransition(from, "cancelled"), true, `${from} can be cancelled`);
  }
});

test("a job is closeable only after it has ended", () => {
  const now = new Date("2026-10-10T00:00:00Z");
  assert.equal(isPastEnd("2026-10-09T23:59:00Z", now), true);
  assert.equal(isPastEnd("2026-10-10T00:01:00Z", now), false);
  assert.equal(isPastEnd("not a date", now), false);
  assert.equal(daysSinceEnd("2026-10-04T00:00:00Z", now), 6);
  assert.equal(daysSinceEnd("2026-10-11T00:00:00Z", now), 0);
});

/* ---------- finalise action ---------- */

test("finalise rejects an unauthenticated caller before touching anything", async () => {
  const h = harness({ auth: false });
  await assert.rejects(h.actions.finaliseCloseoutJobAction(ID, 240), /Not authorized/);
  assert.equal(h.calls.length, 0);
});

test("finalise validates the booking id and the minutes", async () => {
  const h = harness();
  assert.match((await h.actions.finaliseCloseoutJobAction("nope", 240)).error, /whole number of minutes/);
  for (const bad of [0, -5, 1.5, 1441, Number.NaN, "240"]) {
    assert.ok((await h.actions.finaliseCloseoutJobAction(ID, bad)).error, `${bad} must be rejected`);
  }
  assert.equal(h.calls.length, 0, "no mutation for invalid input");
});

test("finalise steps a confirmed job through assigned and in_progress, then finalises", async () => {
  const h = harness();
  assert.deepEqual({ ...(await h.actions.finaliseCloseoutJobAction(ID, 240)) }, {});
  assert.deepEqual(h.calls.filter(([kind]) => kind !== "revalidate"), [
    ["transition", ID, "assigned"], ["transition", ID, "in_progress"], ["finalize", ID, 240],
  ]);
  assert.ok(h.calls.some((c) => c[0] === "revalidate" && c[1] === "/admin/closeout"));
});

test("finalise from assigned or in_progress skips the steps already done", async () => {
  const assigned = harness({ booking: { booking_status: "assigned", ends_at: PAST } });
  await assigned.actions.finaliseCloseoutJobAction(ID, 180);
  assert.deepEqual(assigned.calls.filter(([k]) => k !== "revalidate"), [["transition", ID, "in_progress"], ["finalize", ID, 180]]);
  const live = harness({ booking: { booking_status: "in_progress", ends_at: PAST } });
  await live.actions.finaliseCloseoutJobAction(ID, 180);
  assert.deepEqual(live.calls.filter(([k]) => k !== "revalidate"), [["finalize", ID, 180]]);
});

test("finalise refuses future, already-closed and missing bookings without mutating", async () => {
  for (const [booking, pattern] of [
    [{ booking_status: "confirmed", ends_at: FUTURE }, /not finished yet/],
    [{ booking_status: "completed", ends_at: PAST }, /no longer needs closing out/],
    [{ booking_status: "cancelled", ends_at: PAST }, /no longer needs closing out/],
    [null, /Booking not found/],
  ]) {
    const h = harness({ booking });
    assert.match((await h.actions.finaliseCloseoutJobAction(ID, 200)).error, pattern);
    assert.equal(h.calls.length, 0);
  }
});

test("finalise stops and reports the error if a transition or the finalise step fails", async () => {
  const blocked = harness({ transition: { in_progress: { error: "Cannot move a booking from \"assigned\" to \"in_progress\"." } } });
  assert.match((await blocked.actions.finaliseCloseoutJobAction(ID, 240)).error, /Cannot move a booking/);
  assert.equal(blocked.calls.some(([kind]) => kind === "finalize"), false, "never finalise after a failed step");
  const failed = harness({ finalise: { error: "Booking not found." } });
  assert.match((await failed.actions.finaliseCloseoutJobAction(ID, 240)).error, /Booking not found/);
});

/* ---------- cancel / no-show action ---------- */

test("cancel rejects an unauthenticated caller before touching anything", async () => {
  const h = harness({ auth: false });
  await assert.rejects(h.actions.cancelCloseoutJobAction(ID, "no_show"), /Not authorized/);
  assert.equal(h.calls.length, 0);
});

test("cancel validates id and reason", async () => {
  const h = harness();
  assert.ok((await h.actions.cancelCloseoutJobAction("nope", "no_show")).error);
  assert.ok((await h.actions.cancelCloseoutJobAction(ID, "refunded")).error);
  assert.equal(h.calls.length, 0);
});

test("no-show cancels through the state machine and writes a no-show audit event", async () => {
  const h = harness();
  assert.deepEqual({ ...(await h.actions.cancelCloseoutJobAction(ID, "no_show")) }, {});
  assert.deepEqual(h.calls[0], ["transition", ID, "cancelled"]);
  const insert = h.calls.find(([kind]) => kind === "insert");
  assert.equal(insert[1], "booking_events");
  assert.equal(insert[2].event, "closeout_marked_no_show");
  assert.equal(insert[2].booking_id, ID);
  assert.equal(insert[2].actor, "owner-1");
  assert.deepEqual({ ...insert[2].metadata }, { reason: "no_show", source: "closeout_queue" });
});

test("a plain cancellation writes a cancelled audit event, for every closeout status", async () => {
  for (const status of CLOSEOUT_STATUSES) {
    const h = harness({ booking: { booking_status: status, ends_at: PAST } });
    assert.deepEqual({ ...(await h.actions.cancelCloseoutJobAction(ID, "cancelled")) }, {});
    assert.equal(h.calls.find(([kind]) => kind === "insert")[2].event, "closeout_marked_cancelled");
  }
});

test("cancel refuses closed or future jobs and surfaces a refused transition without an audit row", async () => {
  assert.match((await harness({ booking: { booking_status: "completed", ends_at: PAST } }).actions.cancelCloseoutJobAction(ID, "cancelled")).error, /no longer needs/);
  assert.match((await harness({ booking: { booking_status: "confirmed", ends_at: FUTURE } }).actions.cancelCloseoutJobAction(ID, "cancelled")).error, /not finished yet/);
  const refused = harness({ transition: { cancelled: { error: "Cannot move a booking from \"completed\" to \"cancelled\"." } } });
  assert.match((await refused.actions.cancelCloseoutJobAction(ID, "cancelled")).error, /Cannot move a booking/);
  assert.equal(refused.calls.some(([kind]) => kind === "insert"), false);
});

test("a failed audit insert is reported after the booking was closed", async () => {
  const h = harness({ eventError: { message: "db down" } });
  assert.match((await h.actions.cancelCloseoutJobAction(ID, "no_show")).error, /audit note could not be saved/);
});

/* ---------- wiring ---------- */

test("the closeout page is owner-guarded and the queue query matches the brief", () => {
  const page = read("app/admin/(protected)/closeout/page.tsx");
  assert.match(page, /await requireAdmin\(\)/);
  const repo = read("lib/server/closeout-repo.ts");
  assert.match(repo, /\.lt\("ends_at", now\.toISOString\(\)\)/);
  assert.match(repo, /\.in\("booking_status", \[\.\.\.CLOSEOUT_STATUSES\]\)/);
  assert.match(repo, /order\("ends_at", \{ ascending: true \}\)/);
});

test("closeout actions reuse the existing finalise and transition actions and add no new status", () => {
  const source = read(ACTIONS);
  assert.match(source, /finalizeJobAction/);
  assert.match(source, /transitionBookingStatusAction/);
  assert.doesNotMatch(source, /booking_status:/, "status changes go through the state machine, never a direct update");
  assert.match(read("app/admin/(protected)/closeout/CloseoutRow.tsx"), /createInvoiceDraftAction/);
});

test("the dashboard card and sidebar link point at /admin/closeout", () => {
  assert.match(read("app/admin/(protected)/page.tsx"), /href="\/admin\/closeout"/);
  assert.match(read("app/admin/(protected)/layout.tsx"), /href: "\/admin\/closeout"/);
});
