"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getStaffSession } from "../../../../lib/server/supabase-ssr.ts";
import {
  createInvoiceDraftForBooking, discardInvoiceDraft, InvoiceError, issueInvoice, mapInvoiceError, recordInvoicePayment,
  saveInvoiceDraft, saveInvoiceSettings, voidInvoice,
} from "../../../../lib/server/invoice-repo.ts";
import { INVOICE_LINE_KINDS, isValidAbn } from "../../../../lib/invoice.ts";

type Result<T = object> = ({ error?: undefined } & T) | { error: string };

async function requireStaff() {
  const session = await getStaffSession();
  if (!session) throw new Error("Not authorized");
  return session;
}

/** Turns operational failures into staff-readable errors; never leaks SQL or stack text. */
async function attempt<T extends object>(run: () => Promise<T>): Promise<Result<T>> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof z.ZodError) return { error: "Some details are invalid. Check the highlighted fields." };
    return { error: mapInvoiceError(error).message };
  }
}
const uuid = z.string().uuid();
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value, "Invalid date");
const key = z.string().min(8).max(100);
const text = (max: number) => z.string().trim().max(max);

const lineSchema = z.object({
  kind: z.enum(INVOICE_LINE_KINDS),
  description: text(300).min(1),
  quantityMilli: z.number().int().min(1).max(1_000_000),
  unitPriceCents: z.number().int().min(0).max(100_000_000),
}).strict();

const draftSchema = z.object({
  invoiceId: uuid,
  version: z.number().int().min(1),
  customer: z.object({ name: text(200).nullable(), email: text(200).nullable(), phone: text(60).nullable() }).strict(),
  notes: text(2000).nullable(),
  serviceDate: ymd,
  amountsIncludeGst: z.boolean().nullable(),
  lines: z.array(lineSchema).max(50),
  payments: z.array(z.object({
    kind: z.enum(["deposit", "payment"]),
    amountCents: z.number().int().min(1).max(100_000_000),
    receivedOn: ymd,
    method: text(60).nullable().optional(),
    reference: text(120).nullable().optional(),
    source: z.enum(["manual", "booking_deposit"]).optional(),
  }).strict()).max(50),
}).strict();

export type SaveDraftInput = z.input<typeof draftSchema>;

export async function createInvoiceDraftAction(bookingId: string): Promise<{ error: string }> {
  const staff = await requireStaff();
  let invoiceId: string | null = null;
  const result = await attempt(async () => {
    const created = await createInvoiceDraftForBooking(uuid.parse(bookingId), staff.userId);
    invoiceId = created.id;
    return {};
  });
  if (result.error || !invoiceId) return { error: result.error ?? "Could not create the invoice." };
  revalidatePath(`/admin/bookings/${bookingId}`);
  redirect(`/admin/invoices/${invoiceId}`);
}

export async function saveInvoiceDraftAction(input: SaveDraftInput): Promise<Result<{ version: number }>> {
  const staff = await requireStaff();
  return attempt(async () => {
    const data = draftSchema.parse(input);
    const saved = await saveInvoiceDraft(data.invoiceId, data.version, staff.userId, {
      customer: data.customer, notes: data.notes, serviceDate: data.serviceDate, amountsIncludeGst: data.amountsIncludeGst,
      lines: data.lines, payments: data.payments.map((p) => ({ ...p, method: p.method ?? null, reference: p.reference ?? null })),
    });
    revalidatePath(`/admin/invoices/${data.invoiceId}`);
    return { version: saved.version };
  });
}

export async function issueInvoiceAction(invoiceId: string, idempotencyKey: string): Promise<Result<{ invoiceNumber: string; replayed: boolean }>> {
  const staff = await requireStaff();
  return attempt(async () => {
    const result = await issueInvoice(uuid.parse(invoiceId), key.parse(idempotencyKey), staff.userId);
    revalidatePath(`/admin/invoices/${invoiceId}`);
    revalidatePath("/admin/invoices");
    return result;
  });
}

export async function recordPaymentAction(input: {
  invoiceId: string; amountCents: number; receivedOn: string; method: string | null; reference: string | null; idempotencyKey: string;
}): Promise<Result<{ balanceDueCents: number; replayed: boolean }>> {
  const staff = await requireStaff();
  return attempt(async () => {
    const data = z.object({ invoiceId: uuid, amountCents: z.number().int().min(1).max(100_000_000), receivedOn: ymd, method: text(60).nullable(), reference: text(120).nullable(), idempotencyKey: key }).strict().parse(input);
    const result = await recordInvoicePayment({ ...data, kind: "payment", reversesPaymentId: null, actor: staff.userId });
    revalidatePath(`/admin/invoices/${data.invoiceId}`);
    return result;
  });
}

