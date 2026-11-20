// Pure CSV + export-row helpers for the admin CSV downloads (no Next.js / Supabase
// imports) so escaping and formula-injection rules can be unit tested with plain node.
import { ADMIN_TIME_ZONE } from "./admin/dates.ts";
import { addressLabel } from "./booking-finder.ts";

export type CsvValue = string | number | boolean | null | undefined;

/** Hard cap per export. Exports that reach it are flagged so nothing is silently cut. */
export const EXPORT_ROW_LIMIT = 5000;

const FORMULA_LEAD = /^[\s]*[=+\-@\t\r]/;

/**
 * Spreadsheet apps evaluate cells that start with = + - @ (or a tab/CR) as formulas.
 * Prefix such text cells with a single quote so they are always shown as text.
 */
export function neutraliseFormula(text: string): string {
  return FORMULA_LEAD.test(text) ? `'${text}` : text;
}

/** One RFC 4180 field. Numbers are emitted as-is (never formulas); text is neutralised then quoted when needed. */
export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return value ? "true" : "false";
  const text = neutraliseFormula(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** UTF-8 BOM (so Excel opens non-ASCII names correctly) + CRLF-separated rows. */
export function toCsv(headers: readonly string[], rows: ReadonlyArray<readonly CsvValue[]>): string {
  const lines = [headers.map(csvCell).join(","), ...rows.map((row) => row.map(csvCell).join(","))];
  return `﻿${lines.join("\r\n")}\r\n`;
}

/** Whole-dollar string from integer cents, e.g. 12345 -> "123.45". Null stays blank. */
export function audFromCents(cents: number | string | null | undefined): string {
  if (cents === null || cents === undefined || cents === "") return "";
  const n = Number(cents);
  if (!Number.isFinite(n)) return "";
  const negative = n < 0;
  const abs = Math.abs(Math.round(n));
  return `${negative ? "-" : ""}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** "2026-11-21 14:30" in Adelaide wall time. Blank for missing/invalid input. */
export function adelaideDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: ADMIN_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}

function str(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(str).join("; ");
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

/** Full single-line address for a CSV cell (jsonb address object or legacy string). */
export function addressCell(address: unknown): string {
  if (!address) return "";
  if (typeof address === "string") return address;
  const a = address as { formattedAddress?: string; addressLine?: string; suburb?: string };
  return a.formattedAddress || [a.addressLine, a.suburb].filter(Boolean).join(", ") || addressLabel(address);
}

// ---- Bookings -------------------------------------------------------------

export interface BookingExportRow {
  booking_number: string;
  booking_status: string;
  payment_status: string | null;
  starts_at: string;
  ends_at: string | null;
  crew_size: number | null;
  subtotal_cents: number | null;
  deposit_paid_cents: number | null;
  balance_due_cents: number | null;
  pickup_address: unknown;
  destination_address: unknown;
  created_at: string | null;
  customers: { name: string | null; email: string | null; phone: string | null } | null;
}

const BOOKING_HEADERS = ["Booking number", "Status", "Payment status", "Starts (Adelaide)", "Ends (Adelaide)", "Customer name", "Customer email", "Customer phone", "Pickup", "Destination", "Crew size", "Subtotal (AUD)", "Deposit paid (AUD)", "Balance due (AUD)", "Created (Adelaide)"] as const;

export function bookingsCsv(rows: readonly BookingExportRow[]): string {
  return toCsv(BOOKING_HEADERS, rows.map((row) => [
    row.booking_number, row.booking_status, row.payment_status, adelaideDateTime(row.starts_at), adelaideDateTime(row.ends_at),
    row.customers?.name, row.customers?.email, row.customers?.phone,
    addressCell(row.pickup_address), addressCell(row.destination_address), row.crew_size,
    audFromCents(row.subtotal_cents), audFromCents(row.deposit_paid_cents), audFromCents(row.balance_due_cents), adelaideDateTime(row.created_at),
  ]));
}

// ---- Quotes ---------------------------------------------------------------

export interface QuoteExportRow {
  id: string;
  payload: Record<string, unknown> | null;
  quote_status: string;
  delivery_status: string;
  created_at: string;
}

const QUOTE_HEADERS = ["Received (Adelaide)", "Status", "Name", "Email", "Phone", "Moving from", "Moving to", "Preferred date", "Details", "Source page", "Email delivery"] as const;

export function quotesCsv(rows: readonly QuoteExportRow[]): string {
  return toCsv(QUOTE_HEADERS, rows.map((row) => {
    const p = row.payload ?? {};
    return [
      adelaideDateTime(row.created_at), row.quote_status, str(p.name), str(p.email), str(p.phone), str(p.moving_from), str(p.moving_to),
      str(p.preferred_moving_date), str(p.details), str(p.source_page), row.delivery_status,
    ];
  }));
}

// ---- Invoices -------------------------------------------------------------

export interface InvoiceExportRow {
  invoice_number: string | null;
  status: string;
  booking_reference: string | null;
  customer: { name?: string | null; email?: string | null } | null;
  service_date: string | null;
  issue_date: string | null;
  total_cents: number | string | null;
  created_at: string | null;
}

const INVOICE_HEADERS = ["Invoice number", "Status", "Booking", "Customer", "Customer email", "Service date", "Issue date", "Total (AUD)", "Created (Adelaide)"] as const;

export function invoicesCsv(rows: readonly InvoiceExportRow[]): string {
  return toCsv(INVOICE_HEADERS, rows.map((row) => [
    row.invoice_number ?? "", row.status, row.booking_reference, row.customer?.name, row.customer?.email,
    row.service_date, row.issue_date, audFromCents(row.total_cents), adelaideDateTime(row.created_at),
  ]));
}

// ---- Customers ------------------------------------------------------------

export interface CustomerExportRow {
  name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string | null;
  bookingCount: number;
  lastBookingAt: string | null;
}

const CUSTOMER_HEADERS = ["Name", "Email", "Phone", "Bookings", "Last booking (Adelaide)", "Customer since (Adelaide)"] as const;

export function customersCsv(rows: readonly CustomerExportRow[]): string {
  return toCsv(CUSTOMER_HEADERS, rows.map((row) => [row.name, row.email, row.phone, row.bookingCount, adelaideDateTime(row.lastBookingAt), adelaideDateTime(row.created_at)]));
}

// ---- Search term safety ---------------------------------------------------

/**
 * Reduces free text to a value that is safe inside a PostgREST `or=(...)` ilike filter:
 * letters, digits, space and a few address/email characters only. Wildcards, commas,
 * parentheses and quotes are dropped. Returns "" when too short to be meaningful.
 */
export function safeLikeTerm(raw: string | null | undefined): string {
  const cleaned = (raw ?? "").normalize("NFKC").replace(/[^\p{L}\p{N} @.+'-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 60);
  return cleaned.length >= 2 ? cleaned : "";
}
