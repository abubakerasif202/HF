// Pure Booking Finder helpers (no Next.js / Supabase imports) so the parsing,
// phone normalisation and date-range rules can be unit tested with plain node.
import { zonedWallTimeToInstant } from "./booking/timezone.ts";

export const FINDER_PAGE_SIZE = 20;
export const FINDER_MAX_PAGE_SIZE = 50;
const MAX_QUERY_LENGTH = 100;
const MAX_TOKENS = 8;
const MAX_TOKEN_LENGTH = 64;

export const FINDER_STATUSES = ["draft", "held", "pending_payment", "confirmed", "assigned", "in_progress", "completed", "cancelled", "expired"] as const;
export type FinderStatus = (typeof FINDER_STATUSES)[number];

/**
 * Canonical Australian national digits. "+61 491 704 136", "0061491704136",
 * "61491704136" and "0491 704 136" all become "0491704136". Anything that is
 * not a plausible phone (fewer than 3 digits) returns null. Non-AU shapes are
 * returned as bare digits so they still match what was stored.
 */
export function normalizeAuPhone(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length < 3) return null;
  if (digits.startsWith("0061")) return `0${digits.slice(4)}`;
  if (digits.startsWith("61") && digits.length === 11) return `0${digits.slice(2)}`;
  return digits;
}

/** A query (or token) that is clearly a phone number rather than words. */
function looksLikePhone(value: string): boolean {
  // Booking-reference fragments such as "2026-00042" are digits with a dash too.
  if (/^20\d{2}-\d{2,6}$/.test(value.trim())) return false;
  const compact = value.replace(/[\s\-().]/g, "");
  if (!/^\+?\d+$/.test(compact)) return false;
  const digits = compact.replace(/\D/g, "").length;
  return digits >= 6 && digits <= 15;
}

/** Partial prefixes typed as "+61 4…" are common; keep the +61 form meaningful. */
function normalizePartialPhone(value: string): string | null {
  const compact = value.replace(/[\s\-().]/g, "");
  const plus = compact.startsWith("+");
  let digits = compact.replace(/\D/g, "");
  if (plus || digits.startsWith("0061") || (digits.startsWith("61") && digits.length > 2)) {
    if (digits.startsWith("0061")) digits = digits.slice(4);
    else if (digits.startsWith("61")) digits = digits.slice(2);
    // A national number written after the country code drops its leading 0.
    digits = digits.startsWith("0") ? digits : `0${digits}`;
  }
  return digits.length >= 3 ? digits : null;
}

export interface ParsedFinderQuery {
  tokens: string[];
  reference: string | null;
  phone: string | null;
}

