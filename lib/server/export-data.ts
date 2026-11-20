import "server-only";
import { NextResponse } from "next/server";
import { getAdminAuthState } from "./supabase-ssr.ts";
import { getSupabaseAdmin } from "./supabase.ts";
import { adelaideYmd } from "../admin/dates.ts";
import { FINDER_STATUSES } from "../booking-finder.ts";
import {
  EXPORT_ROW_LIMIT, bookingsCsv, customersCsv, invoicesCsv, quotesCsv, safeLikeTerm,
  type BookingExportRow, type CustomerExportRow, type InvoiceExportRow, type QuoteExportRow,
} from "../admin-csv.ts";

export const exportHeaders = { "Cache-Control": "private, no-store, max-age=0" };

const QUOTE_STATUSES = ["new", "quote_sent", "follow_up", "booked", "completed", "lost"] as const;
const INVOICE_STATUSES = ["draft", "issued", "void"] as const;

/** 401/403 unless the caller is the authorized owner; null when allowed. Runs before any data access. */
export async function denyUnlessAdmin(): Promise<NextResponse | null> {
  const auth = await getAdminAuthState();
  if (auth.status === "authorized") return null;
  const status = auth.status === "forbidden" ? 403 : 401;
  return NextResponse.json({ error: status === 403 ? "Forbidden" : "Not authorized" }, { status, headers: exportHeaders });
}

export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400, headers: exportHeaders });
}

export function exportUnavailable(): NextResponse {
  return NextResponse.json({ error: "Export is unavailable. Try again shortly." }, { status: 503, headers: exportHeaders });
}

/** A CSV download. `X-Export-Truncated` tells the owner when the row cap cut the file short. */
export function csvResponse(name: string, csv: string, truncated: boolean): NextResponse {
  return new NextResponse(csv, {
    status: 200,
    headers: {
      ...exportHeaders,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="hf-${name}-${adelaideYmd(new Date())}.csv"`,
      "X-Content-Type-Options": "nosniff",
      "X-Export-Truncated": truncated ? "true" : "false",
    },
  });
}

export type ExportFilter<T> = { ok: true; value: T } | { ok: false; error: string };

export function parseBookingStatus(raw: string | null): ExportFilter<string | null> {
  if (!raw || raw === "all") return { ok: true, value: null };
  return (FINDER_STATUSES as readonly string[]).includes(raw) ? { ok: true, value: raw } : { ok: false, error: "Unknown booking status." };
}

export function parseQuoteStatus(raw: string | null): ExportFilter<string | null> {
  if (!raw || raw === "all") return { ok: true, value: null };
  return (QUOTE_STATUSES as readonly string[]).includes(raw) ? { ok: true, value: raw } : { ok: false, error: "Invalid quote status." };
}

export function parseInvoiceStatus(raw: string | null): ExportFilter<string | null> {
  if (!raw) return { ok: true, value: null };
  return (INVOICE_STATUSES as readonly string[]).includes(raw) ? { ok: true, value: raw } : { ok: false, error: "Unknown invoice status." };
}

export interface ExportFile {
  csv: string;
  truncated: boolean;
}

/** Fetches one extra row so a result of exactly the cap is not reported as truncated. */
const FETCH_LIMIT = EXPORT_ROW_LIMIT + 1;

function finish<T>(rows: T[] | null, build: (rows: T[]) => string): ExportFile {
  const all = rows ?? [];
  const truncated = all.length > EXPORT_ROW_LIMIT;
  return { csv: build(truncated ? all.slice(0, EXPORT_ROW_LIMIT) : all), truncated };
}

export async function exportBookings(status: string | null): Promise<ExportFile> {
  let query = getSupabaseAdmin()
    .from("bookings")
    .select("booking_number, booking_status, payment_status, starts_at, ends_at, crew_size, subtotal_cents, deposit_paid_cents, balance_due_cents, pickup_address, destination_address, created_at, customers(name, email, phone)")
    .order("starts_at", { ascending: false })
    .limit(FETCH_LIMIT);
  if (status) query = query.eq("booking_status", status);
  const { data, error } = await query;
  if (error) throw error;
  const rows = ((data ?? []) as unknown as Array<Omit<BookingExportRow, "customers"> & { customers: BookingExportRow["customers"] | BookingExportRow["customers"][] }>).map((row) => ({
    ...row,
    customers: Array.isArray(row.customers) ? (row.customers[0] ?? null) : row.customers,
  }));
  return finish(rows, bookingsCsv);
}

export async function exportQuotes(status: string | null, search: string | null): Promise<ExportFile> {
  let query = getSupabaseAdmin()
    .from("quote_requests")
    .select("id, payload, quote_status, delivery_status, created_at")
    .order("created_at", { ascending: false })
    .limit(FETCH_LIMIT);
  if (status) query = query.eq("quote_status", status);
  const { data, error } = await query;
  if (error) throw error;
  let rows = (data ?? []) as unknown as QuoteExportRow[];
  const term = safeLikeTerm(search).toLowerCase();
  if (term) {
    rows = rows.filter((row) => JSON.stringify(row.payload ?? {}).toLowerCase().includes(term));
  }
  return finish(rows, quotesCsv);
}

export async function exportInvoices(status: string | null): Promise<ExportFile> {
  let query = getSupabaseAdmin()
    .from("invoices")
    .select("invoice_number, status, booking_reference, customer, service_date, issue_date, total_cents, created_at")
    .order("created_at", { ascending: false })
    .limit(FETCH_LIMIT);
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw error;
  return finish((data ?? []) as unknown as InvoiceExportRow[], invoicesCsv);
}

/** Customers are read straight from the customers table (name / email / phone search), with booking counts from bookings. */
export async function exportCustomers(search: string | null): Promise<ExportFile> {
  const admin = getSupabaseAdmin();
  let query = admin.from("customers").select("id, name, email, phone, created_at").order("created_at", { ascending: false }).limit(FETCH_LIMIT);
  const term = safeLikeTerm(search);
  if (term) query = query.or(`name.ilike.*${term}*,email.ilike.*${term}*,phone.ilike.*${term}*`);
  const [customers, bookings] = await Promise.all([
    query,
    admin.from("bookings").select("customer_id, starts_at").not("customer_id", "is", null).order("starts_at", { ascending: false }).limit(50000),
  ]);
  if (customers.error) throw customers.error;
  if (bookings.error) throw bookings.error;

  const stats = new Map<string, { count: number; last: string }>();
  for (const row of (bookings.data ?? []) as Array<{ customer_id: string; starts_at: string }>) {
    const current = stats.get(row.customer_id);
    if (current) current.count += 1;
    else stats.set(row.customer_id, { count: 1, last: row.starts_at });
  }
  const rows: CustomerExportRow[] = ((customers.data ?? []) as Array<{ id: string; name: string | null; email: string | null; phone: string | null; created_at: string | null }>)
    .map((row) => ({ name: row.name, email: row.email, phone: row.phone, created_at: row.created_at, bookingCount: stats.get(row.id)?.count ?? 0, lastBookingAt: stats.get(row.id)?.last ?? null }));
  return finish(rows, customersCsv);
}
