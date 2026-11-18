import "server-only";
import { getSupabaseAdmin } from "./supabase.ts";
import { business } from "../site-data.ts";
import {
  computeInvoiceTotals, lineAmountCents, paidCents, prefillInvoiceFromBooking, missingInvoiceSettings,
  type InvoiceLine, type InvoicePayment, type InvoiceSettings, type InvoiceDraftPayload,
} from "../invoice.ts";
import type { InvoiceSnapshot } from "../invoice-pdf.ts";

export class InvoiceError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

interface RpcError { message?: string; details?: string | null; code?: string }

/** Turns a Postgres/PostgREST failure into a safe, staff-readable error. Never leaks SQL text. */
export function mapInvoiceError(error: unknown): InvoiceError {
  if (error instanceof InvoiceError) return error;
  const { message = "", details, code } = (error ?? {}) as RpcError;
  const key = message.split(/[\s:]/)[0] ?? "";
  switch (key) {
    case "invoice_settings_incomplete": return new InvoiceError(409, key, `Complete the invoice settings before issuing${details ? ` (missing: ${details.replaceAll("_", " ").replaceAll(",", ", ")})` : ""}.`);
    case "gst_mode_required": return new InvoiceError(409, key, "Choose whether the entered amounts include GST or exclude GST, then save the draft.");
    case "invoice_has_no_lines": return new InvoiceError(409, key, "Add at least one priced line item before issuing.");
    case "invoice_total_not_positive": return new InvoiceError(409, key, "The invoice total must be above $0.00.");
    case "totals_mismatch": return new InvoiceError(409, key, "The totals changed while preparing the invoice. Reload and try again.");
    case "payments_exceed_total": return new InvoiceError(409, key, "Recorded payments exceed the invoice total.");
    case "invoice_changed": return new InvoiceError(409, key, "This draft was changed elsewhere. Reload the page and try again.");
    case "invoice_not_draft": return new InvoiceError(409, key, "This invoice has already been issued or voided.");
    case "invoice_not_issued": return new InvoiceError(409, key, "Only an issued invoice can be changed this way.");
    case "invoice_immutable": return new InvoiceError(409, key, "Issued invoices cannot be edited. Void and reissue to correct one.");
    case "invoice_counter_cannot_decrease": return new InvoiceError(409, key, "The next invoice number cannot be lower than the current counter, because that would reuse an issued number.");
    case "payment_exceeds_balance": return new InvoiceError(422, key, "That payment is more than the balance due.");
    case "reversal_amount_mismatch": return new InvoiceError(422, key, "A reversal must match the original payment amount.");
    case "payment_not_found": return new InvoiceError(404, key, "Payment not found on this invoice.");
    case "void_reason_required": return new InvoiceError(400, key, "Enter a reason of at least 3 characters.");
    case "idempotency_key_required": return new InvoiceError(400, key, "Missing request key. Reload and try again.");
    case "booking_not_found":
    case "invoice_not_found": return new InvoiceError(404, key, "Not found.");
    default:
      if (code === "23514" || code === "23502" || code === "22P02" || code === "22007" || code === "22023") {
        return new InvoiceError(400, "invalid_invoice", "Some invoice details are invalid. Check the amounts, dates and descriptions.");
      }
      if (code === "23505") return new InvoiceError(409, "duplicate", "That already exists.");
      return new InvoiceError(503, "unavailable", "Invoicing is temporarily unavailable.");
  }
}

type Row = Record<string, unknown>;

function settingsFromRow(row: Row | null | undefined): InvoiceSettings | null {
  if (!row) return null;
  return {
    abn: (row.abn as string | null) ?? null,
    gstRegistered: (row.gst_registered as boolean | null) ?? null,
    ratesIncludeGst: (row.rates_include_gst as boolean | null) ?? null,
    paymentInstructions: (row.payment_instructions as string | null) ?? null,
    paymentTermsDays: (row.payment_terms_days as number | null) ?? null,
    invoicePrefix: (row.invoice_prefix as string | null) ?? null,
    nextInvoiceNumber: Number(row.next_invoice_number ?? 1),
    footerNote: (row.footer_note as string | null) ?? null,
    logoConfirmed: Boolean(row.logo_confirmed),
  };
}

export async function getInvoiceSettings(): Promise<InvoiceSettings | null> {
  const { data, error } = await getSupabaseAdmin().from("invoice_settings").select("*").eq("id", true).maybeSingle();
  if (error) throw mapInvoiceError(error);
  return settingsFromRow(data as Row | null);
}

export interface InvoiceSettingsPatch {
  abn: string | null;
  gstRegistered: boolean | null;
  ratesIncludeGst: boolean | null;
  paymentInstructions: string | null;
  paymentTermsDays: number | null;
  invoicePrefix: string | null;
  nextInvoiceNumber?: number;
  footerNote: string | null;
  logoConfirmed: boolean;
}

