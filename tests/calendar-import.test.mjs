import assert from "node:assert/strict";
import test from "node:test";
import * as importer from "../lib/calendar-import.ts";

const timeMin = "2026-11-19T13:30:00.000Z";
const timeMax = "2026-11-20T13:30:00.000Z";
const timed = (id, start = "2026-11-20T08:00:00+10:30", end = "2026-11-20T10:00:00+10:30") => ({ id, start: { dateTime: start }, end: { dateTime: end } });
function fake(overrides = {}) {
  const saves = [];
  const gets = [];
  return {
    saves, gets,
    adapter: {
      list: async () => ({ items: [] }),
      loadExisting: async () => ["moved"],
      get: async (id) => { gets.push(id); return timed(id, "2026-11-21T08:00:00+10:30", "2026-11-21T10:00:00+10:30"); },
      save: async (events) => { saves.push(events); },
      ...overrides,
    },
  };
}

test("empty day re-fetches moved stored events before saving their new dates", async () => {
  const state = fake();
  assert.equal(await importer.reconcileCalendarImport(timeMin, timeMax, state.adapter), 1);
  assert.deepEqual(state.gets, ["moved"]);
  assert.equal(state.saves[0][0].startsAt, "2026-11-20T21:30:00.000Z");
});

test("missing deleted events retire only their own IDs on 404 or 410", async () => {
  for (const status of [404, 410]) {
    const state = fake({ get: async () => { throw Object.assign(new Error("gone"), { response: { status } }); } });
    await importer.reconcileCalendarImport(timeMin, timeMax, state.adapter);
    assert.equal(state.saves[0][0].eventId, "moved");
    assert.equal(state.saves[0][0].status, "cancelled");
  }
});

test("transient missing-event errors preserve all persisted events", async () => {
  const state = fake({ get: async () => { throw Object.assign(new Error("rate limited"), { code: 429 }); } });
  await assert.rejects(importer.reconcileCalendarImport(timeMin, timeMax, state.adapter), /rate limited/);
  assert.equal(state.saves.length, 0);
});

test("all pages finish before persistence and page failures save nothing", async () => {
  const tokens = [];
  const state = fake({ list: async (token) => {
    tokens.push(token);
    if (!token) return { items: [timed("first")], nextPageToken: "page-2" };
    throw new Error("page failure");
  } });
  await assert.rejects(importer.reconcileCalendarImport(timeMin, timeMax, state.adapter), /page failure/);
  assert.deepEqual(tokens, [undefined, "page-2"]);
  assert.equal(state.saves.length, 0);
});

test("paginated imports deduplicate events and skip HF-authored mirror events", async () => {
  const state = fake({ loadExisting: async () => [], list: async (token) => token
    ? { items: [timed("external"), timed(`hf${"a".repeat(32)}`)] }
    : { items: [timed("external")], nextPageToken: "next" } });
  assert.equal(await importer.reconcileCalendarImport(timeMin, timeMax, state.adapter), 1);
  assert.equal(state.saves.length, 1);
  assert.deepEqual(state.saves[0].map((event) => event.eventId), ["external"]);
});

test("all-day moved events keep dates without invented times or details", async () => {
  const state = fake({ get: async (id) => ({ id, start: { date: "2026-11-22" }, end: { date: "2026-11-24" } }) });
  await importer.reconcileCalendarImport(timeMin, timeMax, state.adapter);
  assert.equal(state.saves[0][0].allDayStart, "2026-11-22");
  assert.equal(state.saves[0][0].allDayEnd, "2026-11-24");
  assert.equal(state.saves[0][0].startsAt, null);
  assert.equal(state.saves[0][0].summary, null);
});

test("Adelaide range dates include all-day events across UTC midnight and DST", () => {
  assert.deepEqual(importer.calendarImportDateRange(timeMin, timeMax), { startDate: "2026-11-20", endDate: "2026-11-21" });
  assert.deepEqual(importer.calendarImportDateRange("2026-10-03T14:30:00.000Z", "2026-10-04T13:30:00.000Z"), { startDate: "2026-10-04", endDate: "2026-10-05" });
});

test("missing-event identity mismatch and page limit preserve stored rows", async () => {
  const mismatched = fake({ get: async () => timed("different") });
  await assert.rejects(importer.reconcileCalendarImport(timeMin, timeMax, mismatched.adapter), /identity/);
  assert.equal(mismatched.saves.length, 0);
  const endless = fake({ list: async () => ({ nextPageToken: "again" }) });
  await assert.rejects(importer.reconcileCalendarImport(timeMin, timeMax, endless.adapter), /page limit/);
  assert.equal(endless.saves.length, 0);
});

test("returned active and cancelled events retain their previous normalization behavior", async () => {
  const state = fake({
    loadExisting: async () => ["known"],
    list: async () => ({ items: [{ ...timed("known"), summary: "  External event  " }, { id: "cancelled", status: "cancelled" }] }),
    get: async () => { throw new Error("Returned events must not be re-fetched"); },
  });
  await importer.reconcileCalendarImport(timeMin, timeMax, state.adapter);
  assert.equal(state.saves[0][0].summary, "External event");
  assert.equal(state.saves[0][0].startsAt, "2026-11-19T21:30:00.000Z");
  assert.equal(state.saves[0][1].status, "cancelled");
  assert.equal(state.saves[0][1].startsAt, null);
});

test("persistence failures remain visible to the caller", async () => {
  const state = fake({ save: async () => { throw new Error("database unavailable"); } });
  await assert.rejects(importer.reconcileCalendarImport(timeMin, timeMax, state.adapter), /database unavailable/);
});
