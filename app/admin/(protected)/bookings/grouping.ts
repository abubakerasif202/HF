import { adelaideDayOffset } from "../../../../lib/admin/dates.ts";

/** Display-only grouping of already-loaded bookings by Adelaide calendar day. */

export type GroupKey = "today" | "tomorrow" | "week" | "later" | "past";

export interface BookingGroup<T> {
  key: GroupKey;
  label: string;
  hint: string;
  rows: T[];
}

const GROUP_ORDER: { key: GroupKey; label: string; hint: string }[] = [
  { key: "today", label: "Today", hint: "Happening today" },
  { key: "tomorrow", label: "Tomorrow", hint: "Next up" },
  { key: "week", label: "Later this week", hint: "Within the next 7 days" },
  { key: "later", label: "Coming up", hint: "Beyond a week out" },
  { key: "past", label: "Past", hint: "Most recent first" },
];

export const LIVE_STATUSES = ["confirmed", "assigned", "in_progress"] as const;
export const INACTIVE_STATUSES = ["cancelled", "expired"] as const;

export function groupKeyFor(startsAt: string, now: Date): GroupKey {
  const offset = adelaideDayOffset(startsAt, now);
  if (offset < 0) return "past";
  if (offset === 0) return "today";
  if (offset === 1) return "tomorrow";
  if (offset < 7) return "week";
  return "later";
}

/** Upcoming groups are soonest-first; "Past" is most-recent-first. Empty groups are dropped. */
export function groupBookings<T extends { starts_at: string }>(rows: T[], now: Date): BookingGroup<T>[] {
  const buckets = new Map<GroupKey, T[]>();
  for (const row of rows) {
    const key = groupKeyFor(row.starts_at, now);
    buckets.set(key, [...(buckets.get(key) ?? []), row]);
  }
  return GROUP_ORDER.flatMap((meta) => {
    const found = buckets.get(meta.key);
    if (!found || found.length === 0) return [];
    const ordered = meta.key === "past" ? [...found].reverse() : found;
    return [{ ...meta, rows: ordered }];
  });
}

export interface BookingSummary {
  today: number;
  upcoming: number;
  needsTruck: number;
  balanceDueCents: number;
  balanceJobs: number;
}

interface SummarisableBooking {
  starts_at: string;
  booking_status: string;
  vehicle_id: string | null;
  balance_due_cents: number;
}

/** Counts derived only from the rows the page loaded — labelled as such in the UI. */
export function summariseBookings(rows: SummarisableBooking[], now: Date): BookingSummary {
  const isInactive = (status: string) => (INACTIVE_STATUSES as readonly string[]).includes(status);
  const isLive = (status: string) => (LIVE_STATUSES as readonly string[]).includes(status);
  const owing = rows.filter((row) => !isInactive(row.booking_status) && row.balance_due_cents > 0);
  return {
    today: rows.filter((row) => !isInactive(row.booking_status) && adelaideDayOffset(row.starts_at, now) === 0).length,
    upcoming: rows.filter((row) => isLive(row.booking_status) && adelaideDayOffset(row.starts_at, now) >= 0).length,
    needsTruck: rows.filter((row) => row.booking_status === "confirmed" && !row.vehicle_id).length,
    balanceDueCents: owing.reduce((sum, row) => sum + row.balance_due_cents, 0),
    balanceJobs: owing.length,
  };
}

const STATUS_ORDER = ["held", "pending_payment", "confirmed", "assigned", "in_progress", "completed", "cancelled", "expired", "draft"];

/** Statuses present in the loaded rows with counts, in lifecycle order. */
export function statusCounts(rows: { booking_status: string }[]): { status: string; count: number }[] {
  const tally = new Map<string, number>();
  for (const row of rows) tally.set(row.booking_status, (tally.get(row.booking_status) ?? 0) + 1);
  const rank = (status: string) => {
    const index = STATUS_ORDER.indexOf(status);
    return index === -1 ? STATUS_ORDER.length : index;
  };
  return [...tally.entries()].map(([status, count]) => ({ status, count })).sort((a, b) => rank(a.status) - rank(b.status));
}