export async function saveInvoiceSettings(patch: InvoiceSettingsPatch): Promise<void> {
  const update: Row = {
    abn: patch.abn, gst_registered: patch.gstRegistered, rates_include_gst: patch.ratesIncludeGst,
    payment_instructions: patch.paymentInstructions, payment_terms_days: patch.paymentTermsDays,
    invoice_prefix: patch.invoicePrefix, footer_note: patch.footerNote, logo_confirmed: patch.logoConfirmed,
  };
  if (patch.nextInvoiceNumber !== undefined) update.next_invoice_number = patch.nextInvoiceNumber;
  const { error } = await getSupabaseAdmin().from("invoice_settings").update(update).eq("id", true);
  if (error) throw mapInvoiceError(error);
}

export interface InvoiceRecord {
  id: string;
  bookingId: string;
  status: "draft" | "issued" | "void";
  invoiceNumber: string | null;
  pricingMode: "hourly" | "fixed";
  pricingSource: string;
  amountsIncludeGst: boolean | null;
  customer: { name?: string | null; email?: string | null; phone?: string | null };
  bookingReference: string;
  serviceDate: string;
  issueDate: string | null;
  dueDate: string | null;
  notes: string | null;
  version: number;
  snapshot: InvoiceSnapshot | null;
  totalCents: number | null;
  replacesInvoiceId: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  createdAt: string;
  lines: InvoiceLine[];
  payments: Array<InvoicePayment & { id: string }>;
}

function invoiceFromRows(row: Row, lines: Row[], payments: Row[]): InvoiceRecord {
  return {
    id: row.id as string,
    bookingId: row.booking_id as string,
    status: row.status as InvoiceRecord["status"],
    invoiceNumber: (row.invoice_number as string | null) ?? null,
    pricingMode: row.pricing_mode as "hourly" | "fixed",
    pricingSource: row.pricing_source as string,
    amountsIncludeGst: (row.amounts_include_gst as boolean | null) ?? null,
    customer: (row.customer as InvoiceRecord["customer"]) ?? {},
    bookingReference: row.booking_reference as string,
    serviceDate: row.service_date as string,
    issueDate: (row.issue_date as string | null) ?? null,
    dueDate: (row.due_date as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    version: Number(row.version),
    snapshot: (row.snapshot as InvoiceSnapshot | null) ?? null,
    totalCents: row.total_cents == null ? null : Number(row.total_cents),
    replacesInvoiceId: (row.replaces_invoice_id as string | null) ?? null,
    voidedAt: (row.voided_at as string | null) ?? null,
    voidReason: (row.void_reason as string | null) ?? null,
    createdAt: row.created_at as string,
    lines: [...lines].sort((a, b) => Number(a.position) - Number(b.position)).map((l) => ({
      kind: l.kind as InvoiceLine["kind"], description: l.description as string,
      quantityMilli: Number(l.quantity_milli), unitPriceCents: Number(l.unit_price_cents),
    })),
    payments: [...payments].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))).map((p) => ({
      id: p.id as string, kind: p.kind as InvoicePayment["kind"], amountCents: Number(p.amount_cents),
      receivedOn: p.received_on as string, method: (p.method as string | null) ?? null,
      reference: (p.reference as string | null) ?? null, source: p.source as "manual" | "booking_deposit",
      reversesPaymentId: (p.reverses_payment_id as string | null) ?? null,
    })),
  };
}

export async function getInvoice(id: string): Promise<InvoiceRecord | null> {
  const admin = getSupabaseAdmin();
  const { data: row, error } = await admin.from("invoices").select("*").eq("id", id).maybeSingle();
  if (error) throw mapInvoiceError(error);
  if (!row) return null;
  const [lines, payments] = await Promise.all([
    admin.from("invoice_lines").select("*").eq("invoice_id", id),
    admin.from("invoice_payments").select("*").eq("invoice_id", id),
  ]);
  if (lines.error) throw mapInvoiceError(lines.error);
  if (payments.error) throw mapInvoiceError(payments.error);
  return invoiceFromRows(row as Row, (lines.data ?? []) as Row[], (payments.data ?? []) as Row[]);
}

export async function getInvoiceForBooking(bookingId: string): Promise<{ id: string; status: string; invoiceNumber: string | null } | null> {
  const { data, error } = await getSupabaseAdmin().from("invoices").select("id, status, invoice_number").eq("booking_id", bookingId).neq("status", "void").maybeSingle();
  if (error) throw mapInvoiceError(error);
  return data ? { id: data.id as string, status: data.status as string, invoiceNumber: (data.invoice_number as string | null) ?? null } : null;
}

