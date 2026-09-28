import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildCalendarEvent, googleEventIdForBooking, reconcileCalendarEvent, friendlyCalendarError, CALENDAR_TIME_ZONE } from "../lib/calendar-sync.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const OPTS = { adminBaseUrl: "https://www.hfremovalsadelaide.com.au" };

function booking(overrides = {}) {
  return {
    id: "fc4ee04b-045d-497c-8400-c16b428602a1",
    booking_number: "HF-2026-00023",
    booking_status: "confirmed",
    starts_at: "2026-12-14T18:30:00.000Z",
    ends_at: "2026-12-14T21:30:00.000Z",
    crew_size: 2,
    pickup_address: { addressLine: "1 Test St", suburb: "Adelaide" },
    destination_address: { addressLine: "2 Test Rd", suburb: "Glenelg" },
    pricing_snapshot: { package: "2 Men + Truck" },
    google_calendar_event_id: null,
    customer: { name: "Jane Smith", email: "jane@example.com", phone: "0400000000" },
    ...overrides,
  };
}

function apiError(status) {
  return Object.assign(new Error(`Request failed with status code ${status}`), { status });
}

/** Fake Google Calendar keyed by event id. Deleted events are kept as
 * "cancelled", matching Google (re-inserting a deleted id is a 409). */
function fakeCalendar({ failWith } = {}) {
  const events = new Map();
  const calls = [];
  const client = {
    async insert(id, body) {
      calls.push(["insert", id]);
      if (failWith) throw failWith;
      if (events.has(id)) throw apiError(409);
      events.set(id, { ...body });
    },
    async update(id, body) {
      calls.push(["update", id]);
      if (failWith) throw failWith;
      if (!events.has(id)) throw apiError(404);
      events.set(id, { ...body });
    },
    async remove(id) {
      calls.push(["remove", id]);
      if (failWith) throw failWith;
      const existing = events.get(id);
      if (!existing || existing.status === "cancelled") throw apiError(410);
      events.set(id, { ...existing, status: "cancelled" });
    },
  };
  return { client, events, calls, live: () => [...events.values()].filter((e) => e.status !== "cancelled") };
}

/** Applies an outcome to the booking the way lib/server/google-calendar.ts does. */
function apply(b, outcome) {
  if (outcome.status === "synced") return { ...b, google_calendar_event_id: outcome.eventId };
  return b;
}

test("event id: deterministic per booking and valid for Google (base32hex a-v, 0-9)", () => {
  const id = googleEventIdForBooking("FC4EE04B-045d-497c-8400-c16b428602a1");
  assert.equal(id, "hffc4ee04b045d497c8400c16b428602a1");
  assert.match(id, /^[0-9a-v]{5,1024}$/);
  assert.equal(googleEventIdForBooking("fc4ee04b-045d-497c-8400-c16b428602a1"), id);
});

test("event content: concise operational title and useful description, no internal notes", () => {
  const event = buildCalendarEvent({ ...booking(), internal_notes: "PRIVATE NOTE" }, OPTS);
  assert.equal(event.summary, "HF-2026-00023 — Smith — 2 Men + Truck");
  for (const text of ["Booking reference: HF-2026-00023", "Customer: Jane Smith", "Phone: 0400000000", "Email: jane@example.com", "Pickup: 1 Test St Adelaide", "Destination: 2 Test Rd Glenelg", "Package: 2 Men + Truck", "Crew size: 2", "Booking status: confirmed", "Admin: https://www.hfremovalsadelaide.com.au/admin/bookings/fc4ee04b-045d-497c-8400-c16b428602a1"]) {
    assert.ok(event.description.includes(text), text);
  }
  assert.ok(!event.description.includes("PRIVATE NOTE"));
});

test("event time: exactly the booking's stored starts_at/ends_at in Australia/Adelaide — the billing call-out adds no hour", () => {
  const event = buildCalendarEvent(booking(), OPTS);
  assert.deepEqual(event.start, { dateTime: "2026-12-14T18:30:00.000Z", timeZone: "Australia/Adelaide" });
  assert.deepEqual(event.end, { dateTime: "2026-12-14T21:30:00.000Z", timeZone: CALENDAR_TIME_ZONE });
  const hours = (new Date(event.end.dateTime) - new Date(event.start.dateTime)) / 3_600_000;
  assert.equal(hours, 3); // 3-hour job window, not 4
});

test("disabled: without a Google client the outcome is not_applicable and nothing is attempted", async () => {
  assert.deepEqual(await reconcileCalendarEvent(booking(), null, OPTS), { status: "not_applicable" });
});

test("confirm: creates exactly one event and records its id", async () => {
  const cal = fakeCalendar();
  const outcome = await reconcileCalendarEvent(booking(), cal.client, OPTS);
  assert.equal(outcome.status, "synced");
  assert.equal(outcome.eventId, googleEventIdForBooking(booking().id));
  assert.equal(cal.live().length, 1);
});

test("retry after success: updates the same event, never a second one", async () => {
  const cal = fakeCalendar();
  let b = apply(booking(), await reconcileCalendarEvent(booking(), cal.client, OPTS));
  for (let i = 0; i < 3; i += 1) b = apply(b, await reconcileCalendarEvent(b, cal.client, OPTS));
  assert.equal(cal.live().length, 1);
  assert.equal(cal.calls.filter(([op]) => op === "insert").length, 1);
});

