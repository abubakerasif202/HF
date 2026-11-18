import assert from "node:assert/strict";
import test from "node:test";
import { calendarSyncReason, googleEventIdForBooking, reconcileCalendarEvent, SYNCABLE_STATUSES } from "../lib/calendar-sync.ts";
import { reconcileCalendarImport } from "../lib/calendar-import.ts";

// Synthetic data only. An in-memory "Google" that behaves like the real API for ids:
// insert of an existing id -> 409, update/remove of a missing id -> 404.
function fakeGoogle() {
  const events = new Map();
  const calls = [];
  const err = (status) => Object.assign(new Error(`http ${status}`), { status });
  return {
    events, calls,
    client: {
      insert: async (id, body) => { calls.push(["insert", id]); if (events.has(id)) throw err(409); events.set(id, { ...body }); },
      update: async (id, body) => { calls.push(["update", id]); if (!events.has(id)) throw err(404); events.set(id, { ...body }); },
      remove: async (id) => { calls.push(["remove", id]); if (!events.has(id)) throw err(404); events.delete(id); },
    },
  };
}

const ID = "11111111-2222-4333-8444-555555555555";
const booking = (o = {}) => ({
  id: ID, booking_number: "HF-SYN-0001", booking_status: "confirmed", starts_at: "2026-11-20T22:00:00.000Z", ends_at: "2026-11-21T02:00:00.000Z",
  crew_size: 2, package_id: null, pickup_address: { suburb: "Sampleton" }, destination_address: { suburb: "Exampleville" }, pricing_snapshot: null,
  google_calendar_event_id: null, customer: { name: "Sample Customer", email: "sample@example.invalid", phone: "0400 000 000" }, ...o,
});
const opts = { adminBaseUrl: "https://admin.example.invalid" };

/** Mirrors lib/server/google-calendar.ts: persist the outcome on the booking row. */
async function sync(row, g) {
  const out = await reconcileCalendarEvent(row, g.client, opts);
  if (out.status === "synced") { row.google_calendar_event_id = out.eventId; row.calendar_sync_status = "synced"; }
  else if (out.status === "not_applicable") row.calendar_sync_status = "not_applicable";
  else if (out.status === "failed") row.calendar_sync_status = "failed";
  return out;
}

test("a confirmed booking creates exactly one Google event; retries keep one", async () => {
  const g = fakeGoogle();
  const row = booking();
  await sync(row, g);
  assert.equal(g.events.size, 1);
  assert.equal(row.google_calendar_event_id, googleEventIdForBooking(ID));
  await sync(row, g);
  await sync(row, g);
  assert.equal(g.events.size, 1, "retries update in place");
  assert.deepEqual(g.calls.map((c) => c[0]), ["insert", "update", "update"]);
  // Lost id: the insert succeeded but the id was never saved. The retry hits 409 and updates, still one event.
  const lost = booking({ id: "99999999-2222-4333-8444-555555555555" });
  await sync(lost, g); lost.google_calendar_event_id = null; await sync(lost, g);
  assert.equal(g.events.size, 2);
});

test("a reschedule updates the same event rather than adding one", async () => {
  const g = fakeGoogle();
  const row = booking();
  await sync(row, g);
  row.starts_at = "2026-11-22T22:00:00.000Z"; row.ends_at = "2026-11-23T02:00:00.000Z";
  await sync(row, g);
  assert.equal(g.events.size, 1);
  assert.equal([...g.events.values()][0].start.dateTime, "2026-11-22T22:00:00.000Z");
});

test("cancelling removes the event; repeating it is harmless; the booking keeps its mapping", async () => {
  const g = fakeGoogle();
  const row = booking();
  await sync(row, g);
  row.booking_status = "cancelled";
  assert.equal((await sync(row, g)).status, "synced");
  assert.equal(g.events.size, 0);
  assert.equal((await sync(row, g)).status, "synced", "already gone counts as done");
  assert.equal(calendarSyncReason(row).label, "Removed from Google");
});

test("an expired hold never had an event: no Google call, no retry state", async () => {
  const g = fakeGoogle();
  const row = booking({ booking_status: "expired" });
  const out = await sync(row, g);
  assert.equal(out.status, "not_applicable");
  assert.equal(g.calls.length, 0);
  assert.equal(row.calendar_sync_status, "not_applicable");
  assert.ok(!SYNCABLE_STATUSES.includes("expired"), "the scheduled run never selects expired holds");
  // A cancelled booking whose event exists in Google (even with a lost id) is still cleaned up.
  g.events.set(googleEventIdForBooking(ID), {});
  await sync(booking({ booking_status: "cancelled" }), g);
  assert.equal(g.events.size, 0);
});

