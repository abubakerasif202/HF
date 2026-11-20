import { parseHm, zonedWallTimeToInstant } from "../booking/timezone.ts";
import { ADMIN_TIME_ZONE, adelaideDay, adelaideYmd } from "./dates.ts";

/** Pure (server + client safe) rules for the quote-enquiry CRM. */

export const QUOTE_STATUS_VALUES = ["new", "quote_sent", "follow_up", "booked", "completed", "lost"] as const;
export type QuoteStatusValue = (typeof QUOTE_STATUS_VALUES)[number];

/** Statuses where an enquiry still needs the owner's attention. */
export const OPEN_QUOTE_STATUSES = ["new", "quote_sent", "follow_up"] as const;

export const LOST_REASONS = [
  { value: "price", label: "Price" },
  { value: "date_unavailable", label: "Date unavailable" },
  { value: "no_response", label: "No response" },
  { value: "went_elsewhere", label: "Went elsewhere" },
  { value: "other", label: "Other" },
] as const;
export type LostReason = (typeof LOST_REASONS)[number]["value"];
export const LOST_REASON_VALUES = LOST_REASONS.map((reason) => reason.value) as [LostReason, ...LostReason[]];

export const QUOTE_NOTES_MAX = 4000;
/** Integer cents. Guards against typos; well above any real removal job. */
export const QUOTED_AMOUNT_MAX_CENTS = 10_000_000;
export const BULK_MAX_IDS = 100;

/** The default business window used when settings are unavailable. */
export const DEFAULT_OPEN_HM = "08:00";
export const DEFAULT_CLOSE_HM = "18:00";

const AMBER_AFTER_BUSINESS_MINUTES = 4 * 60;
const RED_AFTER_MS = 24 * 60 * 60_000;
/** A date picker has no time of day; follow-ups are stored at 9am Adelaide on the chosen date. */
const FOLLOW_UP_HOUR = 9;

export function isQuoteStatus(value: unknown): value is QuoteStatusValue {
  return typeof value === "string" && (QUOTE_STATUS_VALUES as readonly string[]).includes(value);
}

export function isOpenStatus(status: string): boolean {
  return (OPEN_QUOTE_STATUSES as readonly string[]).includes(status);
}

/** Minutes of business-window time (open..close, Adelaide) that fall between two instants. */
export function businessMinutesBetween(from: Date, to: Date, openHm: string, closeHm: string, timeZone: string = ADMIN_TIME_ZONE): number {
  if (!(to.getTime() > from.getTime())) return 0;
  const open = parseHm(openHm);
  const close = parseHm(closeHm);
  if (![open.hour, open.minute, close.hour, close.minute].every(Number.isFinite)) return 0;
  const [startYear, startMonth, startDay] = adelaideYmd(from).split("-").map(Number);
  let total = 0;
  // Bounded loop: an enquiry is never older than a few hundred days.
  for (let offset = 0; offset < 400; offset += 1) {
    const day = new Date(Date.UTC(startYear, startMonth - 1, startDay + offset));
    const windowStart = zonedWallTimeToInstant(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), open.hour, open.minute, timeZone);
    if (windowStart.getTime() >= to.getTime()) break;
    const windowEnd = zonedWallTimeToInstant(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), close.hour, close.minute, timeZone);
    const overlapStart = Math.max(windowStart.getTime(), from.getTime());
    const overlapEnd = Math.min(windowEnd.getTime(), to.getTime());
    if (overlapEnd > overlapStart) total += (overlapEnd - overlapStart) / 60_000;
  }
  return Math.round(total);
}

