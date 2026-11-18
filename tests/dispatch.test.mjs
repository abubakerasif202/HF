import assert from "node:assert/strict";
import test from "node:test";
import { findDispatchConflicts, suggestCrewAllocation } from "../lib/dispatch.ts";
import { normalizeGoogleCalendarEvent } from "../lib/calendar-import.ts";

const booking = (id, start, end, overrides = {}) => ({
  id,
  startsAt: `2026-11-20T${start}:00+10:30`,
  endsAt: `2026-11-20T${end}:00+10:30`,
  durationMinutes: 120,
  status: "confirmed",
  crewId: null,
  vehicleIds: [],
  ...overrides,
});

test("flags overlapping work assigned to the same crew or truck", () => {
  const conflicts = findDispatchConflicts([
    booking("a", "08:00", "10:00", { crewId: "crew-1" }),
    booking("b", "09:30", "11:00", { crewId: "crew-1" }),
  ], []);
  assert.deepEqual(conflicts.map(({ kind }) => kind), ["crew"]);
});

test("detects collisions for every truck assigned to a multi-truck job", () => {
  const conflicts = findDispatchConflicts([
    booking("a", "08:00", "10:00", { vehicleIds: ["truck-1", "truck-2"] }),
    booking("b", "09:00", "11:00", { vehicleIds: ["truck-2"] }),
  ], []);
  assert.deepEqual(conflicts.map(({ kind }) => kind), ["truck"]);
});

test("flags an HF job overlapping an imported calendar event without inventing an assignment", () => {
  const conflicts = findDispatchConflicts(
    [booking("a", "08:00", "10:00")],
    [{ id: "g-1", startsAt: "2026-11-19T22:30:00.000Z", endsAt: "2026-11-20T00:00:00.000Z", status: "confirmed" }],
  );
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].kind, "calendar");
});

test("suggests the least-loaded available crew and leaves conflicting jobs unassigned", () => {
  const suggestions = suggestCrewAllocation(
    [
      booking("assigned", "08:00", "10:00", { crewId: "crew-1", durationMinutes: 120 }),
      booking("free", "08:00", "09:00", { durationMinutes: 60 }),
      booking("overlap", "09:00", "10:00", { durationMinutes: 60 }),
    ],
    [{ id: "crew-1", name: "QASim SUBY" }, { id: "crew-2", name: "Mubashir Sabi" }],
    [{ id: "g-1", startsAt: "2026-11-19T22:30:00.000Z", endsAt: "2026-11-19T23:30:00.000Z", status: "confirmed" }],
  );
  assert.equal(suggestions.find((item) => item.bookingId === "free").crewId, "crew-2");
  assert.equal(suggestions.find((item) => item.bookingId === "overlap").crewId, null);
});

test("imports Google events without inventing booking fields and skips HF mirror events", () => {
  const imported = normalizeGoogleCalendarEvent({
    id: "google-event-1",
    summary: "Move booking",
    start: { dateTime: "2026-11-20T08:00:00+10:30" },
    end: { dateTime: "2026-11-20T10:00:00+10:30" },
  });
  assert.equal(imported?.summary, "Move booking");
  assert.equal(imported?.startsAt, "2026-11-19T21:30:00.000Z");
  assert.equal(normalizeGoogleCalendarEvent({ id: `hf${"a".repeat(32)}` }), null);
});

test("preserves all-day spans and leaves missing event details null", () => {
  assert.deepEqual(normalizeGoogleCalendarEvent({
    id: "all-day-1",
    start: { date: "2026-11-20" },
    end: { date: "2026-11-21" },
  }), {
    eventId: "all-day-1",
    summary: null,
    startsAt: null,
    endsAt: null,
    allDayStart: "2026-11-20",
    allDayEnd: "2026-11-21",
    location: null,
    status: "confirmed",
  });
});


test("only live booking states participate in conflict detection", () => {
  for (const status of ["draft", "completed", "cancelled", "expired", "held", "pending_payment", "confirmed", "assigned", "in_progress"]) {
    const conflicts = findDispatchConflicts([
      booking("a", "08:00", "10:00", { crewId: "crew-1" }),
      booking("b", "09:00", "11:00", { crewId: "crew-1", status }),
    ], []);
    assert.equal(conflicts.length, ["held", "pending_payment", "confirmed", "assigned", "in_progress"].includes(status) ? 1 : 0, status);
  }
});

test("legacy truck counts and partial multi-truck allocation stay consistent", async () => {
  const { effectiveDispatchTruckCount, needsDispatchAllocation } = await import("../lib/dispatch.ts");
  const legacy = { crew_id: "crew", vehicle_id: "truck", dispatch_additional_vehicle_ids: [], dispatch_truck_count: null };
  assert.equal(effectiveDispatchTruckCount(legacy), 1);
  assert.equal(needsDispatchAllocation(legacy), false);
  const partial = { ...legacy, dispatch_truck_count: 2 };
  assert.equal(effectiveDispatchTruckCount(partial), 2);
  assert.equal(needsDispatchAllocation(partial), true);
  assert.equal(needsDispatchAllocation({ ...partial, dispatch_additional_vehicle_ids: ["other"] }), false);
  assert.equal(effectiveDispatchTruckCount({ ...legacy, vehicle_id: null }), null);
});