export function parseFinderQuery(input: string | null | undefined): ParsedFinderQuery {
  const query = (input ?? "").normalize("NFKC").replace(/\s+/g, " ").trim().slice(0, MAX_QUERY_LENGTH);
  if (!query) return { tokens: [], reference: null, phone: null };

  if (looksLikePhone(query)) {
    return { tokens: [], reference: null, phone: normalizePartialPhone(query) };
  }

  // A phone typed among other words ("john +61 491 704 136") is one token, not four.
  const phoneTokens: string[] = [];
  const withoutPhones = query.replace(/\+?\(?\d[\d\s().-]{4,}\d/g, (match) => {
    const normalized = looksLikePhone(match.trim()) ? normalizePartialPhone(match) : null;
    if (!normalized) return match;
    phoneTokens.push(normalized);
    return " ";
  });
  const tokens = [
    ...withoutPhones.toLowerCase().split(" ").filter(Boolean),
    ...phoneTokens,
  ]
    .slice(0, MAX_TOKENS)
    .map((token) => (looksLikePhone(token) ? (normalizePartialPhone(token) ?? token) : token).slice(0, MAX_TOKEN_LENGTH));
  const reference = query.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return { tokens, reference: reference.length >= 3 ? reference : null, phone: null };
}

export interface FinderFilters {
  q?: string;
  from?: string;
  to?: string;
  status?: string;
  crewId?: string;
  vehicleId?: string;
  page?: number;
  pageSize?: number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const YMD = /^\d{4}-\d{2}-\d{2}$/;

function parseYmd(value: string): { y: number; m: number; d: number } | null {
  if (!YMD.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  const check = new Date(Date.UTC(y, m - 1, d));
  return check.getUTCFullYear() === y && check.getUTCMonth() === m - 1 && check.getUTCDate() === d ? { y, m, d } : null;
}

export type FinderValidation =
  | { ok: true; args: FinderRpcArgs; page: number; pageSize: number }
  | { ok: false; error: string };

export interface FinderRpcArgs {
  p_tokens: string[];
  p_reference: string | null;
  p_phone: string | null;
  p_from: string | null;
  p_to: string | null;
  p_status: string | null;
  p_crew_id: string | null;
  p_vehicle_id: string | null;
  p_limit: number;
  p_offset: number;
}

/**
 * Validates raw filters and converts them to `admin_search_bookings` arguments.
 * Dates are Adelaide calendar days: `from` is inclusive at 00:00 local and `to`
 * is inclusive of the whole day (sent as the next local midnight, exclusive),
 * so DST changeover days are 23/25 hours long exactly as they are on the wall.
 */
export function buildFinderArgs(filters: FinderFilters, timeZone: string): FinderValidation {
  const parsed = parseFinderQuery(filters.q);
  const page = Number.isInteger(filters.page) && (filters.page as number) >= 1 ? (filters.page as number) : 1;
  const pageSize = Math.min(Math.max(Number.isInteger(filters.pageSize) ? (filters.pageSize as number) : FINDER_PAGE_SIZE, 1), FINDER_MAX_PAGE_SIZE);
  if (page > 1000) return { ok: false, error: "Page is out of range." };

  let from: string | null = null;
  let to: string | null = null;
  const fromParts = filters.from ? parseYmd(filters.from) : null;
  const toParts = filters.to ? parseYmd(filters.to) : null;
  if (filters.from && !fromParts) return { ok: false, error: "Enter the start date as YYYY-MM-DD." };
  if (filters.to && !toParts) return { ok: false, error: "Enter the end date as YYYY-MM-DD." };
  if (fromParts) from = zonedWallTimeToInstant(fromParts.y, fromParts.m, fromParts.d, 0, 0, timeZone).toISOString();
  if (toParts) to = zonedWallTimeToInstant(toParts.y, toParts.m, toParts.d + 1, 0, 0, timeZone).toISOString();
  if (from && to && Date.parse(to) <= Date.parse(from)) return { ok: false, error: "The end date must not be before the start date." };

  if (filters.status && !(FINDER_STATUSES as readonly string[]).includes(filters.status)) return { ok: false, error: "Unknown status." };
  if (filters.crewId && !UUID.test(filters.crewId)) return { ok: false, error: "Unknown crew." };
  if (filters.vehicleId && !UUID.test(filters.vehicleId)) return { ok: false, error: "Unknown truck." };

  return {
    ok: true,
    page,
    pageSize,
    args: {
      p_tokens: parsed.tokens,
      p_reference: parsed.reference,
      p_phone: parsed.phone,
      p_from: from,
      p_to: to,
      p_status: filters.status || null,
      p_crew_id: filters.crewId || null,
      p_vehicle_id: filters.vehicleId || null,
      p_limit: pageSize,
      p_offset: (page - 1) * pageSize,
    },
  };
}

/** bookings.*_address is jsonb ({ suburb, addressLine, formattedAddress }); legacy rows may hold a plain string. */
export function addressLabel(address: unknown): string {
  if (!address) return "";
  if (typeof address === "string") {
    const parts = address.split(",").map((part) => part.trim()).filter(Boolean);
    return parts.length > 1 ? parts.slice(-2).join(", ") : (parts[0] ?? "");
  }
  const a = address as { suburb?: string; addressLine?: string; formattedAddress?: string };
  return a.suburb || a.addressLine || a.formattedAddress || "";
}

export interface FinderResult {
  id: string;
  bookingNumber: string;
  status: string;
  startsAt: string;
  endsAt: string | null;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  pickup: string;
  destination: string;
  crewName: string | null;
  truckNames: string[];
  matchRank: number;
}

export function toFinderResult(row: FinderRow, vehicleNames: ReadonlyMap<string, string>): FinderResult {
  const extra = (row.dispatch_additional_vehicle_ids ?? []).map((id) => vehicleNames.get(id) ?? "Truck");
  return {
    id: row.id,
    bookingNumber: row.booking_number,
    status: row.booking_status,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    customerEmail: row.customer_email,
    pickup: addressLabel(row.pickup_address),
    destination: addressLabel(row.destination_address),
    crewName: row.crew_name,
    truckNames: [...(row.vehicle_name ? [row.vehicle_name] : []), ...extra],
    matchRank: row.match_rank,
  };
}

export interface FinderRow {
  id: string;
  booking_number: string;
  booking_status: string;
  starts_at: string;
  ends_at: string;
  estimated_duration_minutes: number | null;
  crew_id: string | null;
  crew_name: string | null;
  vehicle_id: string | null;
  vehicle_name: string | null;
  dispatch_additional_vehicle_ids: string[] | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  pickup_address: unknown;
  destination_address: unknown;
  match_rank: number;
  total_count: number | string;
}
