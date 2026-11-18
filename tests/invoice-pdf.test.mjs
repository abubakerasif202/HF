import assert from "node:assert/strict";
import test from "node:test";
import { renderInvoicePdf } from "../lib/invoice-pdf.ts";

const base = {
  title: "Tax invoice", invoiceNumber: "INV-000001", issueDate: "2026-11-18", dueDate: "2026-12-02",
  bookingReference: "HF-2025-00001", serviceDate: "2025-06-10",
  customer: { name: "Sample Customer 01", email: "sample01@example.invalid", phone: "0491 704 136" },
  notes: "Thank you for choosing HF Removals Adelaide.", amountsIncludeGst: true,
  seller: { legalName: "HF REMOVALS PTY LTD", address: "20 Prunus Ave, Elizabeth Vale SA 5112", phone: "0491 704 136", email: "admin@hfremovalsadelaide.com.au",
    abn: "51824753556", gstRegistered: true, bankAccountName: "HF REMOVALS ADELAIDE", bankBsb: "123456", bankAccountNumber: "12345678", paymentTermsDays: 14, footerNote: null },
  lines: [
    { kind: "service", description: "Removal service (HR truck + 2 movers)", quantityMilli: 3500, unitPriceCents: 15800, amountCents: 55300 },
    { kind: "call_out", description: "Call-out (truck fuel and basic transport)", quantityMilli: 1000, unitPriceCents: 15800, amountCents: 15800 },
  ],
  payments: [{ kind: "deposit", amountCents: 10000, receivedOn: "2025-05-20", method: "Booking confirmation payment" }],
  totals: { subtotalCents: 64636, gstCents: 6464, totalCents: 71100, paidCents: 10000, balanceDueCents: 61100 },
};

/** Pulls every drawn string out of the (uncompressed) content streams, as a text extractor would. */
function extractText(bytes) {
  const raw = Buffer.from(bytes).toString("latin1");
  return [...raw.matchAll(/\(((?:\\.|[^\\)])*)\) Tj/g)].map((m) => m[1].replace(/\\([()\\])/g, "$1"));
}

test("PDF is structurally valid: header, xref offsets, page tree and trailer", () => {
  const bytes = renderInvoicePdf(base);
  const raw = Buffer.from(bytes).toString("latin1");
  assert.match(raw, /^%PDF-1\.4\n/);
  assert.match(raw, /%%EOF\n$/);
  const startxref = Number(raw.match(/startxref\n(\d+)\n%%EOF/)[1]);
  assert.equal(raw.slice(startxref, startxref + 4), "xref");
  const entries = [...raw.slice(startxref).matchAll(/(\d{10}) 00000 n /g)].map((m) => Number(m[1]));
  entries.forEach((offset, index) => assert.match(raw.slice(offset, offset + 12), new RegExp(`^${index + 1} 0 obj`), `object ${index + 1} offset`));
  assert.match(raw, /\/Type \/Catalog/);
  assert.equal([...raw.matchAll(/\/Type \/Page /g)].length, 1);
  // Declared stream lengths match the bytes.
  for (const m of raw.matchAll(/\/Length (\d+) >>\nstream\n([\s\S]*?)\nendstream/g)) assert.equal(Number(m[1]), m[2].length);
});

test("issued tax invoice shows number, ABN, customer, lines, GST, deposit and balance", () => {
  const text = extractText(renderInvoicePdf(base)).join("\n");
  for (const expected of [
    "TAX INVOICE", "INV-000001", "HF Removals Pty Ltd  |  ABN 51 824 753 556", "Sample Customer 01", "HF-2025-00001",
    "ISSUED 18 NOVEMBER 2026", "STATUS PART PAID", "DUE 2 DECEMBER 2026", "10 June 2025", "Removal service (HR truck + 2 movers)", "3.5", "$158.00", "$553.00",
    "AMOUNT (AUD)", "SERVICE DESCRIPTION", "BILL TO", "SERVICE SUMMARY", "BANK TRANSFER DETAILS", "HF REMOVALS ADELAIDE", "BSB  123456", "Account  12345678", "Reference  INV-000001",
    "Subtotal (ex GST)", "$646.36", "GST (10%)", "$64.64", "TOTAL (INCL. GST)", "$711.00",
    "Deposit received 20 May 2025", "-$100.00", "PART PAID", "Balance outstanding: $611.00",
    "Thank you for choosing HF Removals Adelaide.", "This tax invoice includes GST at 10%.",
  ]) assert.ok(text.includes(expected), `missing "${expected}"`);
  assert.ok(!text.includes("DRAFT"));
});