export interface InvoiceListItem {
  id: string;
  status: string;
  invoiceNumber: string | null;
  bookingId: string;
  bookingReference: string;
  customerName: string | null;
  serviceDate: string;
  issueDate: string | null;
  totalCents: number | null;
  createdAt: string;
}

export async function listInvoices(status?: string): Promise<InvoiceListItem[]> {
  let query = getSupabaseAdmin().from("invoices")
    .select("id, status, invoice_number, booking_id, booking_reference, customer, service_date, issue_date, total_cents, created_at")
    .order("created_at", { ascending: false }).limit(200);
  if (status && ["draft", "issued", "void"].includes(status)) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw mapInvoiceError(error);
  return ((data ?? []) as Row[]).map((row) => ({
    id: row.id as string, status: row.status as string, invoiceNumber: (row.invoice_number as string | null) ?? null,
    bookingId: row.booking_id as string, bookingReference: row.booking_reference as string,
    customerName: ((row.customer as { name?: string } | null)?.name) ?? null, serviceDate: row.service_date as string,
    issueDate: (row.issue_date as string | null) ?? null, totalCents: row.total_cents == null ? null : Number(row.total_cents),
    createdAt: row.created_at as string,
  }));
}

export async function createInvoiceDraftForBooking(bookingId: string, actor: string): Promise<{ id: string; created: boolean }> {
  const admin = getSupabaseAdmin();
  const { data: booking, error } = await admin.from("bookings")
    .select("*, customers(name, email, phone)").eq("id", bookingId).maybeSingle();
  if (error) throw mapInvoiceError(error);
  if (!booking) throw new InvoiceError(404, "booking_not_found", "Booking not found.");
  const customers = (booking as Row).customers;
  const flat = { ...(booking as Row), customers: Array.isArray(customers) ? (customers[0] ?? null) : (customers ?? null) };
  const draft: InvoiceDraftPayload = prefillInvoiceFromBooking(flat as unknown as Parameters<typeof prefillInvoiceFromBooking>[0], await getInvoiceSettings());
  const { data, error: rpcError } = await admin.rpc("create_invoice_draft", { p_booking_id: bookingId, p_actor: actor, p_draft: draft });
  if (rpcError) throw mapInvoiceError(rpcError);
  return data as { id: string; created: boolean };
}

export interface DraftPatch {
  customer?: InvoiceRecord["customer"];
  notes?: string | null;
  serviceDate?: string;
  amountsIncludeGst?: boolean | null;
  lines?: InvoiceLine[];
  payments?: InvoicePayment[];
}

export async function saveInvoiceDraft(id: string, expectedVersion: number, actor: string, patch: DraftPatch): Promise<{ version: number }> {
  const { data, error } = await getSupabaseAdmin().rpc("save_invoice_draft", { p_invoice_id: id, p_expected_version: expectedVersion, p_actor: actor, p_patch: patch });
  if (error) throw mapInvoiceError(error);
  return data as { version: number };
}

export async function discardInvoiceDraft(id: string): Promise<void> {
  const { error } = await getSupabaseAdmin().from("invoices").delete().eq("id", id).eq("status", "draft");
  if (error) throw mapInvoiceError(error);
}

/** bookings.*_address is jsonb ({ suburb, addressLine, formattedAddress }); legacy rows may hold a plain string. */
function fullAddress(address: unknown): string {
  if (!address) return "";
  if (typeof address === "string") return address;
  const a = address as { suburb?: string; addressLine?: string; formattedAddress?: string };
  return a.formattedAddress ?? `${a.addressLine ?? ""} ${a.suburb ?? ""}`.trim();
}

async function loadBookingFacts(bookingId: string): Promise<{ pickup: string | null; destination: string | null; packageName: string | null; status: string | null }> {
  const { data } = await getSupabaseAdmin().from("bookings").select("pickup_address, destination_address, pricing_snapshot, booking_status").eq("id", bookingId).maybeSingle();
  const row = (data ?? {}) as Row;
  return {
    pickup: fullAddress(row.pickup_address) || null,
    destination: fullAddress(row.destination_address) || null,
    packageName: ((row.pricing_snapshot as { package?: string } | null)?.package) ?? null,
    status: (row.booking_status as string | null) ?? null,
  };
}

const sellerIdentity = () => ({
  legalName: business.legalName,
  tradingName: business.name,
  address: business.address.full,
  phone: business.phones[0]?.display,
  email: business.emails[0],
});

