// Pure invoice domain logic (no Next.js / Supabase imports): integer-cent
// arithmetic, GST, readiness checks and booking prefill. The SQL functions in
// migration 0019 implement the identical rounding so the issued total is
// enforced twice (see tests/invoice-database.test.mjs for the parity check).
//
// Rounding rule (documented once, used everywhere):
//   * line amount  = round-half-up(quantity x unit price), per line, in cents
//   * discounts    = negative lines, so they reduce the GST base
//   * GST (registered only), computed ONCE per invoice:
//       amounts include GST:  GST = round-half-up(total / 11)
//       amounts exclude GST:  GST = round-half-up(subtotal x 10%)
//   * GST is the statutory 10% Australian rate; whether HF is registered is a
//     setting (unknown until the owner confirms), never assumed.
import { adelaideYmd } from "./admin/dates.ts";

export const INVOICE_LINE_KINDS = ["service", "call_out", "travel", "packing", "surcharge", "discount", "other"] as const;
export type InvoiceLineKind = (typeof INVOICE_LINE_KINDS)[number];

export const INVOICE_LINE_KIND_LABELS: Record<InvoiceLineKind, string> = {
  service: "Service time",
  call_out: "Call-out fee",
  travel: "Travel",
  packing: "Packing",
  surcharge: "Surcharge",
  discount: "Discount",
  other: "Other",
};

export interface InvoiceLine {
  kind: InvoiceLineKind;
  description: string;
  /** Quantity in thousandths (1000 = 1 unit, 3500 = 3.5 hours). */
  quantityMilli: number;
  unitPriceCents: number;
}

export type InvoicePaymentKind = "deposit" | "payment" | "reversal";

export interface InvoicePayment {
  id?: string;
  /** Set on a reversal: the payment it cancels. */
  reversesPaymentId?: string | null;
  kind: InvoicePaymentKind;
  amountCents: number;
  receivedOn: string;
  method?: string | null;
  reference?: string | null;
  source?: "manual" | "booking_deposit";
}

export interface InvoiceTotals {
  lineTotalCents: number;
  subtotalCents: number;
  gstCents: number;
  totalCents: number;
}

/** Half-up integer division for non-negative numerators. */
function roundDiv(numerator: number, denominator: number): number {
  return Math.floor((2 * numerator + denominator) / (2 * denominator));
}

export function lineAmountCents(line: Pick<InvoiceLine, "kind" | "quantityMilli" | "unitPriceCents">): number {
  const magnitude = roundDiv(line.quantityMilli * line.unitPriceCents, 1000);
  return line.kind === "discount" ? -magnitude : magnitude;
}

export function computeInvoiceTotals(input: {
  lines: ReadonlyArray<Pick<InvoiceLine, "kind" | "quantityMilli" | "unitPriceCents">>;
  gstRegistered: boolean | null;
  amountsIncludeGst: boolean | null;
}): InvoiceTotals {
  const lineTotalCents = input.lines.reduce((sum, line) => sum + lineAmountCents(line), 0);
  if (!input.gstRegistered) {
    return { lineTotalCents, subtotalCents: lineTotalCents, gstCents: 0, totalCents: lineTotalCents };
  }
  if (input.amountsIncludeGst) {
    const gstCents = lineTotalCents > 0 ? roundDiv(lineTotalCents, 11) : 0;
    return { lineTotalCents, subtotalCents: lineTotalCents - gstCents, gstCents, totalCents: lineTotalCents };
  }
  const gstCents = lineTotalCents > 0 ? roundDiv(lineTotalCents, 10) : 0;
  return { lineTotalCents, subtotalCents: lineTotalCents, gstCents, totalCents: lineTotalCents + gstCents };
}

/** Money received against the invoice: deposits and payments less reversals. */
export function paidCents(payments: ReadonlyArray<Pick<InvoicePayment, "kind" | "amountCents">>): number {
  return payments.reduce((sum, p) => sum + (p.kind === "reversal" ? -p.amountCents : p.amountCents), 0);
}

export function balanceDueCents(totalCents: number, payments: ReadonlyArray<Pick<InvoicePayment, "kind" | "amountCents">>): number {
  return totalCents - paidCents(payments);
}

// ---- parsing & formatting -------------------------------------------------

