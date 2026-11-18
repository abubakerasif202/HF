import assert from "node:assert/strict";
import test from "node:test";
import { conflictLabel, findDispatchConflicts, overlapCertainty, selectDispatchQueues, suggestCrewAllocation } from "../lib/dispatch.ts";

const job = (id, startsAt, endsAt, extra = {}) => ({ id, startsAt, endsAt, durationMinutes: 120, status: "confirmed", crewId: null, vehicleIds: [], ...extra });

test("overlaps with known finish times are definite", () => {
  assert.equal(overlapCertainty({ startsAt: "2026-11-20T08:00:00+10:30", endsAt: "2026-11-20T10:00:00+10:30" }, { startsAt: "2026-11-20T09:00:00+10:30", endsAt: "2026-11-20T11:00:00+10:30" }), "definite");
  // Back-to-back jobs do not overlap.
  assert.equal(overlapCertainty({ startsAt: "2026-11-20T08:00:00+10:30", endsAt: "2026-11-20T10:00:00+10:30" }, { startsAt: "2026-11-20T10:00:00+10:30", endsAt: "2026-11-20T12:00:00+10:30" }), null);
});

test("a missing finish time never hides a clash: it is reported as possible", () => {
  const shared = { crewId: "crew-1", vehicleIds: ["truck-1"] };
  // Duration-derived end overlaps.
  let conflicts = findDispatchConflicts([job("a", "2026-11-20T08:00:00+10:30", "2026-11-20T10:00:00+10:30", shared), job("b", "2026-11-20T09:00:00+10:30", null, shared)], []);
  assert.deepEqual(conflicts.map((c) => [c.kind, c.certainty]), [["crew", "possible"], ["truck", "possible"]]);
  // No duration either: it starts while the other job is running, so it is still flagged.
  conflicts = findDispatchConflicts([job("a", "2026-11-20T08:00:00+10:30", "2026-11-20T10:00:00+10:30", shared), job("b", "2026-11-20T09:00:00+10:30", null, { ...shared, durationMinutes: 0 })], []);
  assert.equal(conflicts[0].certainty, "possible");
  // Starts after the known job has finished: no conflict even though its own end is unknown.
  assert.deepEqual(findDispatchConflicts([job("a", "2026-11-20T08:00:00+10:30", "2026-11-20T10:00:00+10:30", shared), job("b", "2026-11-20T10:30:00+10:30", null, { ...shared, durationMinutes: 0 })], []), []);
  // Calendar events with a start but no end are no longer ignored.
  const calendar = findDispatchConflicts([job("a", "2026-11-20T08:00:00+10:30", "2026-11-20T10:00:00+10:30")], [{ id: "evt", startsAt: "2026-11-20T09:00:00+10:30", endsAt: null, status: "confirmed" }, { id: "gone", startsAt: "2026-11-20T09:00:00+10:30", endsAt: null, status: "cancelled" }]);
  assert.deepEqual(calendar.map((c) => [c.otherId, c.kind, c.certainty]), [["evt", "calendar", "possible"]]);
});

test("labels say possible only when the finish time is missing", () => {
  assert.equal(conflictLabel({ kind: "crew", certainty: "definite" }), "Crew double-booked");
  assert.equal(conflictLabel({ kind: "truck", certainty: "possible" }), "Possible: truck double-booked");
  assert.equal(conflictLabel({ kind: "calendar", certainty: "possible" }), "Possible: calendar overlap");
});

test("crew allocation avoids a crew whose other job has no finish time", () => {
  const result = suggestCrewAllocation([
    job("busy", "2026-11-20T08:00:00+10:30", null, { crewId: "crew-a" }),
    job("new", "2026-11-20T09:00:00+10:30", "2026-11-20T11:00:00+10:30"),
  ], [{ id: "crew-a", name: "A" }, { id: "crew-b", name: "B" }], []);
  assert.deepEqual(result, [{ bookingId: "new", crewId: "crew-b", reason: "balanced" }]);
});

const row = (id, startsAt, status = "confirmed", extra = {}) => ({ id, starts_at: startsAt, booking_status: status, crew_id: "c", vehicle_id: "v", dispatch_additional_vehicle_ids: [], dispatch_truck_count: null, ...extra });

test("queues split today, upcoming and awaiting assignment by Adelaide day", () => {
  // 2026-11-20 08:00 Adelaide (ACDT, +10:30) = 2026-11-19T21:30Z.
  const now = new Date("2026-11-19T21:30:00Z");
  const rows = [
    row("today-early", "2026-11-19T13:30:00Z"),          // 00:00 local today: included (inclusive start)
    row("today-late", "2026-11-20T13:00:00Z"),            // 23:30 local today
    row("yesterday-late", "2026-11-19T13:00:00Z"),        // 23:30 local yesterday: excluded
    row("tomorrow", "2026-11-20T13:30:00Z"),              // 00:00 local tomorrow
    row("in-14-days", "2026-12-04T03:00:00Z", "assigned"),
    row("after-horizon", "2026-12-05T13:30:00Z"),
    row("done-today", "2026-11-19T22:00:00Z", "completed"),
    row("cancelled", "2026-11-20T01:00:00Z", "cancelled"),
    row("held", "2026-11-21T01:00:00Z", "held"),
    row("no-crew", "2026-11-25T01:00:00Z", "confirmed", { crew_id: null }),
    row("no-truck", "2026-11-26T01:00:00Z", "pending_payment", { vehicle_id: null }),
    row("needs-two-trucks", "2026-11-27T01:00:00Z", "confirmed", { dispatch_truck_count: 2 }),
    row("old-unassigned", "2026-11-10T01:00:00Z", "confirmed", { crew_id: null }),
  ];
  const queues = selectDispatchQueues(rows, now);
  assert.equal(queues.todayYmd, "2026-11-20");
  assert.deepEqual(queues.today.map((r) => r.id), ["today-early", "done-today", "today-late"]);
  assert.deepEqual(queues.upcoming.map((r) => r.id), ["tomorrow", "no-crew", "no-truck", "needs-two-trucks", "in-14-days"]);
  assert.deepEqual(queues.needsAllocation.map((r) => r.id), ["no-crew", "no-truck", "needs-two-trucks"]);
});

test("queues use the Adelaide day across the daylight-saving change", () => {
  // 2026-10-04 02:00 ACST becomes 03:00 ACDT. "Now" is 2026-10-03 21:00 local (11:30Z).
  const now = new Date("2026-10-03T11:30:00Z");
  const queues = selectDispatchQueues([
    row("sat-night", "2026-10-03T13:00:00Z"),   // 2026-10-03 22:30 ACST: today
    row("sun-early", "2026-10-03T16:30:00Z"),   // 2026-10-04 03:00 ACDT local: tomorrow, never today
  ], now);
  assert.equal(queues.todayYmd, "2026-10-03");
  assert.deepEqual(queues.today.map((r) => r.id), ["sat-night"]);
  assert.deepEqual(queues.upcoming.map((r) => r.id), ["sun-early"]);
});