/** Live (draft) or frozen (issued/void) document model for preview and PDF. */
export async function buildInvoiceDocument(invoice: InvoiceRecord, settings: InvoiceSettings | null): Promise<InvoiceSnapshot> {
  if (invoice.snapshot && invoice.status !== "draft") {
    return { ...invoice.snapshot, voided: invoice.status === "void", draft: false };
  }
  const facts = await loadBookingFacts(invoice.bookingId);
  const totals = computeInvoiceTotals({ lines: invoice.lines, gstRegistered: settings?.gstRegistered ?? null, amountsIncludeGst: invoice.amountsIncludeGst });
  const paid = paidCents(invoice.payments);
  return {
    title: settings?.gstRegistered ? "Tax invoice" : "Invoice",
    invoiceNumber: null, issueDate: null, dueDate: null,
    bookingReference: invoice.bookingReference, serviceDate: invoice.serviceDate, customer: invoice.customer, notes: invoice.notes,
    amountsIncludeGst: invoice.amountsIncludeGst,
    seller: {
      ...sellerIdentity(), abn: settings?.abn ?? null, gstRegistered: settings?.gstRegistered ?? null,
      paymentInstructions: settings?.paymentInstructions ?? null, paymentTermsDays: settings?.paymentTermsDays ?? null,
      footerNote: settings?.footerNote ?? null, logoConfirmed: settings?.logoConfirmed ?? false,
    },
    lines: invoice.lines.map((l) => ({ ...l, amountCents: lineAmountCents(l) })),
    payments: invoice.payments.map((p) => ({ kind: p.kind, amountCents: p.amountCents, receivedOn: p.receivedOn, method: p.method, reference: p.reference })),
    totals: { subtotalCents: totals.subtotalCents, gstCents: totals.gstCents, totalCents: totals.totalCents, paidCents: paid, balanceDueCents: totals.totalCents - paid },
    booking: { pickup: facts.pickup, destination: facts.destination, packageName: facts.packageName },
    draft: true,
  };
}

export async function issueInvoice(id: string, idempotencyKey: string, actor: string): Promise<{ invoiceNumber: string; replayed: boolean }> {
  const invoice = await getInvoice(id);
  if (!invoice) throw new InvoiceError(404, "invoice_not_found", "Not found.");
  const settings = await getInvoiceSettings();
  const missing = missingInvoiceSettings(settings);
  if (missing.length) throw new InvoiceError(409, "invoice_settings_incomplete", `Complete the invoice settings before issuing (missing: ${missing.join(", ")}).`);
  const facts = await loadBookingFacts(invoice.bookingId);
  const totals = computeInvoiceTotals({ lines: invoice.lines, gstRegistered: settings?.gstRegistered ?? null, amountsIncludeGst: invoice.amountsIncludeGst });
  const snapshot = {
    seller: sellerIdentity(),
    booking: { pickup: facts.pickup, destination: facts.destination, packageName: facts.packageName },
    totals,
  };
  const { data, error } = await getSupabaseAdmin().rpc("issue_invoice", {
    p_invoice_id: id, p_idempotency_key: idempotencyKey, p_expected_version: invoice.version, p_snapshot: snapshot, p_actor: actor,
  });
  if (error) throw mapInvoiceError(error);
  const result = data as { invoiceNumber: string; replayed: boolean };
  return { invoiceNumber: result.invoiceNumber, replayed: result.replayed };
}

export async function recordInvoicePayment(input: {
  invoiceId: string; kind: "payment" | "reversal"; amountCents: number; receivedOn: string; method: string | null;
  reference: string | null; reversesPaymentId: string | null; idempotencyKey: string; actor: string;
}): Promise<{ balanceDueCents: number; replayed: boolean }> {
  const { data, error } = await getSupabaseAdmin().rpc("record_invoice_payment", {
    p_invoice_id: input.invoiceId, p_kind: input.kind, p_amount_cents: input.amountCents, p_received_on: input.receivedOn,
    p_method: input.method, p_reference: input.reference, p_reverses_payment_id: input.reversesPaymentId,
    p_idempotency_key: input.idempotencyKey, p_actor: input.actor,
  });
  if (error) throw mapInvoiceError(error);
  return data as { balanceDueCents: number; replayed: boolean };
}

export async function voidInvoice(id: string, reason: string, reissue: boolean, actor: string): Promise<{ newDraftId: string | null }> {
  const { data, error } = await getSupabaseAdmin().rpc("void_invoice", { p_invoice_id: id, p_reason: reason, p_reissue: reissue, p_actor: actor });
  if (error) throw mapInvoiceError(error);
  return { newDraftId: ((data as { newDraftId?: string | null }).newDraftId) ?? null };
}

export async function listInvoiceEvents(id: string): Promise<Array<{ id: string; event: string; actor: string | null; createdAt: string; metadata: Record<string, unknown> }>> {
  const { data, error } = await getSupabaseAdmin().from("invoice_events").select("*").eq("invoice_id", id).order("created_at", { ascending: true });
  if (error) throw mapInvoiceError(error);
  return ((data ?? []) as Row[]).map((e) => ({ id: e.id as string, event: e.event as string, actor: (e.actor as string | null) ?? null, createdAt: e.created_at as string, metadata: (e.metadata as Record<string, unknown>) ?? {} }));
}