export async function reversePaymentAction(input: {
  invoiceId: string; paymentId: string; amountCents: number; receivedOn: string; reason: string; idempotencyKey: string;
}): Promise<Result<{ balanceDueCents: number; replayed: boolean }>> {
  const staff = await requireStaff();
  return attempt(async () => {
    const data = z.object({ invoiceId: uuid, paymentId: uuid, amountCents: z.number().int().min(1).max(100_000_000), receivedOn: ymd, reason: text(120).min(3), idempotencyKey: key }).strict().parse(input);
    const result = await recordInvoicePayment({
      invoiceId: data.invoiceId, kind: "reversal", amountCents: data.amountCents, receivedOn: data.receivedOn, method: data.reason,
      reference: null, reversesPaymentId: data.paymentId, idempotencyKey: data.idempotencyKey, actor: staff.userId,
    });
    revalidatePath(`/admin/invoices/${data.invoiceId}`);
    return result;
  });
}

/** Void an issued invoice (reason required). With reissue, a corrected draft is created and opened. */
export async function voidInvoiceAction(invoiceId: string, reason: string, reissue: boolean): Promise<{ error: string }> {
  const staff = await requireStaff();
  let newDraftId: string | null = null;
  const result = await attempt(async () => {
    const outcome = await voidInvoice(uuid.parse(invoiceId), text(300).min(3).parse(reason), Boolean(reissue), staff.userId);
    newDraftId = outcome.newDraftId;
    return {};
  });
  if (result.error) return { error: result.error };
  revalidatePath(`/admin/invoices/${invoiceId}`);
  revalidatePath("/admin/invoices");
  redirect(newDraftId ? `/admin/invoices/${newDraftId}` : `/admin/invoices/${invoiceId}`);
}

export async function discardInvoiceDraftAction(invoiceId: string): Promise<{ error: string }> {
  await requireStaff();
  const result = await attempt(async () => {
    await discardInvoiceDraft(uuid.parse(invoiceId));
    return {};
  });
  if (result.error) return { error: result.error };
  revalidatePath("/admin/invoices");
  redirect("/admin/invoices");
}

const triState = (value: FormDataEntryValue | null, yes: string, no: string): boolean | null => (value === yes ? true : value === no ? false : null);

/** Saves HF's invoice settings. Blank means "not configured": nothing is ever defaulted or invented. */
export async function saveInvoiceSettingsAction(formData: FormData): Promise<Result> {
  await requireStaff();
  return attempt(async () => {
    const abnRaw = String(formData.get("abn") ?? "").replace(/\s/g, "");
    if (abnRaw && !isValidAbn(abnRaw)) throw new InvoiceError(400, "abn", "That ABN is not valid. Check the 11 digits against the ABN Lookup record.");
    const prefix = String(formData.get("invoice_prefix") ?? "").trim();
    if (prefix && !/^[A-Za-z0-9-]{1,12}$/.test(prefix)) throw new InvoiceError(400, "prefix", "The prefix can use letters, numbers and dashes (up to 12).");
    const termsRaw = String(formData.get("payment_terms_days") ?? "").trim();
    if (termsRaw && !/^\d{1,3}$/.test(termsRaw)) throw new InvoiceError(400, "terms", "Payment terms must be a whole number of days (0-365).");
    const terms = termsRaw ? Number(termsRaw) : null;
    if (terms !== null && terms > 365) throw new InvoiceError(400, "terms", "Payment terms must be a whole number of days (0-365).");
    const nextRaw = String(formData.get("next_invoice_number") ?? "").trim();
    if (nextRaw && !/^\d{1,9}$/.test(nextRaw)) throw new InvoiceError(400, "next", "The next invoice number must be a whole number of 1 or more.");
    const bankName = String(formData.get("bank_account_name") ?? "").trim();
    const bsb = String(formData.get("bank_bsb") ?? "").replace(/[\s-]/g, "");
    const account = String(formData.get("bank_account_number") ?? "").replace(/\s/g, "");
    if (bankName.length > 80) throw new InvoiceError(400, "bank", "The account name is too long (80 characters).");
    if (bsb && !/^\d{6}$/.test(bsb)) throw new InvoiceError(400, "bsb", "The BSB must be 6 digits.");
    if (account && !/^\d{5,12}$/.test(account)) throw new InvoiceError(400, "account", "The account number must be 5 to 12 digits.");
    const instructions = String(formData.get("payment_instructions") ?? "").trim();
    const footer = String(formData.get("footer_note") ?? "").trim();
    if (instructions.length > 1000 || footer.length > 500) throw new InvoiceError(400, "length", "Payment instructions (1000) or footer (500) is too long.");
    await saveInvoiceSettings({
      abn: abnRaw || null,
      gstRegistered: triState(formData.get("gst_registered"), "yes", "no"),
      ratesIncludeGst: triState(formData.get("rates_include_gst"), "inclusive", "exclusive"),
      bankAccountName: bankName || null,
      bankBsb: bsb || null,
      bankAccountNumber: account || null,
      paymentInstructions: instructions || null,
      paymentTermsDays: terms,
      invoicePrefix: prefix || null,
      ...(nextRaw ? { nextInvoiceNumber: Number(nextRaw) } : {}),
      footerNote: footer || null,
    });
    revalidatePath("/admin/invoices");
    revalidatePath("/admin/invoices/settings");
    return {};
  });
}