test("held bookings wait for confirmation and are not synced", async () => {
  const g = fakeGoogle();
  assert.equal((await sync(booking({ booking_status: "held" }), g)).status, "skipped");
  assert.equal(g.calls.length, 0);
});

test("staff can tell a valid wait from a failure", () => {
  const r = (booking_status, calendar_sync_status, google_calendar_event_id = null, calendar_sync_error = null) => calendarSyncReason({ booking_status, calendar_sync_status, google_calendar_event_id, calendar_sync_error });
  assert.deepEqual([r("held", "pending").tone, r("held", "pending").label], ["waiting", "Awaiting confirmation"]);
  assert.deepEqual([r("expired", "pending").tone, r("expired", "pending").label], ["waiting", "No event needed"]);
  assert.deepEqual([r("expired", "not_applicable").tone, r("cancelled", "not_applicable").label], ["waiting", "No event needed"]);
  assert.equal(r("cancelled", "synced", "hfx").label, "Removed from Google");
  assert.equal(r("confirmed", "synced", "hfx").label, "In Google Calendar");
  assert.deepEqual([r("confirmed", "pending").tone, r("confirmed", "pending").label], ["retry", "Queued for Google"]);
  const failed = r("confirmed", "failed", "hfx", "Google rejected the calendar credentials.");
  assert.equal(failed.tone, "retry");
  assert.match(failed.detail, /retries this automatically/);
  assert.match(failed.detail, /credentials/);
  assert.equal(r("expired", "failed").tone, "failed");
  assert.match(r("expired", "failed").detail, /not retried automatically/);
  assert.equal(r("confirmed", "not_applicable").label, "Google not connected");
});

// ---- Google -> HF import ----
const timed = (id, summary, start, end, extra = {}) => ({ id, summary, status: "confirmed", start: { dateTime: start }, end: { dateTime: end }, ...extra });
function fakeImport(googleEvents) {
  const store = new Map();
  const adapter = {
    list: async () => ({ items: googleEvents }),
    get: async (id) => { const e = googleEvents.find((x) => x.id === id); if (!e) throw Object.assign(new Error("gone"), { status: 404 }); return e; },
    loadExisting: async () => [...store.values()].filter((e) => e.status !== "cancelled").map((e) => e.eventId),
    save: async (events) => { for (const e of events) store.set(e.eventId, e); },
  };
  return { store, googleEvents, run: () => reconcileCalendarImport("2026-11-01T00:00:00Z", "2027-03-01T00:00:00Z", adapter) };
}

test("an external Google event appears once in HF, however many times it is imported", async () => {
  const g = fakeImport([timed("ext1", "Sample external", "2026-11-20T00:00:00Z", "2026-11-20T01:00:00Z")]);
  await g.run(); await g.run(); await g.run();
  assert.equal(g.store.size, 1);
  assert.equal(g.store.get("ext1").summary, "Sample external");
});

test("HF-created mirror events imported back never become separate HF blocks", async () => {
  const mirror = googleEventIdForBooking(ID);
  const g = fakeImport([timed(mirror, "HF-SYN-0001 - Customer - HR", "2026-11-20T00:00:00Z", "2026-11-20T04:00:00Z"), timed("ext1", "Sample external", "2026-11-21T00:00:00Z", "2026-11-21T01:00:00Z")]);
  await g.run();
  assert.deepEqual([...g.store.keys()], ["ext1"]);
});

test("Google is the source of truth for external events: edits update in place, deletes cancel", async () => {
  const g = fakeImport([timed("ext1", "Before", "2026-11-20T00:00:00Z", "2026-11-20T01:00:00Z")]);
  await g.run();
  g.googleEvents[0] = timed("ext1", "After edit", "2026-11-20T02:00:00Z", "2026-11-20T03:00:00Z");
  await g.run();
  assert.equal(g.store.size, 1);
  assert.deepEqual([g.store.get("ext1").summary, g.store.get("ext1").startsAt], ["After edit", "2026-11-20T02:00:00.000Z"]);
  g.googleEvents[0] = { ...g.googleEvents[0], status: "cancelled" }; // Google reports deleted events (showDeleted)
  await g.run();
  assert.equal(g.store.get("ext1").status, "cancelled");
  // Removed entirely and no longer listed: the 404 on lookup cancels it as well.
  const g2 = fakeImport([timed("ext2", "Soon gone", "2026-11-20T00:00:00Z", "2026-11-20T01:00:00Z")]);
  await g2.run();
  g2.googleEvents.length = 0;
  await g2.run();
  assert.equal(g2.store.get("ext2").status, "cancelled");
});