/** "1,234.50" -> 123450. Rejects negatives, >2 decimals and non-numbers. */
export function parseMoneyToCents(input: string | number | null | undefined): number | null {
  const text = String(input ?? "").trim().replace(/^\$/, "").replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ""] = text.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents <= 100_000_000 ? cents : null;
}

/** "3.5" -> 3500. At most 3 decimals; positive and bounded. */
export function parseQuantityToMilli(input: string | number | null | undefined): number | null {
  const text = String(input ?? "").trim();
  if (!/^\d+(\.\d{1,3})?$/.test(text)) return null;
  const [whole, fraction = ""] = text.split(".");
  const milli = Number(whole) * 1000 + Number(fraction.padEnd(3, "0"));
  return milli > 0 && milli <= 1_000_000 ? milli : null;
}

export function formatQuantity(milli: number): string {
  const text = (milli / 1000).toFixed(3).replace(/\.?0+$/, "");
  return text === "" ? "0" : text;
}

export function formatCents(cents: number): string {
  const negative = cents < 0;
  const absolute = Math.abs(cents);
  const dollars = Math.floor(absolute / 100).toLocaleString("en-AU");
  return `${negative ? "-" : ""}$${dollars}.${String(absolute % 100).padStart(2, "0")}`;
}

// ---- ABN & settings --------------------------------------------------------

/** ABR checksum: subtract 1 from the first digit, weight 10,1,3,...,19, sum divisible by 89. */
export function isValidAbn(value: string | null | undefined): boolean {
  const digits = String(value ?? "").replace(/\s/g, "");
  if (!/^\d{11}$/.test(digits)) return false;
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const parts = digits.split("").map(Number);
  parts[0] = (parts[0] as number) - 1;
  return parts.reduce((sum, digit, index) => sum + digit * (weights[index] as number), 0) % 89 === 0;
}

export function formatAbn(abn: string): string {
  const d = abn.replace(/\s/g, "");
  return d.length === 11 ? `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}` : abn;
}

export interface InvoiceSettings {
  abn: string | null;
  gstRegistered: boolean | null;
  ratesIncludeGst: boolean | null;
  bankAccountName: string | null;
  bankBsb: string | null;
  bankAccountNumber: string | null;
  paymentInstructions: string | null;
  paymentTermsDays: number | null;
  invoicePrefix: string | null;
  nextInvoiceNumber: number;
  footerNote: string | null;
}

/** Human-readable names of every required invoice setting that is not configured. */
export function missingInvoiceSettings(settings: InvoiceSettings | null): string[] {
  if (!settings) return ["ABN", "GST registration status", "Invoice number prefix", "Bank account name", "BSB", "Account number", "Payment terms"];
  const missing: string[] = [];
  if (!settings.abn) missing.push("ABN");
  else if (!isValidAbn(settings.abn)) missing.push("A valid ABN (the saved number fails the ABR checksum)");
  if (settings.gstRegistered === null) missing.push("GST registration status");
  if (!settings.invoicePrefix) missing.push("Invoice number prefix");
  if (!settings.bankAccountName || !settings.bankAccountName.trim()) missing.push("Bank account name");
  if (!settings.bankBsb) missing.push("BSB");
  if (!settings.bankAccountNumber) missing.push("Account number");
  if (settings.paymentTermsDays === null) missing.push("Payment terms");
  return missing;
}

export function formatInvoiceNumber(prefix: string, sequence: number): string {
  return `${prefix}${String(sequence).padStart(6, "0")}`;
}

// ---- readiness --------------------------------------------------------------

export interface DraftForReadiness {
  amountsIncludeGst: boolean | null;
  lines: ReadonlyArray<InvoiceLine>;
  payments: ReadonlyArray<InvoicePayment>;
  pricingSource: string;
  customerName: string | null;
  bookingStatus?: string | null;
}

export interface InvoiceReadiness {
  blockers: string[];
  warnings: string[];
  totals: InvoiceTotals;
  paidCents: number;
  balanceDueCents: number;
}

