import assert from "node:assert/strict";
import test from "node:test";
import {
  balanceDueCents, computeInvoiceTotals, formatCents, formatQuantity, invoiceReadiness, isValidAbn, lineAmountCents,
  missingInvoiceSettings, paidCents, parseMoneyToCents, parseQuantityToMilli, prefillInvoiceFromBooking,
} from "../lib/invoice.ts";

const settings = (overrides = {}) => ({
  abn: "51824753556", gstRegistered: true, ratesIncludeGst: null, paymentInstructions: "Pay to the account shown.",
  paymentTermsDays: 14, invoicePrefix: "INV-", nextInvoiceNumber: 1, footerNote: null, logoConfirmed: false, ...overrides,
});
const hourly = (hours, dollars, kind = "service") => ({ kind, description: "x", quantityMilli: Math.round(hours * 1000), unitPriceCents: dollars * 100 });

test("hourly lines use integer cents: 3.5 h + 1 h call-out at $158/h", () => {
  const lines = [hourly(3.5, 158), hourly(1, 158, "call_out")];
  assert.equal(lineAmountCents(lines[0]), 55300);
  assert.deepEqual(computeInvoiceTotals({ lines, gstRegistered: false, amountsIncludeGst: null }), { lineTotalCents: 71100, subtotalCents: 71100, gstCents: 0, totalCents: 71100 });
});

test("fixed-price job is one line at quantity 1", () => {
  const totals = computeInvoiceTotals({ lines: [{ kind: "service", description: "Fixed", quantityMilli: 1000, unitPriceCents: 45000 }], gstRegistered: true, amountsIncludeGst: false });
  assert.deepEqual(totals, { lineTotalCents: 45000, subtotalCents: 45000, gstCents: 4500, totalCents: 49500 });
});

test("GST-inclusive entry takes one eleventh once, half-up; exclusive adds 10%", () => {
  const lines = [hourly(3.5, 158), hourly(1, 158, "call_out")]; // 71100
  assert.deepEqual(computeInvoiceTotals({ lines, gstRegistered: true, amountsIncludeGst: true }), { lineTotalCents: 71100, subtotalCents: 64636, gstCents: 6464, totalCents: 71100 });
  assert.deepEqual(computeInvoiceTotals({ lines, gstRegistered: true, amountsIncludeGst: false }), { lineTotalCents: 71100, subtotalCents: 71100, gstCents: 7110, totalCents: 78210 });
  // Not registered: no GST whichever way the amounts were typed.
  for (const amountsIncludeGst of [true, false, null]) {
    assert.equal(computeInvoiceTotals({ lines, gstRegistered: false, amountsIncludeGst }).gstCents, 0);
  }
  // Unknown registration is treated as not charging GST (issuance is blocked separately).
  assert.equal(computeInvoiceTotals({ lines, gstRegistered: null, amountsIncludeGst: true }).totalCents, 71100);
});

test("rounding is half-up at the cent for lines and GST", () => {
  assert.equal(lineAmountCents({ kind: "service", quantityMilli: 500, unitPriceCents: 1 }), 1); // 0.5c -> 1c
  assert.equal(lineAmountCents({ kind: "service", quantityMilli: 499, unitPriceCents: 1 }), 0);
  assert.equal(lineAmountCents({ kind: "service", quantityMilli: 3333, unitPriceCents: 1000 }), 3333);
  const incl = (cents) => computeInvoiceTotals({ lines: [{ kind: "other", description: "x", quantityMilli: 1000, unitPriceCents: cents }], gstRegistered: true, amountsIncludeGst: true }).gstCents;
  assert.deepEqual([incl(5), incl(6), incl(11), incl(16), incl(17)], [0, 1, 1, 1, 2]); // 6/11=.545 up; 16/11=1.45 down; 17/11=1.545 up
  const excl = (cents) => computeInvoiceTotals({ lines: [{ kind: "other", description: "x", quantityMilli: 1000, unitPriceCents: cents }], gstRegistered: true, amountsIncludeGst: false }).gstCents;
  assert.deepEqual([excl(4), excl(5), excl(14), excl(15)], [0, 1, 1, 2]);
});