test("lost id (insert succeeded but the id wasn't saved): the retry hits 409 and updates — still one event", async () => {
  const cal = fakeCalendar();
  await reconcileCalendarEvent(booking(), cal.client, OPTS); // id "lost": we don't apply the outcome
  const outcome = await reconcileCalendarEvent(booking(), cal.client, OPTS);
  assert.equal(outcome.status, "synced");
  assert.equal(cal.live().length, 1);
  assert.deepEqual(cal.calls.map(([op]) => op), ["insert", "insert", "update"]);
});

test("concurrent syncs for the same booking converge on one event", async () => {
  const cal = fakeCalendar();
  const outcomes = await Promise.all([1, 2, 3].map(() => reconcileCalendarEvent(booking(), cal.client, OPTS)));
  assert.ok(outcomes.every((o) => o.status === "synced"));
  assert.equal(cal.live().length, 1);
});

test("reschedule: moves the SAME event to the new start/end", async () => {
  const cal = fakeCalendar();
  const b = apply(booking(), await reconcileCalendarEvent(booking(), cal.client, OPTS));
  const moved = { ...b, starts_at: "2026-12-20T22:00:00.000Z", ends_at: "2026-12-21T01:00:00.000Z" };
  await reconcileCalendarEvent(moved, cal.client, OPTS);
  assert.equal(cal.live().length, 1);
  const [event] = cal.live();
  assert.equal(event.start.dateTime, "2026-12-20T22:00:00.000Z");
  assert.equal(event.end.dateTime, "2026-12-21T01:00:00.000Z");
});

test("detail update (crew assigned / status change) refreshes the same event's details", async () => {
  const cal = fakeCalendar();
  const b = apply(booking(), await reconcileCalendarEvent(booking(), cal.client, OPTS));
  await reconcileCalendarEvent({ ...b, booking_status: "assigned" }, cal.client, OPTS);
  assert.equal(cal.live().length, 1);
  assert.match(cal.live()[0].description, /Booking status: assigned/);
});

test("cancel: removes the event; a repeat cancel/retry is harmless (already gone = done)", async () => {
  const cal = fakeCalendar();
  const b = apply(booking(), await reconcileCalendarEvent(booking(), cal.client, OPTS));
  const cancelled = { ...b, booking_status: "cancelled" };
  assert.equal((await reconcileCalendarEvent(cancelled, cal.client, OPTS)).status, "synced");
  assert.equal(cal.live().length, 0);
  assert.equal((await reconcileCalendarEvent(cancelled, cal.client, OPTS)).status, "synced");
  assert.equal(cal.events.size, 1); // never a second event
});

test("held bookings are not mirrored yet", async () => {
  const cal = fakeCalendar();
  assert.deepEqual(await reconcileCalendarEvent(booking({ booking_status: "held" }), cal.client, OPTS), { status: "skipped" });
  assert.equal(cal.calls.length, 0);
});

test("failure: reported as failed with a friendly message — the booking itself is untouched", async () => {
  const cal = fakeCalendar({ failWith: apiError(503) });
  const outcome = await reconcileCalendarEvent(booking(), cal.client, OPTS);
  assert.equal(outcome.status, "failed");
  assert.equal(outcome.error, "Google Calendar is temporarily unavailable. Retry in a few minutes.");
});

test("friendly errors never echo raw OAuth/API text", () => {
  const oauth = Object.assign(new Error("invalid_grant: Token has been expired or revoked. refresh_token=1//secret"), {});
  const msg = friendlyCalendarError(oauth);
  assert.match(msg, /authorisation has expired/);
  assert.ok(!msg.includes("secret") && !msg.includes("refresh_token"));
  assert.match(friendlyCalendarError(apiError(403)), /No permission/);
  assert.match(friendlyCalendarError(apiError(404)), /GOOGLE_CALENDAR_ID/);
  assert.match(friendlyCalendarError(new Error("weird")), /Google Calendar sync failed/);
});

test("wiring: every booking write path reconciles the Google event, and failures never block the write", async () => {
  const detail = await read("app/admin/(protected)/bookings/[id]/actions.ts");
  const list = await read("app/admin/actions.ts");
  // status transitions (incl. cancel), reschedule, finalise, retry
  assert.equal((detail.match(/await reconcileBookingCalendar\(bookingId\)\.catch\(\(\) => \{\}\)/g) ?? []).length, 4);
  // vehicle, crew, cancel from the list
  assert.equal((list.match(/reconcileBookingCalendar\(bookingId\)\.catch\(\(\) => \{\}\)/g) ?? []).length, 3);
  const confirm = await read("app/api/booking/confirm/route.ts");
  assert.match(confirm, /syncCalendar: syncBookingToCalendar/);
});

test("secrets: Google credentials are only read in server-only code", async () => {
  const server = await read("lib/server/google-calendar.ts");
  assert.match(server, /^import "server-only";/);
  const pure = await read("lib/calendar-sync.ts");
  assert.doesNotMatch(pure, /process\.env/);
  assert.doesNotMatch(await read("app/admin/(protected)/bookings/[id]/CalendarSyncStatus.tsx"), /process\.env|GOOGLE_CLIENT|REFRESH_TOKEN/);
});