/** What stops an invoice being issued (blockers) and what staff should double-check (warnings). */
export function invoiceReadiness(draft: DraftForReadiness, settings: InvoiceSettings | null): InvoiceReadiness {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const missing = missingInvoiceSettings(settings);
  if (missing.length) blockers.push(`Configure invoice settings first: ${missing.join(", ")}.`);

  if (draft.lines.length === 0) blockers.push("Pricing is missing for this booking. Add at least one priced line item before issuing.");
  for (const [index, line] of draft.lines.entries()) {
    if (!line.description.trim()) blockers.push(`Line ${index + 1} needs a description.`);
    if (!Number.isInteger(line.quantityMilli) || line.quantityMilli <= 0) blockers.push(`Line ${index + 1} needs a quantity above zero.`);
    if (!Number.isInteger(line.unitPriceCents) || line.unitPriceCents < 0) blockers.push(`Line ${index + 1} needs a valid price.`);
  }

  const gstRegistered = settings?.gstRegistered ?? null;
  if (gstRegistered && draft.amountsIncludeGst === null) {
    blockers.push("Choose whether the entered amounts include GST or exclude GST.");
  }
  const totals = computeInvoiceTotals({ lines: draft.lines, gstRegistered, amountsIncludeGst: draft.amountsIncludeGst });
  const paid = paidCents(draft.payments);
  if (draft.lines.length > 0 && totals.totalCents <= 0) blockers.push("The invoice total must be above $0.00.");
  if (paid > totals.totalCents && totals.totalCents > 0) blockers.push("Recorded payments exceed the invoice total.");
  if (gstRegistered && totals.totalCents >= 100_000 && !(draft.customerName ?? "").trim()) {
    blockers.push("A tax invoice of $1,000 or more must identify the customer. Add the customer name.");
  }

  if (draft.pricingSource === "snapshot_estimate") warnings.push("Prefilled from the booked estimate, not final billing. Confirm the actual service time.");
  if (draft.pricingSource === "recorded_total") warnings.push("Prefilled from the booking's recorded total because no rate was stored. Confirm the agreed price.");
  if (draft.bookingStatus && draft.bookingStatus !== "completed") warnings.push(`The booking is "${draft.bookingStatus.replaceAll("_", " ")}", not completed.`);
  return { blockers, warnings, totals, paidCents: paid, balanceDueCents: totals.totalCents - paid };
}

// ---- prefill ----------------------------------------------------------------

export interface PrefillBooking {
  booking_number: string;
  booking_status?: string | null;
  starts_at: string;
  estimated_duration_minutes?: number | null;
  pricing_snapshot?: {
    package?: string;
    ratePer30MinCents?: number;
    minimumBookingMinutes?: number;
    calloutMinutes?: number;
  } | null;
  subtotal_cents?: number | null;
  deposit_paid_cents?: number | null;
  confirmed_at?: string | null;
  created_at?: string | null;
  finalised_at?: string | null;
  billable_duration_minutes?: number | null;
  service_charge_cents?: number | null;
  callout_fee_cents?: number | null;
  final_total_cents?: number | null;
  dispatch_pricing_type?: "fixed" | "hourly" | null;
  dispatch_fixed_price_cents?: number | null;
  customers?: { name?: string | null; email?: string | null; phone?: string | null } | null;
}

export type PricingSource = "final_billing" | "snapshot_estimate" | "fixed_price" | "recorded_total" | "none";

export interface InvoiceDraftPayload {
  pricingMode: "hourly" | "fixed";
  pricingSource: PricingSource;
  amountsIncludeGst: boolean | null;
  customer: { name: string | null; email: string | null; phone: string | null };
  bookingReference: string;
  serviceDate: string;
  notes: null;
  lines: InvoiceLine[];
  payments: InvoicePayment[];
}

const AGREED_PRICE_LABELS: Record<PricingSource, string> = {
  fixed_price: "Fixed quote recorded in Dispatch",
  final_billing: "Final billed total",
  snapshot_estimate: "Estimate at the booked rate; final price is set when the job is finished",
  recorded_total: "Recorded booking total",
  none: "",
};

/** The booking's agreed price as staff should see it, from the booking's own frozen figures (never live rates). */
export function agreedPriceSummary(booking: PrefillBooking): { cents: number; label: string } | null {
  const draft = prefillInvoiceFromBooking(booking, null);
  if (draft.lines.length === 0) return null;
  const cents = draft.lines.reduce((sum, line) => sum + lineAmountCents(line), 0);
  return cents > 0 ? { cents, label: AGREED_PRICE_LABELS[draft.pricingSource] } : null;
}