test("surcharges add and discounts subtract, reducing the GST base", () => {
  const lines = [
    { kind: "service", description: "Move", quantityMilli: 1000, unitPriceCents: 100000 },
    { kind: "travel", description: "Travel", quantityMilli: 1000, unitPriceCents: 5000 },
    { kind: "packing", description: "Packing", quantityMilli: 2000, unitPriceCents: 2500 },
    { kind: "surcharge", description: "Stairs", quantityMilli: 1000, unitPriceCents: 3000 },
    { kind: "discount", description: "Returning customer", quantityMilli: 1000, unitPriceCents: 13000 },
  ];
  assert.equal(lineAmountCents(lines[4]), -13000);
  const totals = computeInvoiceTotals({ lines, gstRegistered: true, amountsIncludeGst: false });
  // 100000 + 5000 + (2 x 2500) + 3000 - 13000 = 100000, so GST is 10% of the reduced base.
  assert.deepEqual(totals, { lineTotalCents: 100000, subtotalCents: 100000, gstCents: 10000, totalCents: 110000 });
});

test("deposits and payments are separate from charges; reversals restore the balance", () => {
  const payments = [
    { kind: "deposit", amountCents: 10000 }, { kind: "payment", amountCents: 20000 }, { kind: "reversal", amountCents: 20000 },
  ];
  assert.equal(paidCents(payments), 10000);
  assert.equal(balanceDueCents(71100, payments), 61100);
  assert.equal(balanceDueCents(71100, []), 71100);
  assert.equal(balanceDueCents(10000, [{ kind: "payment", amountCents: 10000 }]), 0);
});

test("money and quantity parsing reject ambiguity", () => {
  assert.equal(parseMoneyToCents("1,234.5"), 123450);
  assert.equal(parseMoneyToCents("$158"), 15800);
  assert.equal(parseMoneyToCents("0.07"), 7);
  for (const bad of ["12.345", "-1", "abc", "", "1e3", "1.2.3"]) assert.equal(parseMoneyToCents(bad), null, bad);
  assert.equal(parseQuantityToMilli("3.5"), 3500);
  assert.equal(parseQuantityToMilli("0.001"), 1);
  for (const bad of ["0", "-1", "1.2345", "x", "1000.5"]) assert.equal(parseQuantityToMilli(bad), null, bad);
  assert.equal(formatQuantity(3500), "3.5");
  assert.equal(formatQuantity(1000), "1");
  assert.equal(formatCents(-1300), "-$13.00");
  assert.equal(formatCents(123456), "$1,234.56");
});

test("ABN checksum follows the ABR rule", () => {
  assert.equal(isValidAbn("51 824 753 556"), true); // ABR's published example
  assert.equal(isValidAbn("51824753557"), false);
  assert.equal(isValidAbn("5182475355"), false);
  assert.equal(isValidAbn(""), false);
});

test("missing HF settings are named and block issuance", () => {
  assert.deepEqual(missingInvoiceSettings(null).length, 5);
  assert.deepEqual(missingInvoiceSettings(settings({ abn: null, gstRegistered: null, invoicePrefix: null, paymentInstructions: " ", paymentTermsDays: null })),
    ["ABN", "GST registration status", "Invoice number prefix", "Payment instructions", "Payment terms"]);
  assert.deepEqual(missingInvoiceSettings(settings()), []);
  assert.match(missingInvoiceSettings(settings({ abn: "12345678901" }))[0], /valid ABN/);
  const ready = invoiceReadiness({ amountsIncludeGst: true, lines: [hourly(3, 158)], payments: [], pricingSource: "final_billing", customerName: "Sample" }, settings({ abn: null }));
  assert.match(ready.blockers[0], /Configure invoice settings first: ABN/);
});

const finalised = {
  booking_number: "HF-2025-00001", starts_at: "2025-06-09T23:30:00Z", estimated_duration_minutes: 240, booking_status: "completed",
  pricing_snapshot: { package: "HR truck + 2 movers", ratePer30MinCents: 7900, minimumBookingMinutes: 180, calloutMinutes: 60 },
  deposit_paid_cents: 10000, confirmed_at: "2025-05-20T01:00:00Z", finalised_at: "2025-06-10T04:00:00Z",
  billable_duration_minutes: 210, service_charge_cents: 55300, callout_fee_cents: 15800, final_total_cents: 71100,
  customers: { name: "Sample Customer 01", email: "sample01@example.invalid", phone: "0491 704 136" },
};

