import { zonedWallTimeToInstant, instantToZonedParts } from "./timezone.ts";

export type CalendarView = "day" | "week" | "month";

export interface DateRange {
  start: Date;
  end: Date;
}

/** Midnight-to-midnight range for a single Adelaide calendar day. */
export function getDayRange(year: number, month1To12: number, day: number, timeZone: string): DateRange {
  const start = zonedWallTimeToInstant(year, month1To12, day, 0, 0, timeZone);
  const end = zonedWallTimeToInstant(year, month1To12, day, 23, 59, timeZone);
  return { start, end: new Date(end.getTime() + 60_000) }; // push to the exact next-midnight boundary
}

/**
 * Monday-to-Sunday week range containing the given date, in the business
 * timezone. Monday-start matches AU business-week convention (not the
 * JS/US Sunday-start default).
 */
export function getWeekRange(year: number, month1To12: number, day: number, timeZone: string): DateRange {
  const anchor = zonedWallTimeToInstant(year, month1To12, day, 12, 0, timeZone); // noon avoids DST-boundary edge cases
  const { weekday } = instantToZonedParts(anchor, timeZone);
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday; // Sunday(0) -> -6, Monday(1) -> 0, ... Saturday(6) -> -5
  const mondayInstant = new Date(anchor.getTime() + mondayOffset * 24 * 60 * 60_000);
  const mondayParts = instantToZonedParts(mondayInstant, timeZone);
  const { start } = getDayRange(mondayParts.year, mondayParts.month, mondayParts.day, timeZone);
  const sundayInstant = new Date(mondayInstant.getTime() + 6 * 24 * 60 * 60_000);
  const sundayParts = instantToZonedParts(sundayInstant, timeZone);
  const { end } = getDayRange(sundayParts.year, sundayParts.month, sundayParts.day, timeZone);
  return { start, end };
}

/** Calendar-month range (1st through last day) in the business timezone. */
export function getMonthRange(year: number, month1To12: number, timeZone: string): DateRange {
  const start = zonedWallTimeToInstant(year, month1To12, 1, 0, 0, timeZone);
  // Day 0 of next month = last day of this month.
  const nextMonth = month1To12 === 12 ? 1 : month1To12 + 1;
  const nextMonthYear = month1To12 === 12 ? year + 1 : year;
  const { end } = getDayRange(nextMonthYear, nextMonth, 0, timeZone);
  return { start, end };
}

export function getRangeForView(view: CalendarView, year: number, month1To12: number, day: number, timeZone: string): DateRange {
  if (view === "day") return getDayRange(year, month1To12, day, timeZone);
  if (view === "week") return getWeekRange(year, month1To12, day, timeZone);
  return getMonthRange(year, month1To12, timeZone);
}

export type BlockedTimeScope = "global" | "vehicle" | "crew";

/**
 * Classifies a blocked_times row for calendar display. Mirrors the fix in
 * lib/server/booking-repo.ts getBlockedIntervals: a row is only a GLOBAL
 * business closure when both vehicle_id and crew_id are null. A crew-only
 * block (crew_id set, vehicle_id null) must never be rendered/treated as
 * closing the whole business.
 */
export function classifyBlockedTime(row: { vehicleId: string | null; crewId: string | null }): BlockedTimeScope {
  if (row.vehicleId) return "vehicle";
  if (row.crewId) return "crew";
  return "global";
}