test("non-GST invoice is titled Invoice and shows no GST rows", () => {
  const text = extractText(renderInvoicePdf({ ...base, title: "Invoice", amountsIncludeGst: null,
    seller: { ...base.seller, gstRegistered: false }, totals: { subtotalCents: 71100, gstCents: 0, totalCents: 71100, paidCents: 0, balanceDueCents: 71100 }, payments: [] })).join("\n");
  assert.ok(text.includes("INVOICE"));
  assert.ok(!text.includes("TAX INVOICE"));
  assert.ok(!text.includes("GST (10%)"));
  assert.ok(text.includes("TOTAL") && text.includes("$711.00") && text.includes("STATUS PAYMENT DUE"));
});

test("drafts and voided invoices are stamped; special characters are escaped", () => {
  const draft = Buffer.from(renderInvoicePdf({ ...base, draft: true, invoiceNumber: null, issueDate: null, dueDate: null })).toString("latin1");
  assert.ok(draft.includes("(DRAFT) Tj"));
  assert.ok(draft.includes("DRAFT - not yet issued"));
  assert.ok(!draft.includes("INV-000001"));
  assert.ok(Buffer.from(renderInvoicePdf({ ...base, voided: true })).toString("latin1").includes("(VOID) Tj"));
  const odd = extractText(renderInvoicePdf({ ...base, lines: [{ ...base.lines[0], description: "Piano (upright) \\ stairs – “fragile”" }] })).join("\n");
  assert.ok(odd.includes('Piano (upright) \\ stairs - "fragile"'));
});

test("paid in full invoices show the PAID IN FULL status panel, and the logo is embedded", () => {
  const paid = { ...base, totals: { ...base.totals, paidCents: 71100, balanceDueCents: 0 }, payments: [{ kind: "payment", amountCents: 71100, receivedOn: "2026-11-18" }] };
  const bytes = renderInvoicePdf(paid);
  const text = extractText(bytes);
  assert.ok(text.includes("STATUS PAID IN FULL") && text.includes("PAID IN FULL") && text.includes("Balance outstanding: $0.00"));
  const raw = Buffer.from(bytes).toString("latin1");
  assert.match(raw, /\/Subtype \/Image[^>]*\/Filter \/DCTDecode/);
  assert.ok(raw.includes("/Im1 Do"));
  assert.equal(Buffer.from(bytes).includes(Buffer.from([0xff, 0xd8, 0xff])), true, "JPEG data is embedded");
});

test("long invoices flow onto extra pages with a repeated header and page numbers", () => {
  const lines = Array.from({ length: 40 }, (_, i) => ({ kind: "other", description: `Extra item ${i + 1}`, quantityMilli: 1000, unitPriceCents: 1000, amountCents: 1000 }));
  const bytes = renderInvoicePdf({ ...base, lines, totals: { ...base.totals, subtotalCents: 40000, gstCents: 4000, totalCents: 44000, balanceDueCents: 34000 } });
  const raw = Buffer.from(bytes).toString("latin1");
  const pages = [...raw.matchAll(/\/Type \/Page /g)].length;
  assert.ok(pages >= 2, `pages: ${pages}`);
  const text = extractText(bytes);
  assert.ok(text.some((t) => /TAX INVOICE INV-000001 - continued/.test(t)));
  assert.ok(text.includes(`Page ${pages} of ${pages}`));
  assert.ok(text.includes("Extra item 40"));
});