test("prefill keeps the agreed historical price and records the old deposit as a payment, not a line", () => {
  const draft = prefillInvoiceFromBooking(finalised, settings());
  assert.equal(draft.pricingSource, "final_billing");
  assert.equal(draft.serviceDate, "2025-06-10"); // Adelaide date, not the UTC date
  assert.deepEqual(draft.lines.map((l) => [l.kind, l.quantityMilli, l.unitPriceCents]), [["service", 3500, 15800], ["call_out", 1000, 15800]]);
  assert.deepEqual(draft.payments.map((p) => [p.kind, p.amountCents, p.source, p.receivedOn]), [["deposit", 10000, "booking_deposit", "2025-05-20"]]);
  assert.equal(draft.amountsIncludeGst, null, "GST entry mode is never assumed");
  assert.equal(draft.customer.name, "Sample Customer 01");
  // A later change to package rates cannot reach it: only the booking's own snapshot is read.
  const same = prefillInvoiceFromBooking({ ...finalised }, settings());
  assert.deepEqual(same.lines, draft.lines);
  // Recorded billing that cannot be rebuilt as hours wins over reconstruction.
  const odd = prefillInvoiceFromBooking({ ...finalised, service_charge_cents: 50000, final_total_cents: 65800 }, settings());
  assert.deepEqual(odd.lines.map((l) => l.unitPriceCents), [50000, 15800]);
});

test("prefill handles estimates, fixed quotes, recorded totals and missing pricing", () => {
  const estimate = prefillInvoiceFromBooking({ ...finalised, finalised_at: null, billable_duration_minutes: null, service_charge_cents: null, callout_fee_cents: null, final_total_cents: null, estimated_duration_minutes: 240 }, settings());
  assert.equal(estimate.pricingSource, "snapshot_estimate");
  assert.equal(estimate.lines[0].quantityMilli, 4000);
  const short = prefillInvoiceFromBooking({ ...finalised, finalised_at: null, estimated_duration_minutes: 60 }, settings());
  assert.equal(short.lines[0].quantityMilli, 3000, "3-hour minimum applies");
  const fixed = prefillInvoiceFromBooking({ ...finalised, dispatch_pricing_type: "fixed", dispatch_fixed_price_cents: 90000 }, settings());
  assert.deepEqual([fixed.pricingMode, fixed.pricingSource, fixed.lines.length, fixed.lines[0].unitPriceCents], ["fixed", "fixed_price", 1, 90000]);
  const recorded = prefillInvoiceFromBooking({ booking_number: "X", starts_at: "2024-03-01T00:00:00Z", pricing_snapshot: null, subtotal_cents: 25000, customers: null }, settings());
  assert.deepEqual([recorded.pricingSource, recorded.lines[0].unitPriceCents, recorded.customer.name], ["recorded_total", 25000, null]);
  const none = prefillInvoiceFromBooking({ booking_number: "X", starts_at: "2024-03-01T00:00:00Z", pricing_snapshot: null, subtotal_cents: 0 }, settings());
  assert.deepEqual([none.pricingSource, none.lines.length], ["none", 0]);
  const readiness = invoiceReadiness({ amountsIncludeGst: true, lines: none.lines, payments: [], pricingSource: none.pricingSource, customerName: "A" }, settings());
  assert.match(readiness.blockers.join(" "), /Pricing is missing/);
  assert.match(invoiceReadiness({ ...estimate, amountsIncludeGst: true, customerName: "A" }, settings()).warnings.join(" "), /booked estimate/);
});

test("readiness blocks unchosen GST mode, non-positive totals, overpayment and anonymous large tax invoices", () => {
  const base = { amountsIncludeGst: true, lines: [hourly(1, 158)], payments: [], pricingSource: "final_billing", customerName: "A" };
  assert.deepEqual(invoiceReadiness(base, settings()).blockers, []);
  assert.match(invoiceReadiness({ ...base, amountsIncludeGst: null }, settings()).blockers[0], /include GST or exclude GST/);
  assert.equal(invoiceReadiness({ ...base, amountsIncludeGst: null }, settings({ gstRegistered: false })).blockers.length, 0, "GST mode only matters when registered");
  assert.match(invoiceReadiness({ ...base, payments: [{ kind: "payment", amountCents: 99999 }] }, settings()).blockers[0], /exceed/);
  assert.match(invoiceReadiness({ ...base, lines: [{ ...hourly(1, 10), kind: "discount" }] }, settings()).blockers.join(" "), /above \$0/);
  assert.match(invoiceReadiness({ ...base, lines: [hourly(10, 158)], customerName: " " }, settings()).blockers.join(" "), /identify the customer/);
  const r = invoiceReadiness({ ...base, payments: [{ kind: "deposit", amountCents: 5000 }] }, settings());
  assert.deepEqual([r.totals.totalCents, r.paidCents, r.balanceDueCents], [15800, 5000, 10800]);
});