/** "12 m", "2 h", "3 d". */
export function formatAge(from: Date, to: Date): string {
  const minutes = Math.max(0, Math.round((to.getTime() - from.getTime()) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  return `${Math.floor(hours / 24)} d`;
}

export type ResponseLevel = "none" | "ok" | "amber" | "red";

export interface ResponseBadge {
  level: ResponseLevel;
  /** Short age text, e.g. "2 h". */
  age: string;
  /** Full label for the badge, e.g. "Waiting 2 h" or "Replied in 3 h". */
  label: string;
}

/**
 * Age and response badge. Amber after 4 business hours with no response, red after 24 h
 * (wall clock). first_response_at is set the first time the status leaves "new".
 */
export function responseBadge(input: {
  createdAt: string;
  firstResponseAt: string | null;
  status: string;
  now?: Date;
  openHm?: string;
  closeHm?: string;
}): ResponseBadge {
  const now = input.now ?? new Date();
  const created = new Date(input.createdAt);
  const age = formatAge(created, now);
  if (input.firstResponseAt) {
    const replied = formatAge(created, new Date(input.firstResponseAt));
    return { level: "none", age, label: replied === "Just now" ? "Replied at once" : `Replied in ${replied}` };
  }
  if (input.status !== "new") return { level: "none", age, label: age };
  let level: ResponseLevel = "ok";
  if (now.getTime() - created.getTime() >= RED_AFTER_MS) level = "red";
  else if (businessMinutesBetween(created, now, input.openHm ?? DEFAULT_OPEN_HM, input.closeHm ?? DEFAULT_CLOSE_HM) >= AMBER_AFTER_BUSINESS_MINUTES) level = "amber";
  return { level, age, label: `Waiting ${age}` };
}

export type FollowUpState = "none" | "upcoming" | "due" | "overdue";

/** due = today or earlier (Adelaide day); overdue = before today. Closed enquiries never count. */
export function followUpState(followUpAt: string | null, status: string, now: Date = new Date()): FollowUpState {
  if (!followUpAt || !isOpenStatus(status)) return "none";
  const at = new Date(followUpAt).getTime();
  const today = adelaideDay(0, now);
  if (at < new Date(today.start).getTime()) return "overdue";
  if (at < new Date(today.end).getTime()) return "due";
  return "upcoming";
}

export type StatusTotals = Record<QuoteStatusValue, number>;

export interface QuoteSummary {
  counts: StatusTotals;
  /** Open enquiries whose follow-up date is today or earlier (includes overdue). */
  due: number;
  /** Open enquiries whose follow-up date is before today. */
  overdue: number;
}

export function summariseQuotes(rows: { quote_status: string; follow_up_at: string | null }[], now: Date = new Date()): QuoteSummary {
  const counts = Object.fromEntries(QUOTE_STATUS_VALUES.map((status) => [status, 0])) as StatusTotals;
  let due = 0;
  let overdue = 0;
  for (const row of rows) {
    if (isQuoteStatus(row.quote_status)) counts[row.quote_status] += 1;
    const state = followUpState(row.follow_up_at, row.quote_status, now);
    if (state === "overdue") {
      overdue += 1;
      due += 1;
    } else if (state === "due") {
      due += 1;
    }
  }
  return { counts, due, overdue };
}

export function isValidYmd(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** The stored instant for a chosen follow-up date (9am Adelaide on that date). */
export function followUpInstant(ymd: string): string {
  const [year, month, day] = ymd.split("-").map(Number);
  return zonedWallTimeToInstant(year, month, day, FOLLOW_UP_HOUR, 0, ADMIN_TIME_ZONE).toISOString();
}

/** The Adelaide calendar date (YYYY-MM-DD) a stored follow-up refers to; "" when unset. */
export function followUpYmd(followUpAt: string | null | undefined): string {
  return followUpAt ? adelaideYmd(followUpAt) : "";
}

/** "123", "123.4", "1,234.50" -> cents. Empty -> null. Anything else -> "invalid". */
export function parseDollarsToCents(text: string): number | null | "invalid" {
  const cleaned = text.trim().replace(/^\$/, "").replace(/,/g, "");
  if (cleaned === "") return null;
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(cleaned)) return "invalid";
  const [dollars, fraction = ""] = cleaned.split(".");
  const cents = Number(dollars) * 100 + Number(fraction.padEnd(2, "0"));
  return cents > QUOTED_AMOUNT_MAX_CENTS ? "invalid" : cents;
}

export function formatCentsAsDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

export interface StatusChangeCurrent {
  quote_status: string;
  first_response_at: string | null;
}

/**
 * Column changes for moving an enquiry to `next`. first_response_at is stamped the first time
 * the status leaves "new" and never cleared. lost_reason only survives while the status is lost.
 */
export function statusChangeFields(current: StatusChangeCurrent, next: QuoteStatusValue, nowIso: string, lostReason: LostReason | null = null): Record<string, unknown> {
  const fields: Record<string, unknown> = { quote_status: next, status_changed_at: nowIso, lost_reason: next === "lost" ? lostReason : null };
  if (!current.first_response_at && current.quote_status === "new" && next !== "new") fields.first_response_at = nowIso;
  return fields;
}

type PayloadValue = string | string[] | undefined;

function text(payload: Record<string, PayloadValue> | null | undefined, key: string): string {
  const value = payload?.[key];
  return (typeof value === "string" ? value : Array.isArray(value) ? value.join(", ") : "").trim();
}

function longDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))).toLocaleDateString("en-AU", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Plain-text reply to copy to the clipboard. Never sends anything and never states a price. */
export function buildReplyTemplate(payload: Record<string, PayloadValue> | null | undefined): string {
  const name = text(payload, "name");
  const from = text(payload, "moving_from");
  const to = text(payload, "moving_to");
  const date = text(payload, "preferred_moving_date");
  const first = name.split(/\s+/)[0] ?? "";
  const route = from && to ? ` from ${from} to ${to}` : from ? ` from ${from}` : to ? ` to ${to}` : "";
  const when = date ? ` on ${longDate(date)}` : "";
  return [
    first ? `Hi ${first},` : "Hi,",
    "",
    `Thanks for getting in touch with HF Removals Adelaide about your move${route}${when}.`,
    "",
    "[Add your quote or any questions here]",
    "",
    "Kind regards,",
    "HF Removals Adelaide",
  ].join("\n");
}
