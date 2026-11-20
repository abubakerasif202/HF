import { ADMIN_TIME_ZONE, adelaideYmd } from "./dates.ts";
import { zonedWallTimeToInstant } from "../booking/timezone.ts";

/**
 * Pure aggregation helpers for /admin/reports. No I/O and no server-only
 * imports so they can be unit tested directly. Every figure is derived from
 * rows the caller loaded from the database; nothing is estimated or invented.
 * Money stays in integer cents.
 */

/* ------------------------------------------------------------ Date range */

export const RANGE_PRESETS = ["this_week", "this_month", "last_month", "custom"] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

export const PRESET_LABELS: Record<RangePreset, string> = {
  this_week: "This week",
  this_month: "This month",
  last_month: "Last month",
  custom: "Custom",
};

export interface ReportRange {
  preset: RangePreset;
  /** Inclusive Adelaide calendar dates, YYYY-MM-DD. */
  fromYmd: string;
  toYmd: string;
  /** Inclusive start / exclusive end as exact UTC instants (ISO). */
  start: string;
  end: string;
  label: string;
  /** Set when the requested range was invalid and a default was used instead. */
  notice?: string;
}

const YMD_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MAX_CUSTOM_DAYS = 366;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatYmd(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Parses a strictly valid calendar date; returns null for anything else (e.g. 2026-02-30). */
export function parseYmd(value: string | null | undefined): { year: number; month: number; day: number } | null {
  const match = YMD_PATTERN.exec(value ?? "");
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return { year, month, day };
}

export function addDaysYmd(ymd: string, days: number): string {
  const parts = parseYmd(ymd);
  if (!parts) throw new Error(`Invalid date: ${ymd}`);
  const moved = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return formatYmd(moved.getUTCFullYear(), moved.getUTCMonth() + 1, moved.getUTCDate());
}

/** Whole calendar days from a to b (b later = positive). */
export function daysBetweenYmd(a: string, b: string): number {
  const pa = parseYmd(a);
  const pb = parseYmd(b);
  if (!pa || !pb) return 0;
  return Math.round((Date.UTC(pb.year, pb.month - 1, pb.day) - Date.UTC(pa.year, pa.month - 1, pa.day)) / 86_400_000);
}

function ymdStartInstant(ymd: string): Date {
  const parts = parseYmd(ymd);
  if (!parts) throw new Error(`Invalid date: ${ymd}`);
  return zonedWallTimeToInstant(parts.year, parts.month, parts.day, 0, 0, ADMIN_TIME_ZONE);
}

function buildRange(preset: RangePreset, fromYmd: string, toYmd: string, label: string, notice?: string): ReportRange {
  return {
    preset,
    fromYmd,
    toYmd,
    start: ymdStartInstant(fromYmd).toISOString(),
    end: ymdStartInstant(addDaysYmd(toYmd, 1)).toISOString(),
    label,
    ...(notice ? { notice } : {}),
  };
}

function monthRange(preset: "this_month" | "last_month", todayYmd: string): ReportRange {
  const today = parseYmd(todayYmd)!;
  const first = new Date(Date.UTC(today.year, today.month - 1 + (preset === "last_month" ? -1 : 0), 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0));
  const from = formatYmd(first.getUTCFullYear(), first.getUTCMonth() + 1, 1);
  const to = formatYmd(last.getUTCFullYear(), last.getUTCMonth() + 1, last.getUTCDate());
  return buildRange(preset, from, to, PRESET_LABELS[preset]);
}

/** Weeks run Monday to Sunday. */
function weekRange(todayYmd: string): ReportRange {
  const today = parseYmd(todayYmd)!;
  const weekday = new Date(Date.UTC(today.year, today.month - 1, today.day)).getUTCDay();
  const sinceMonday = (weekday + 6) % 7;
  const from = addDaysYmd(todayYmd, -sinceMonday);
  return buildRange("this_week", from, addDaysYmd(from, 6), PRESET_LABELS.this_week);
}

export function resolveReportRange(
  input: { range?: string | null; from?: string | null; to?: string | null },
  now: Date = new Date(),
): ReportRange {
  const todayYmd = adelaideYmd(now);
  const preset = (RANGE_PRESETS as readonly string[]).includes(input.range ?? "") ? (input.range as RangePreset) : "this_month";
  if (preset === "this_week") return weekRange(todayYmd);
  if (preset === "last_month") return monthRange("last_month", todayYmd);
  if (preset === "this_month") return monthRange("this_month", todayYmd);

  const from = parseYmd(input.from);
  const to = parseYmd(input.to);
  if (!from || !to) {
    return { ...monthRange("this_month", todayYmd), notice: "Choose a valid start and end date for a custom range. Showing this month instead." };
  }
  const fromYmd = formatYmd(from.year, from.month, from.day);
  const toYmd = formatYmd(to.year, to.month, to.day);
  if (daysBetweenYmd(fromYmd, toYmd) < 0) {
    return { ...monthRange("this_month", todayYmd), notice: "The end date is before the start date. Showing this month instead." };
  }
  if (daysBetweenYmd(fromYmd, toYmd) >= MAX_CUSTOM_DAYS) {
    return { ...monthRange("this_month", todayYmd), notice: `Custom ranges are limited to ${MAX_CUSTOM_DAYS} days. Showing this month instead.` };
  }
  return buildRange("custom", fromYmd, toYmd, `${fromYmd} to ${toYmd}`);
}

/* ------------------------------------------------------------- Counting */

export interface CountRow {
  key: string;
  label: string;
  count: number;
}

export function humanise(value: string): string {
  const text = value.replace(/_/g, " ").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "Not recorded";
}

/** Counts rows by key. Known keys keep their given order; any others follow, busiest first. */
export function countBy<T>(rows: readonly T[], keyOf: (row: T) => string | null | undefined, order: readonly string[] = [], labelOf: (key: string) => string = humanise): CountRow[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = (keyOf(row) ?? "").trim() || "unspecified";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const known = order.filter((key) => counts.has(key));
  const rest = [...counts.keys()].filter((key) => !order.includes(key)).sort((a, b) => (counts.get(b)! - counts.get(a)!) || a.localeCompare(b));
  return [...known, ...rest].map((key) => ({ key, label: key === "unspecified" ? "Not recorded" : labelOf(key), count: counts.get(key)! }));
}

export const BOOKING_STATUS_ORDER = ["held", "pending_payment", "confirmed", "assigned", "in_progress", "completed", "cancelled", "expired", "draft"] as const;

export interface BookingReportRow {
  booking_status: string | null;
  package_id: string | null;
  truck_class: string | null;
}

export interface BookingSummary {
  total: number;
  completed: number;
  byStatus: CountRow[];
  byPackage: CountRow[];
  byTruckClass: CountRow[];
}

export function summariseBookings(rows: readonly BookingReportRow[]): BookingSummary {
  return {
    total: rows.length,
    completed: rows.filter((row) => row.booking_status === "completed").length,
    byStatus: countBy(rows, (row) => row.booking_status, BOOKING_STATUS_ORDER),
    byPackage: countBy(rows, (row) => row.package_id),
    byTruckClass: countBy(rows, (row) => row.truck_class),
  };
}

/* -------------------------------------------------------------- Invoices */

export interface InvoiceReportRow {
  id: string;
  status: string;
  total_cents: number | null;
  issue_date: string | null;
  due_date: string | null;
}

export interface PaymentReportRow {
  invoice_id: string;
  kind: string;
  amount_cents: number;
}

/** Net received per invoice: payments and deposits add, reversals subtract (mirrors invoice_paid_cents()). */
export function netPaidByInvoice(payments: readonly PaymentReportRow[]): Map<string, number> {
  const paid = new Map<string, number>();
  for (const payment of payments) {
    const signed = payment.kind === "reversal" ? -payment.amount_cents : payment.amount_cents;
    paid.set(payment.invoice_id, (paid.get(payment.invoice_id) ?? 0) + signed);
  }
  return paid;
}

export interface InvoiceSummary {
  invoiceCount: number;
  invoicedCents: number;
  paidCents: number;
  outstandingCents: number;
}

/** Totals for issued invoices only (drafts and voids never count as invoiced). */
export function summariseInvoices(invoices: readonly InvoiceReportRow[], payments: readonly PaymentReportRow[]): InvoiceSummary {
  const paidBy = netPaidByInvoice(payments);
  let invoiced = 0;
  let paid = 0;
  let outstanding = 0;
  let count = 0;
  for (const invoice of invoices) {
    if (invoice.status !== "issued") continue;
    const total = invoice.total_cents ?? 0;
    const received = Math.max(0, paidBy.get(invoice.id) ?? 0);
    count += 1;
    invoiced += total;
    paid += Math.min(received, total);
    outstanding += Math.max(0, total - received);
  }
  return { invoiceCount: count, invoicedCents: invoiced, paidCents: paid, outstandingCents: outstanding };
}

export const AGING_BUCKETS = ["0–30 days", "31–60 days", "Over 60 days"] as const;

export interface AgingBucket {
  label: string;
  count: number;
  outstandingCents: number;
}

/** Outstanding issued invoices bucketed by days since the issue date. */
export function agingBuckets(invoices: readonly InvoiceReportRow[], payments: readonly PaymentReportRow[], todayYmd: string): AgingBucket[] {
  const paidBy = netPaidByInvoice(payments);
  const buckets: AgingBucket[] = AGING_BUCKETS.map((label) => ({ label, count: 0, outstandingCents: 0 }));
  for (const invoice of invoices) {
    if (invoice.status !== "issued" || !invoice.issue_date) continue;
    const outstanding = Math.max(0, (invoice.total_cents ?? 0) - Math.max(0, paidBy.get(invoice.id) ?? 0));
    if (outstanding === 0) continue;
    const age = Math.max(0, daysBetweenYmd(invoice.issue_date, todayYmd));
    const bucket = buckets[age <= 30 ? 0 : age <= 60 ? 1 : 2];
    bucket.count += 1;
    bucket.outstandingCents += outstanding;
  }
  return buckets;
}

/* ---------------------------------------------------------------- Quotes */

export interface QuoteReportRow {
  created_at: string;
  quote_status: string;
  payload: unknown;
  first_response_at?: string | null;
  quoted_amount_cents?: number | null;
  lost_reason?: string | null;
  booking_id?: string | null;
}

export interface FunnelStage {
  key: string;
  label: string;
  count: number;
  /** Share of received enquiries, 0-100 (whole percent). */
  percent: number;
}

const QUOTED_STATUSES = ["quote_sent", "booked", "completed"];
const BOOKED_STATUSES = ["booked", "completed"];

export function percentOf(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

/**
 * received -> responded -> quoted -> booked, plus lost as a separate outcome.
 * A stage counts a row when either the Phase 2 column or the status proves it,
 * so the funnel stays meaningful before and after those columns exist.
 */
export function quoteFunnel(rows: readonly QuoteReportRow[]): FunnelStage[] {
  const received = rows.length;
  const responded = rows.filter((row) => row.quote_status !== "new" || Boolean(row.first_response_at)).length;
  const quoted = rows.filter((row) => (row.quoted_amount_cents ?? null) !== null || QUOTED_STATUSES.includes(row.quote_status)).length;
  const booked = rows.filter((row) => Boolean(row.booking_id) || BOOKED_STATUSES.includes(row.quote_status)).length;
  const lost = rows.filter((row) => row.quote_status === "lost").length;
  return [
    { key: "received", label: "Received", count: received },
    { key: "responded", label: "Responded", count: responded },
    { key: "quoted", label: "Quoted", count: quoted },
    { key: "booked", label: "Booked", count: booked },
    { key: "lost", label: "Lost", count: lost },
  ].map((stage) => ({ ...stage, percent: percentOf(stage.count, received) }));
}

export const LOST_REASON_LABELS: Record<string, string> = {
  price: "Price",
  date_unavailable: "Date unavailable",
  no_response: "No response",
  went_elsewhere: "Went elsewhere",
  other: "Other",
};

export function lostReasons(rows: readonly QuoteReportRow[]): CountRow[] {
  return countBy(
    rows.filter((row) => row.quote_status === "lost"),
    (row) => row.lost_reason,
    Object.keys(LOST_REASON_LABELS),
    (key) => LOST_REASON_LABELS[key] ?? humanise(key),
  );
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Median hours from receipt to first response, over enquiries that have a recorded response. */
export function medianFirstResponseHours(rows: readonly QuoteReportRow[]): number | null {
  const hours: number[] = [];
  for (const row of rows) {
    if (!row.first_response_at) continue;
    const elapsed = new Date(row.first_response_at).getTime() - new Date(row.created_at).getTime();
    if (Number.isFinite(elapsed) && elapsed >= 0) hours.push(elapsed / 3_600_000);
  }
  return median(hours);
}

export function formatDurationHours(hours: number | null): string {
  if (hours === null) return "No responses recorded";
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 48) return `${Math.round(hours * 10) / 10} h`;
  return `${Math.round((hours / 24) * 10) / 10} days`;
}

/** Normalises a stored source_page to a path ("https://x.com/a/b?c=1" -> "/a/b"). */
export function normaliseSourcePage(value: unknown): string {
  if (typeof value !== "string") return "unspecified";
  const trimmed = value.trim().slice(0, 300);
  if (!trimmed) return "unspecified";
  let path = trimmed;
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      path = new URL(trimmed).pathname;
    } catch {
      path = trimmed;
    }
  }
  path = path.split(/[?#]/)[0] || "/";
  if (!path.startsWith("/")) path = `/${path}`;
  return path.length > 1 ? path.replace(/\/+$/, "") || "/" : path;
}

function sourcePageOf(row: QuoteReportRow): string {
  const payload = row.payload;
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return normaliseSourcePage((payload as Record<string, unknown>).source_page);
  }
  return "unspecified";
}

/** Enquiries per originating page, busiest first, capped so the chart stays readable. */
export function enquiriesBySourcePage(rows: readonly QuoteReportRow[], limit = 12): { rows: CountRow[]; otherCount: number } {
  const all = countBy(rows, sourcePageOf, [], (key) => key);
  const known = all.filter((row) => row.key !== "unspecified");
  const unknown = all.filter((row) => row.key === "unspecified");
  const ranked = [...known, ...unknown];
  const shown = ranked.slice(0, limit);
  return { rows: shown, otherCount: ranked.slice(limit).reduce((sum, row) => sum + row.count, 0) };
}

/* ------------------------------------------------------ Missing columns */

/**
 * True when a Supabase/PostgREST error means "this column does not exist yet"
 * (Phase 2 migration not applied). Lets the quote funnel degrade instead of failing.
 */
export function isMissingColumnError(error: { code?: string | null; message?: string | null } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === "42703" || error.code === "PGRST204") return true;
  return /column .* does not exist|could not find the .* column/i.test(error.message ?? "");
}
