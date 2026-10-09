/**
 * Pure helpers + shared types for the operational calendar. No React, no
 * data fetching: everything here is derived from the rows the page loads.
 */
export interface Booking {
  id: string;
  bookingNumber: string;
  startsAt: string;
  endsAt: string;
  status: string;
  crewSize: number;
  packageId: string | null;
  vehicleId: string | null;
  crewId: string | null;
  vehicleName?: string;
  crewName?: string;
  customerName?: string;
}

export interface BlockedTime {
  id: string;
  startsAt: string;
  endsAt: string;
  vehicleId: string | null;
  crewId: string | null;
  reason: string;
  vehicleName?: string;
  crewName?: string;
}

export interface Resource {
  id: string;
  name: string;
}

export type CalendarViewName = "day" | "week" | "month";

export const MINUTES_PER_DAY = 1440;
const DEFAULT_START_HOUR = 7;
const DEFAULT_END_HOUR = 18;

const timeFormatters = new Map<string, Intl.DateTimeFormat>();

function wallClock(timezone: string): Intl.DateTimeFormat {
  let formatter = timeFormatters.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    timeFormatters.set(timezone, formatter);
  }
  return formatter;
}

export function dayKey(iso: string, timezone: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: timezone });
}

export function fmtTime(iso: string, timezone: string): string {
  return new Date(iso).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", timeZone: timezone });
}

/** Minutes since local midnight for an instant, in the business timezone. */
export function minutesOfDay(iso: string, timezone: string): number {
  const parts = wallClock(timezone).formatToParts(new Date(iso));
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

/** The slice of [startsAt, endsAt] that falls on `dateKey`, in minutes from midnight; null when it misses the day. */
export function clipToDay(startsAt: string, endsAt: string, dateKey: string, timezone: string): { from: number; to: number } | null {
  const startKey = dayKey(startsAt, timezone);
  const endKey = dayKey(new Date(new Date(endsAt).getTime() - 1).toISOString(), timezone);
  if (dateKey < startKey || dateKey > endKey) return null;
  const from = startKey === dateKey ? minutesOfDay(startsAt, timezone) : 0;
  if (endKey !== dateKey) return { from, to: MINUTES_PER_DAY };
  const endMinute = minutesOfDay(endsAt, timezone);
  // An end exactly at midnight belongs to the previous day's column; a zero-length span still gets one minute.
  const to = endMinute === 0 ? MINUTES_PER_DAY : Math.max(endMinute, from + 1);
  return { from, to };
}

export interface Placed<T> {
  item: T;
  from: number;
  to: number;
  lane: number;
  lanes: number;
}

/** Side-by-side lane assignment so overlapping jobs share a column instead of stacking on top of each other. */
export function placeInLanes<T>(entries: { item: T; from: number; to: number }[]): Placed<T>[] {
  const sorted = [...entries].sort((a, b) => a.from - b.from || a.to - b.to);
  const placed: Placed<T>[] = [];
  let cluster: Placed<T>[] = [];
  let clusterEnd = -1;
  const laneEnds: number[] = [];

  const closeCluster = () => {
    const lanes = Math.max(laneEnds.length, 1);
    for (const entry of cluster) placed.push({ ...entry, lanes });
    cluster = [];
    laneEnds.length = 0;
  };

  for (const entry of sorted) {
    if (cluster.length > 0 && entry.from >= clusterEnd) closeCluster();
    let lane = laneEnds.findIndex((end) => end <= entry.from);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = entry.to;
    clusterEnd = Math.max(clusterEnd, entry.to);
    cluster.push({ ...entry, lane, lanes: 1 });
  }
  closeCluster();
  return placed;
}

/** Visible hour window: business hours by default, widened to fit anything outside them. */
export function hourWindow(spans: { from: number; to: number }[]): { startHour: number; endHour: number } {
  let startHour = DEFAULT_START_HOUR;
  let endHour = DEFAULT_END_HOUR;
  for (const span of spans) {
    startHour = Math.min(startHour, Math.floor(span.from / 60));
    endHour = Math.max(endHour, Math.ceil(span.to / 60));
  }
  return { startHour: Math.max(0, startHour), endHour: Math.min(24, endHour) };
}

export function hourLabel(hour: number): string {
  if (hour === 0 || hour === 24) return "12 am";
  if (hour === 12) return "12 pm";
  return hour < 12 ? `${hour} am` : `${hour - 12} pm`;
}

/** YYYY-MM-DD arithmetic that never touches the local timezone. */
export function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

export function addMonths(dateKey: string, months: number): string {
  const [y, m] = dateKey.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1 + months, 1));
  return base.toISOString().slice(0, 10);
}

/** Monday = 0 … Sunday = 6, for laying out the month grid. */
export function mondayIndex(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

/** Formats a YYYY-MM-DD key (already a business-timezone calendar date) without any timezone shifting. */
function longDate(dateKey: string, options: Intl.DateTimeFormatOptions): string {
  return new Date(`${dateKey}T12:00:00Z`).toLocaleDateString("en-AU", { ...options, timeZone: "UTC" });
}

/** Editorial title for the toolbar, per view. */
export function rangeTitle(view: CalendarViewName, days: string[], anchor: string): string {
  if (view === "month") return longDate(anchor, { month: "long", year: "numeric" });
  if (view === "day") return longDate(anchor, { weekday: "long", day: "numeric", month: "long" });
  const first = days[0] ?? anchor;
  const last = days[days.length - 1] ?? anchor;
  const sameMonth = first.slice(0, 7) === last.slice(0, 7);
  const start = longDate(first, sameMonth ? { day: "numeric" } : { day: "numeric", month: "short" });
  const end = longDate(last, { day: "numeric", month: "short", year: "numeric" });
  return `${start} – ${end}`;
}

export function longDayLabel(dateKey: string): string {
  return longDate(dateKey, { weekday: "long", day: "numeric", month: "long" });
}

export function shortWeekday(dateKey: string): string {
  return longDate(dateKey, { weekday: "short" });
}

export function dayNumber(dateKey: string): string {
  return String(Number(dateKey.slice(8, 10)));
}

export interface Span<T> {
  item: T;
  from: number;
  to: number;
}

export interface DayData {
  key: string;
  bookings: Span<Booking>[];
  blocks: Span<BlockedTime>[];
}

/** Every business-timezone date key from the range start up to (not including) the range end. */
export function listDays(rangeStartIso: string, rangeEndIso: string, timezone: string): string[] {
  const first = dayKey(rangeStartIso, timezone);
  const last = dayKey(new Date(new Date(rangeEndIso).getTime() - 1).toISOString(), timezone);
  const days: string[] = [];
  for (let key = first; key <= last && days.length < 62; key = addDays(key, 1)) days.push(key);
  return days;
}

function clipAll<T extends { startsAt: string; endsAt: string }>(items: T[], key: string, timezone: string): Span<T>[] {
  const spans: Span<T>[] = [];
  for (const item of items) {
    const clipped = clipToDay(item.startsAt, item.endsAt, key, timezone);
    if (clipped) spans.push({ item, ...clipped });
  }
  return spans.sort((a, b) => a.from - b.from || a.to - b.to);
}

export function buildDayData(days: string[], bookings: Booking[], blocked: BlockedTime[], timezone: string): DayData[] {
  return days.map((key) => ({ key, bookings: clipAll(bookings, key, timezone), blocks: clipAll(blocked, key, timezone) }));
}
