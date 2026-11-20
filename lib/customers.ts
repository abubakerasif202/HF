// Pure customer-directory helpers (no Next.js / Supabase imports) so grouping,
// money roll-ups, search and enquiry matching can be unit tested with plain node.
import { z } from "zod";
import { normalizeAuPhone } from "./booking-finder.ts";

export const CUSTOMER_PAGE_SIZE = 25;
export const CUSTOMER_MAX_QUERY_LENGTH = 100;

/** Booking states that never became a real job (abandoned holds / expiries) are not counted. */
const UNCOUNTED_BOOKING_STATUSES: ReadonlySet<string> = new Set(["draft", "held", "expired"]);

export interface CustomerRecord {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
}

export interface CustomerBooking {
  id: string;
  customerId: string | null;
  bookingNumber: string;
  status: string;
  startsAt: string;
}

export interface CustomerInvoice {
  id: string;
  bookingId: string;
  status: string;
  invoiceNumber: string | null;
  totalCents: number | null;
  issueDate?: string | null;
}

export interface CustomerPayment {
  invoiceId: string;
  kind: string;
  amountCents: number;
}

export interface CustomerQuote {
  id: string;
  quoteStatus: string;
  createdAt: string;
  payload: Record<string, unknown> | null;
}

export interface CustomerSummary extends CustomerRecord {
  bookingCount: number;
  lastMoveAt: string | null;
  invoicedCents: number;
  outstandingCents: number;
}

/** Money received against one invoice: deposits and payments less reversals (mirrors lib/invoice.paidCents). */
export function sumPaidCents(payments: ReadonlyArray<Pick<CustomerPayment, "kind" | "amountCents">>): number {
  return payments.reduce((sum, p) => sum + (p.kind === "reversal" ? -p.amountCents : p.amountCents), 0);
}

export interface InvoiceMoney {
  invoicedCents: number;
  outstandingCents: number;
}

/**
 * Only ISSUED invoices count as invoiced money; drafts and voids are ignored.
 * Outstanding is the unpaid remainder of issued invoices (never negative).
 */
export function invoiceMoney(invoices: ReadonlyArray<CustomerInvoice>, payments: ReadonlyArray<CustomerPayment>): InvoiceMoney {
  const paidByInvoice = new Map<string, CustomerPayment[]>();
  for (const payment of payments) {
    const list = paidByInvoice.get(payment.invoiceId);
    if (list) list.push(payment);
    else paidByInvoice.set(payment.invoiceId, [payment]);
  }
  let invoicedCents = 0;
  let outstandingCents = 0;
  for (const invoice of invoices) {
    if (invoice.status !== "issued" || invoice.totalCents == null) continue;
    invoicedCents += invoice.totalCents;
    outstandingCents += Math.max(invoice.totalCents - sumPaidCents(paidByInvoice.get(invoice.id) ?? []), 0);
  }
  return { invoicedCents, outstandingCents };
}

export function buildCustomerSummaries(
  customers: ReadonlyArray<CustomerRecord>,
  bookings: ReadonlyArray<CustomerBooking>,
  invoices: ReadonlyArray<CustomerInvoice>,
  payments: ReadonlyArray<CustomerPayment>,
): CustomerSummary[] {
  const customerByBooking = new Map<string, string>();
  const bookingsByCustomer = new Map<string, CustomerBooking[]>();
  for (const booking of bookings) {
    if (!booking.customerId) continue;
    customerByBooking.set(booking.id, booking.customerId);
    if (UNCOUNTED_BOOKING_STATUSES.has(booking.status)) continue;
    const list = bookingsByCustomer.get(booking.customerId);
    if (list) list.push(booking);
    else bookingsByCustomer.set(booking.customerId, [booking]);
  }
  const invoicesByCustomer = new Map<string, CustomerInvoice[]>();
  for (const invoice of invoices) {
    const customerId = customerByBooking.get(invoice.bookingId);
    if (!customerId) continue;
    const list = invoicesByCustomer.get(customerId);
    if (list) list.push(invoice);
    else invoicesByCustomer.set(customerId, [invoice]);
  }
  const summaries = customers.map((customer): CustomerSummary => {
    const own = bookingsByCustomer.get(customer.id) ?? [];
    const lastMoveAt = own.reduce<string | null>((latest, b) => (latest == null || Date.parse(b.startsAt) > Date.parse(latest) ? b.startsAt : latest), null);
    return { ...customer, bookingCount: own.length, lastMoveAt, ...invoiceMoney(invoicesByCustomer.get(customer.id) ?? [], payments) };
  });
  // Most recent booking first (future moves lead); customers with no booking follow, newest first.
  return summaries.sort((a, b) => {
    if (a.lastMoveAt && b.lastMoveAt) return Date.parse(b.lastMoveAt) - Date.parse(a.lastMoveAt);
    if (a.lastMoveAt) return -1;
    if (b.lastMoveAt) return 1;
    return Date.parse(b.createdAt) - Date.parse(a.createdAt);
  });
}

