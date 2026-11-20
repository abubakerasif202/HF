import "server-only";
import { getSupabaseAdmin } from "./supabase.ts";
import { adelaideYmd } from "../admin/dates.ts";
import {
  agingBuckets,
  enquiriesBySourcePage,
  isMissingColumnError,
  lostReasons,
  medianFirstResponseHours,
  quoteFunnel,
  summariseBookings,
  summariseInvoices,
  type AgingBucket,
  type BookingSummary,
  type CountRow,
  type FunnelStage,
  type InvoiceReportRow,
  type InvoiceSummary,
  type PaymentReportRow,
  type QuoteReportRow,
  type ReportRange,
} from "../admin/reports.ts";

/** A report section either loaded or failed on its own; one bad query never blanks the page. */
export type Section<T> = { ok: true; data: T } | { ok: false };

export interface BillingReport {
  inRange: InvoiceSummary;
  aging: AgingBucket[];
  agingTotalCents: number;
}

export interface QuoteReport {
  received: number;
  funnel: FunnelStage[];
  /** False until migration 0021 (Phase 2) adds the response/quote/lost columns. */
  phase2Available: boolean;
  medianFirstResponseHours: number | null;
  lostReasons: CountRow[];
  sources: { rows: CountRow[]; otherCount: number };
}

export interface ReportsData {
  bookings: Section<BookingSummary>;
  billing: Section<BillingReport>;
  quotes: Section<QuoteReport>;
}

const PAGE_SIZE = 1000;
const MAX_PAGES = 20;
const IN_CHUNK = 150;

type PageResult<Row> = PromiseLike<{ data: Row[] | null; error: { code?: string | null; message?: string | null } | null }>;

/** Reads every row of a query in pages so PostgREST's row cap never silently truncates a report. */
async function fetchAll<Row>(build: (from: number, to: number) => PageResult<Row>): Promise<{ rows: Row[]; error: { code?: string | null; message?: string | null } | null }> {
  const rows: Row[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const { data, error } = await build(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    if (error) return { rows: [], error };
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return { rows, error: null };
}

async function loadBookings(range: ReportRange): Promise<BookingSummary> {
  const { rows, error } = await fetchAll<{ booking_status: string | null; package_id: string | null; truck_class: string | null }>((from, to) =>
    getSupabaseAdmin()
      .from("bookings")
      .select("booking_status, package_id, truck_class")
      .gte("starts_at", range.start)
      .lt("starts_at", range.end)
      .order("starts_at", { ascending: true })
      .range(from, to),
  );
  if (error) throw new Error("bookings query failed");
  return summariseBookings(rows);
}

async function loadBilling(range: ReportRange): Promise<BillingReport> {
  const { rows: invoices, error } = await fetchAll<InvoiceReportRow>((from, to) =>
    getSupabaseAdmin()
      .from("invoices")
      .select("id, status, total_cents, issue_date, due_date")
      .eq("status", "issued")
      .order("issue_date", { ascending: true })
      .range(from, to),
  );
  if (error) throw new Error("invoices query failed");

  const payments: PaymentReportRow[] = [];
  for (let index = 0; index < invoices.length; index += IN_CHUNK) {
    const ids = invoices.slice(index, index + IN_CHUNK).map((invoice) => invoice.id);
    const { rows, error: paymentError } = await fetchAll<PaymentReportRow>((from, to) =>
      getSupabaseAdmin().from("invoice_payments").select("invoice_id, kind, amount_cents").in("invoice_id", ids).order("created_at", { ascending: true }).range(from, to),
    );
    if (paymentError) throw new Error("payments query failed");
    payments.push(...rows);
  }

  const issuedInRange = invoices.filter((invoice) => invoice.issue_date !== null && invoice.issue_date >= range.fromYmd && invoice.issue_date <= range.toYmd);
  const aging = agingBuckets(invoices, payments, adelaideYmd(new Date()));
  return {
    inRange: summariseInvoices(issuedInRange, payments),
    aging,
    agingTotalCents: aging.reduce((sum, bucket) => sum + bucket.outstandingCents, 0),
  };
}

const BASE_QUOTE_COLUMNS = "created_at, quote_status, payload";
const PHASE2_QUOTE_COLUMNS = `${BASE_QUOTE_COLUMNS}, first_response_at, quoted_amount_cents, lost_reason, booking_id`;

async function loadQuotes(range: ReportRange): Promise<QuoteReport> {
  const query = (columns: string) =>
    fetchAll<QuoteReportRow>((from, to) =>
      getSupabaseAdmin().from("quote_requests").select(columns).gte("created_at", range.start).lt("created_at", range.end).order("created_at", { ascending: true }).range(from, to) as unknown as PageResult<QuoteReportRow>,
    );

  let phase2Available = true;
  let result = await query(PHASE2_QUOTE_COLUMNS);
  if (result.error && isMissingColumnError(result.error)) {
    phase2Available = false;
    result = await query(BASE_QUOTE_COLUMNS);
  }
  if (result.error) throw new Error("quotes query failed");

  const rows = result.rows;
  return {
    received: rows.length,
    funnel: quoteFunnel(rows),
    phase2Available,
    medianFirstResponseHours: phase2Available ? medianFirstResponseHours(rows) : null,
    lostReasons: phase2Available ? lostReasons(rows) : [],
    sources: enquiriesBySourcePage(rows),
  };
}

async function settle<T>(work: Promise<T>): Promise<Section<T>> {
  try {
    return { ok: true, data: await work };
  } catch (error) {
    // Log the category only; never row data or credentials.
    console.error("HF reports section failed:", error instanceof Error ? error.message : "unknown");
    return { ok: false };
  }
}

export async function loadReports(range: ReportRange): Promise<ReportsData> {
  const [bookings, billing, quotes] = await Promise.all([settle(loadBookings(range)), settle(loadBilling(range)), settle(loadQuotes(range))]);
  return { bookings, billing, quotes };
}