function hourlyLines(packageName: string | undefined, rate30: number, billableMinutes: number, calloutMinutes: number): InvoiceLine[] {
  const hourly = rate30 * 2;
  const service = billableMinutes * 1000 / 60;
  const callout = calloutMinutes * 1000 / 60;
  const label = packageName ? ` (${packageName})` : "";
  return [
    { kind: "service", description: `Removal service${label}`, quantityMilli: service, unitPriceCents: hourly },
    { kind: "call_out", description: "Call-out (truck fuel and basic transport)", quantityMilli: callout, unitPriceCents: hourly },
  ];
}

/**
 * Builds a draft from a booking WITHOUT reading live pricing rules: the price
 * comes from the booking's own frozen snapshot / recorded billing, so package
 * rate changes never alter historical bookings.
 */
export function prefillInvoiceFromBooking(booking: PrefillBooking, settings: InvoiceSettings | null): InvoiceDraftPayload {
  const snapshot = booking.pricing_snapshot ?? null;
  const rate30 = snapshot?.ratePer30MinCents && snapshot.ratePer30MinCents > 0 ? snapshot.ratePer30MinCents : null;
  const calloutMinutes = snapshot?.calloutMinutes ?? 60;
  let pricingMode: "hourly" | "fixed" = "hourly";
  let pricingSource: PricingSource = "none";
  let lines: InvoiceLine[] = [];

  const fixed = booking.dispatch_fixed_price_cents ?? 0;
  const recordedFinal = booking.final_total_cents ?? 0;
  const recordedTotal = recordedFinal > 0 ? recordedFinal : (booking.subtotal_cents ?? 0);

  if (booking.dispatch_pricing_type === "fixed" && fixed > 0) {
    pricingMode = "fixed";
    pricingSource = "fixed_price";
    lines = [{ kind: "service", description: "Fixed-price removal service", quantityMilli: 1000, unitPriceCents: fixed }];
  } else if (booking.finalised_at && rate30 && booking.billable_duration_minutes && booking.service_charge_cents != null && booking.callout_fee_cents != null) {
    pricingSource = "final_billing";
    const exact = hourlyLines(snapshot?.package, rate30, booking.billable_duration_minutes, calloutMinutes);
    const exactTotal = exact.reduce((sum, line) => sum + lineAmountCents(line), 0);
    const integral = exact.every((line) => Number.isInteger(line.quantityMilli));
    if (integral && exactTotal === booking.service_charge_cents + booking.callout_fee_cents) {
      lines = exact;
    } else {
      // Recorded amounts win over any reconstruction.
      lines = [
        { kind: "service", description: "Removal service (final billing)", quantityMilli: 1000, unitPriceCents: booking.service_charge_cents },
        { kind: "call_out", description: "Call-out (truck fuel and basic transport)", quantityMilli: 1000, unitPriceCents: booking.callout_fee_cents },
      ].filter((line) => line.unitPriceCents > 0) as InvoiceLine[];
    }
  } else if (rate30) {
    pricingSource = "snapshot_estimate";
    const minimum = snapshot?.minimumBookingMinutes ?? 180;
    const estimated = Math.max(booking.estimated_duration_minutes ?? 0, minimum);
    const billable = Math.ceil(estimated / 30) * 30;
    lines = hourlyLines(snapshot?.package, rate30, billable, calloutMinutes);
  } else if (recordedTotal > 0) {
    pricingMode = "fixed";
    pricingSource = "recorded_total";
    lines = [{ kind: "service", description: "Agreed removal price (recorded booking total)", quantityMilli: 1000, unitPriceCents: recordedTotal }];
  }

  const payments: InvoicePayment[] = [];
  const deposit = booking.deposit_paid_cents ?? 0;
  if (deposit > 0) {
    payments.push({
      kind: "deposit",
      amountCents: deposit,
      receivedOn: adelaideYmd(booking.confirmed_at ?? booking.created_at ?? booking.starts_at),
      method: "Booking confirmation payment",
      reference: null,
      source: "booking_deposit",
    });
  }

  return {
    pricingMode,
    pricingSource,
    amountsIncludeGst: settings?.ratesIncludeGst ?? null,
    customer: { name: booking.customers?.name ?? null, email: booking.customers?.email ?? null, phone: booking.customers?.phone ?? null },
    bookingReference: booking.booking_number,
    serviceDate: adelaideYmd(booking.starts_at),
    notes: null,
    lines,
    payments,
  };
}
