import { instantToZonedParts, zonedWallTimeToInstant } from "../booking/timezone.ts";

export const ADMIN_TIME_ZONE = "Australia/Adelaide";

export interface DayRange {
  /** Inclusive start of the Adelaide calendar day, as an ISO instant. */
  start: string;
  /** Exclusive end (start of the next Adelaide day), as an ISO instant. */
  end: string;
  /** Adelaide calendar date, YYYY-MM-DD. */
  ymd: string;
}

function ymdString(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * The Adelaide calendar day `offsetDays` from `now`, as exact UTC instants.
 * Display/dashboard use only — booking correctness uses lib/booking/timezone.ts directly.
 * Day arithmetic is done on the calendar date (not by adding 24h) so DST changes
 * (23/25-hour days) are handled correctly.
 */
export function adelaideDay(offsetDays: number, now: Date = new Date()): DayRange {
  const today = instantToZonedParts(now, ADMIN_TIME_ZONE);
  const target = new Date(Date.UTC(today.year, today.month - 1, today.day + offsetDays));
  const next = new Date(Date.UTC(today.year, today.month - 1, today.day + offsetDays + 1));
  const start = zonedWallTimeToInstant(target.getUTCFullYear(), target.getUTCMonth() + 1, target.getUTCDate(), 0, 0, ADMIN_TIME_ZONE);
  const end = zonedWallTimeToInstant(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), 0, 0, ADMIN_TIME_ZONE);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
    ymd: ymdString(target.getUTCFullYear(), target.getUTCMonth() + 1, target.getUTCDate()),
  };
}

/** Adelaide calendar date (YYYY-MM-DD) for any instant. */
export function adelaideYmd(instant: Date | string): string {
  const parts = instantToZonedParts(typeof instant === "string" ? new Date(instant) : instant, ADMIN_TIME_ZONE);
  return ymdString(parts.year, parts.month, parts.day);
}

/** Whole Adelaide calendar days from today's date to the instant's date (negative = past). */
export function adelaideDayOffset(instant: Date | string, now: Date = new Date()): number {
  const a = adelaideYmd(instant).split("-").map(Number);
  const b = adelaideYmd(now).split("-").map(Number);
  const diff = Date.UTC(a[0], a[1] - 1, a[2]) - Date.UTC(b[0], b[1] - 1, b[2]);
  return Math.round(diff / 86_400_000);
}
