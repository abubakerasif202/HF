import "server-only";
import { getSupabaseAdmin } from "./supabase.ts";
import {
  buildCustomerSummaries, invoiceMoney, matchQuotes,
  type CustomerBooking, type CustomerInvoice, type CustomerPayment, type CustomerQuote, type CustomerRecord, type CustomerSummary,
} from "../customers.ts";

type Row = Record<string, unknown>;

// PostgREST caps a response at 1000 rows by default, so page through large tables.
const PAGE = 1000;
const MAX_PAGES = 30;

type PagedQuery = { range: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }> };

async function fetchAll(build: () => PagedQuery): Promise<Row[]> {
  const rows: Row[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const { data, error } = await build().range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) throw error;
    const batch = (data ?? []) as Row[];
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }
  return rows;
}

function toCustomer(row: Row): CustomerRecord {
  return {
    id: row.id as string,
    name: (row.name as string | null) ?? "",
    email: (row.email as string | null) ?? "",
    phone: (row.phone as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

function toBooking(row: Row): CustomerBooking {
  return {
    id: row.id as string,
    customerId: (row.customer_id as string | null) ?? null,
    bookingNumber: row.booking_number as string,
    status: row.booking_status as string,
    startsAt: row.starts_at as string,
  };
}

function toInvoice(row: Row): CustomerInvoice {
  return {
    id: row.id as string,
    bookingId: row.booking_id as string,
    status: row.status as string,
    invoiceNumber: (row.invoice_number as string | null) ?? null,
    totalCents: row.total_cents == null ? null : Number(row.total_cents),
    issueDate: (row.issue_date as string | null) ?? null,
  };
}

function toPayment(row: Row): CustomerPayment {
  return { invoiceId: row.invoice_id as string, kind: row.kind as string, amountCents: Number(row.amount_cents) };
}

function toQuote(row: Row): CustomerQuote {
  const payload = row.payload;
  return {
    id: row.id as string,
    quoteStatus: row.quote_status as string,
    createdAt: row.created_at as string,
    payload: payload && typeof payload === "object" && !Array.isArray(payload) ? (payload as Record<string, unknown>) : null,
  };
}

/** Every customer with booking count, last move and real invoiced / outstanding money. */
export async function loadCustomerDirectory(): Promise<CustomerSummary[]> {
  const admin = getSupabaseAdmin();
  const [customers, bookings, invoices, payments] = await Promise.all([
    fetchAll(() => admin.from("customers").select("id, name, email, phone, created_at").order("created_at", { ascending: false })),
    fetchAll(() => admin.from("bookings").select("id, customer_id, booking_number, booking_status, starts_at").order("starts_at", { ascending: false })),
    fetchAll(() => admin.from("invoices").select("id, booking_id, status, invoice_number, total_cents").eq("status", "issued").order("created_at", { ascending: false })),
    fetchAll(() => admin.from("invoice_payments").select("invoice_id, kind, amount_cents").order("created_at", { ascending: false })),
  ]);
  return buildCustomerSummaries(customers.map(toCustomer), bookings.map(toBooking), invoices.map(toInvoice), payments.map(toPayment));
}

export interface CustomerInvoiceRow extends CustomerInvoice {
  bookingReference: string;
  paidCents: number;
  balanceCents: number;
}

export interface CustomerDetail {
  customer: CustomerRecord;
  bookings: CustomerBooking[];
  invoices: CustomerInvoiceRow[];
  quotes: CustomerQuote[];
  bookingCount: number;
  invoicedCents: number;
  outstandingCents: number;
}

export async function loadCustomerDetail(id: string): Promise<CustomerDetail | null> {
  const admin = getSupabaseAdmin();
  const { data: row, error } = await admin.from("customers").select("id, name, email, phone, created_at").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!row) return null;
  const customer = toCustomer(row as Row);

  const { data: bookingRows, error: bookingError } = await admin
    .from("bookings")
    .select("id, customer_id, booking_number, booking_status, starts_at")
    .eq("customer_id", id)
    .order("starts_at", { ascending: false })
    .limit(500);
  if (bookingError) throw bookingError;
  const bookings = ((bookingRows ?? []) as Row[]).map(toBooking);
  const bookingIds = bookings.map((b) => b.id);

  const [invoiceRows, quoteRows] = await Promise.all([
    bookingIds.length
      ? admin.from("invoices").select("id, booking_id, status, invoice_number, booking_reference, total_cents, issue_date").in("booking_id", bookingIds).order("created_at", { ascending: false }).limit(500)
      : Promise.resolve({ data: [] as Row[], error: null }),
    fetchAll(() => admin.from("quote_requests").select("id, quote_status, created_at, payload").order("created_at", { ascending: false })),
  ]);
  if (invoiceRows.error) throw invoiceRows.error;
  const invoiceData = (invoiceRows.data ?? []) as Row[];
  const invoiceIds = invoiceData.map((r) => r.id as string);
  let payments: CustomerPayment[] = [];
  if (invoiceIds.length) {
    const { data, error: paymentError } = await admin.from("invoice_payments").select("invoice_id, kind, amount_cents").in("invoice_id", invoiceIds).limit(5000);
    if (paymentError) throw paymentError;
    payments = ((data ?? []) as Row[]).map(toPayment);
  }
  const invoices = invoiceData.map((r): CustomerInvoiceRow => {
    const base = toInvoice(r);
    const paid = payments.filter((p) => p.invoiceId === base.id).reduce((sum, p) => sum + (p.kind === "reversal" ? -p.amountCents : p.amountCents), 0);
    return {
      ...base,
      bookingReference: (r.booking_reference as string | null) ?? "",
      paidCents: paid,
      balanceCents: base.status === "issued" && base.totalCents != null ? Math.max(base.totalCents - paid, 0) : 0,
    };
  });
  const money = invoiceMoney(invoices, payments);
  const counted = bookings.filter((b) => !["draft", "held", "expired"].includes(b.status));
  return {
    customer,
    bookings,
    invoices,
    quotes: matchQuotes(customer, quoteRows.map(toQuote)),
    bookingCount: counted.length,
    ...money,
  };
}

export async function findOtherCustomerWithEmail(email: string, excludeId: string): Promise<string | null> {
  // Exact match on the lowercased value, as findOrCreateCustomer does (no ILIKE wildcards).
  const { data, error } = await getSupabaseAdmin().from("customers").select("id").eq("email", email.trim().toLowerCase()).neq("id", excludeId).limit(1);
  if (error) throw error;
  const first = (data ?? [])[0] as Row | undefined;
  return first ? (first.id as string) : null;
}

export async function getCustomerRecord(id: string): Promise<CustomerRecord | null> {
  const { data, error } = await getSupabaseAdmin().from("customers").select("id, name, email, phone, created_at").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toCustomer(data as Row) : null;
}

export async function updateCustomerRecord(id: string, patch: { name: string; email: string; phone: string | null }): Promise<void> {
  const { error } = await getSupabaseAdmin().from("customers").update(patch).eq("id", id);
  if (error) throw error;
}

export async function writeAdminAudit(entry: { actor: string; action: string; entityType: string; entityId: string; before: Record<string, unknown>; after: Record<string, unknown> }): Promise<boolean> {
  const { error } = await getSupabaseAdmin().from("admin_audit").insert({
    actor: entry.actor, action: entry.action, entity_type: entry.entityType, entity_id: entry.entityId, before: entry.before, after: entry.after,
  });
  if (error) {
    console.error("HF admin audit write failed:", (error as { code?: string }).code);
    return false;
  }
  return true;
}
