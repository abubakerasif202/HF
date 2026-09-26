import assert from "node:assert/strict";
import test from "node:test";
import { getDayRange, getWeekRange, getMonthRange, getRangeForView, classifyBlockedTime } from "../lib/booking/calendar-range.ts";
import { instantToZonedParts } from "../lib/booking/timezone.ts";

const TZ = "Australia/Adelaide";

test("calendar: day range spans exactly midnight to midnight in Adelaide time", () => {
  const { start, end } = getDayRange(2026, 3, 10, TZ);
  const startParts = instantToZonedParts(start, TZ);
  const endParts = instantToZonedParts(end, TZ);
  assert.equal(startParts.hour, 0);
  assert.equal(startParts.day, 10);
  assert.equal(endParts.hour, 0);
  assert.equal(endParts.day, 11); // exclusive end = next midnight
});

test("calendar: week range starts Monday and ends Sunday (AU business week)", () => {
  // 2026-03-10 is a Tuesday.
  const { start, end } = getWeekRange(2026, 3, 10, TZ);
  const startParts = instantToZonedParts(start, TZ);
  const endParts = instantToZonedParts(end, TZ);
  assert.equal(startParts.weekday, 1); // Monday
  assert.equal(startParts.day, 9);
  assert.equal(endParts.weekday, 1); // exclusive end = the following Monday midnight
  assert.equal(endParts.day, 16);
});

test("calendar: week range handles a Sunday anchor correctly (wraps back to the same week's Monday)", () => {
  // 2026-03-08 is a Sunday, in the same week as 2026-03-02 (Monday).
  const { start } = getWeekRange(2026, 3, 8, TZ);
  const startParts = instantToZonedParts(start, TZ);
  assert.equal(startParts.weekday, 1);
  assert.equal(startParts.day, 2);
});

test("calendar: week range spans a DST boundary without drifting a day", () => {
  // Adelaide's 2026 ACDT->ACST change falls on Sun 5 Apr, inside the week of Mon 30 Mar - Sun 5 Apr.
  const { start, end } = getWeekRange(2026, 3, 31, TZ);
  const startParts = instantToZonedParts(start, TZ);
  const endParts = instantToZonedParts(end, TZ);
  assert.equal(startParts.day, 30);
  assert.equal(startParts.month, 3);
  assert.equal(endParts.day, 6);
  assert.equal(endParts.month, 4);
});

test("calendar: month range covers the 1st through the day before the 1st of next month", () => {
  const { start, end } = getMonthRange(2026, 4, TZ); // April has 30 days
  const startParts = instantToZonedParts(start, TZ);
  const endParts = instantToZonedParts(end, TZ);
  assert.equal(startParts.day, 1);
  assert.equal(startParts.month, 4);
  assert.equal(endParts.day, 1);
  assert.equal(endParts.month, 5);
});

test("calendar: month range correctly rolls December into January of the next year", () => {
  const { end } = getMonthRange(2026, 12, TZ);
  const endParts = instantToZonedParts(end, TZ);
  assert.equal(endParts.month, 1);
  assert.equal(endParts.year, 2027);
});

test("calendar: getRangeForView dispatches to the matching range function", () => {
  const day = getRangeForView("day", 2026, 3, 10, TZ);
  const week = getRangeForView("week", 2026, 3, 10, TZ);
  const month = getRangeForView("month", 2026, 3, 10, TZ);
  assert.ok(week.end.getTime() - week.start.getTime() > day.end.getTime() - day.start.getTime());
  assert.ok(month.end.getTime() - month.start.getTime() > week.end.getTime() - week.start.getTime());
});

test("calendar: classifies a global block (no vehicle, no crew)", () => {
  assert.equal(classifyBlockedTime({ vehicleId: null, crewId: null }), "global");
});

test("calendar: classifies a vehicle-specific block", () => {
  assert.equal(classifyBlockedTime({ vehicleId: "v1", crewId: null }), "vehicle");
});

test("calendar: a crew-only block is classified as 'crew', never 'global' (regression guard)", () => {
  assert.equal(classifyBlockedTime({ vehicleId: null, crewId: "c1" }), "crew");
});