/** Free-text search over name, email and phone. Every word must match; phones compare as digits. */
export function filterCustomers<T extends Pick<CustomerRecord, "name" | "email" | "phone">>(customers: ReadonlyArray<T>, rawQuery: string | null | undefined): T[] {
  const query = (rawQuery ?? "").trim().slice(0, CUSTOMER_MAX_QUERY_LENGTH).toLowerCase();
  if (!query) return [...customers];
  // A query made only of digits and phone punctuation ("+61 491 704 136") is one phone, not four words.
  const words = /^[\d+()\-.\s]+$/.test(query) ? [query] : query.split(/\s+/).filter(Boolean).slice(0, 8);
  return customers.filter((customer) => {
    const text = `${customer.name} ${customer.email}`.toLowerCase();
    const phoneDigits = (customer.phone ?? "").replace(/\D/g, "");
    const phoneNational = normalizeAuPhone(customer.phone) ?? "";
    return words.every((word) => {
      if (text.includes(word) || (customer.phone ?? "").toLowerCase().includes(word)) return true;
      const digits = word.replace(/\D/g, "");
      if (digits.length < 3 || !/^[\d+()\-.\s]+$/.test(word)) return false;
      const wanted = normalizeAuPhone(word) ?? digits;
      return phoneDigits.includes(digits) || phoneNational.includes(wanted);
    });
  });
}

export function paginate<T>(items: ReadonlyArray<T>, rawPage: number, size = CUSTOMER_PAGE_SIZE): { items: T[]; page: number; pageCount: number; total: number } {
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const page = Number.isSafeInteger(rawPage) ? Math.min(Math.max(rawPage, 1), pageCount) : 1;
  return { items: items.slice((page - 1) * size, page * size), page, pageCount, total };
}

function quoteField(quote: CustomerQuote, key: string): string {
  const value = quote.payload?.[key];
  return typeof value === "string" ? value.trim() : "";
}

/** Quote enquiries whose submitted email (exact, case-insensitive) or phone (normalised) match the customer. */
export function matchQuotes(customer: Pick<CustomerRecord, "email" | "phone">, quotes: ReadonlyArray<CustomerQuote>): CustomerQuote[] {
  const email = customer.email.trim().toLowerCase();
  const phone = normalizeAuPhone(customer.phone);
  const phoneUsable = phone != null && phone.length >= 8;
  return quotes
    .filter((quote) => {
      const quoteEmail = quoteField(quote, "email").toLowerCase();
      if (email && quoteEmail === email) return true;
      if (!phoneUsable) return false;
      const quotePhone = normalizeAuPhone(quoteField(quote, "phone"));
      return quotePhone === phone;
    })
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

const phonePattern = /^[0-9+()\s.-]+$/;

/** Owner edit of a customer's contact details. Email is stored lowercased (matches findOrCreateCustomer). */
export const customerEditSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().trim().min(1, "Enter a name.").max(200, "Name is too long."),
    email: z.string().trim().toLowerCase().min(1, "Enter an email address.").max(254, "Email is too long.").email("Enter a valid email address."),
    phone: z
      .string()
      .trim()
      .max(40, "Phone is too long.")
      .refine((value) => value === "" || (phonePattern.test(value) && value.replace(/\D/g, "").length >= 6), "Enter a valid phone number.")
      .nullish()
      .transform((value) => (value ? value : null)),
  })
  .strict();

export type CustomerEditInput = z.input<typeof customerEditSchema>;
export type CustomerEdit = z.output<typeof customerEditSchema>;

/** Fields that actually differ, for the audit trail. Returns null when nothing changed. */
export function customerChanges(
  before: Pick<CustomerRecord, "name" | "email" | "phone">,
  after: Pick<CustomerEdit, "name" | "email" | "phone">,
): { before: Record<string, string | null>; after: Record<string, string | null> } | null {
  const beforeOut: Record<string, string | null> = {};
  const afterOut: Record<string, string | null> = {};
  for (const key of ["name", "email", "phone"] as const) {
    const prior = before[key] ?? null;
    const next = after[key] ?? null;
    if (prior !== next) {
      beforeOut[key] = prior;
      afterOut[key] = next;
    }
  }
  return Object.keys(afterOut).length ? { before: beforeOut, after: afterOut } : null;
}
