// Dependency-free PDF 1.4 writer for HF invoices: A4, built-in Helvetica /
// Helvetica-Bold (WinAnsi), uncompressed streams so the text is extractable and
// the output is byte-for-byte reproducible. No logo image is embedded: there is
// no confirmed-current logo file or invoice template in the repo, so the
// wordmark is drawn as text in the HF emerald/gold brand colours.
import { formatAbn, formatCents, formatQuantity, INVOICE_LINE_KIND_LABELS, type InvoiceLineKind } from "./invoice.ts";

export interface InvoiceSnapshot {
  title: "Tax invoice" | "Invoice";
  invoiceNumber: string | null;
  issueDate: string | null;
  dueDate: string | null;
  bookingReference: string;
  serviceDate: string;
  customer: { name?: string | null; email?: string | null; phone?: string | null };
  notes?: string | null;
  amountsIncludeGst: boolean | null;
  seller: {
    legalName?: string; tradingName?: string; address?: string; phone?: string; email?: string;
    abn?: string | null; gstRegistered?: boolean | null; paymentInstructions?: string | null;
    paymentTermsDays?: number | null; footerNote?: string | null; logoConfirmed?: boolean;
  };
  lines: Array<{ kind: InvoiceLineKind; description: string; quantityMilli: number; unitPriceCents: number; amountCents: number }>;
  payments: Array<{ kind: "deposit" | "payment" | "reversal"; amountCents: number; receivedOn: string; method?: string | null; reference?: string | null }>;
  totals: { subtotalCents: number; gstCents: number; totalCents: number; paidCents: number; balanceDueCents: number };
  booking?: { pickup?: string | null; destination?: string | null; packageName?: string | null };
  /** True when rendering a draft preview: stamped DRAFT, no number. */
  draft?: boolean;
  voided?: boolean;
}

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 48;
const EMERALD: [number, number, number] = [0.063, 0.267, 0.22];
const GOLD: [number, number, number] = [0.772, 0.643, 0.427];
const INK: [number, number, number] = [0.063, 0.094, 0.082];
const MUTED: [number, number, number] = [0.4, 0.45, 0.42];
const RULE: [number, number, number] = [0.82, 0.85, 0.83];

// Helvetica advance widths (1000 units/em) for printable ASCII 32..126.
const HELV = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const HELV_BOLD = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];

function textWidth(text: string, size: number, bold: boolean): number {
  const table = bold ? HELV_BOLD : HELV;
  let units = 0;
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    units += code >= 32 && code <= 126 ? (table[code - 32] as number) : 556;
  }
  return (units * size) / 1000;
}

/** WinAnsi-safe string for a PDF literal: transliterate what Helvetica cannot show, escape specials. */
function pdfText(value: string): string {
  const map: Record<string, string> = { "–": "-", "—": "-", "‘": "'", "’": "'", "“": '"', "”": '"', "•": "-", " ": " ", "−": "-" };
  let out = "";
  for (const ch of value.normalize("NFC")) {
    const mapped = map[ch] ?? ch;
    const code = mapped.charCodeAt(0);
    if (code === 0x5c || code === 0x28 || code === 0x29) out += `\\${mapped}`;
    else if (code >= 32 && code <= 126) out += mapped;
    else if (code >= 160 && code <= 255) out += `\\${code.toString(8).padStart(3, "0")}`;
    else out += "?";
  }
  return out;
}

class Page {
  ops: string[] = [];
  text(x: number, y: number, text: string, opts: { size?: number; bold?: boolean; color?: [number, number, number]; align?: "left" | "right" } = {}) {
    const size = opts.size ?? 10;
    const bold = opts.bold ?? false;
    const width = textWidth(text, size, bold);
    const px = opts.align === "right" ? x - width : x;
    const [r, g, b] = opts.color ?? INK;
    this.ops.push(`BT /${bold ? "F2" : "F1"} ${size} Tf ${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg ${px.toFixed(2)} ${y.toFixed(2)} Td (${pdfText(text)}) Tj ET`);
  }
  rect(x: number, y: number, w: number, h: number, color: [number, number, number]) {
    this.ops.push(`${color[0].toFixed(3)} ${color[1].toFixed(3)} ${color[2].toFixed(3)} rg ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
  }
  line(x1: number, y: number, x2: number, color: [number, number, number] = RULE, width = 0.6) {
    this.ops.push(`${color[0].toFixed(3)} ${color[1].toFixed(3)} ${color[2].toFixed(3)} RG ${width} w ${x1.toFixed(2)} ${y.toFixed(2)} m ${x2.toFixed(2)} ${y.toFixed(2)} l S`);
  }
}

function wrap(text: string, maxWidth: number, size: number, bold = false): string[] {
  const out: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    let current = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = current ? `${current} ${word}` : word;
      if (textWidth(candidate, size, bold) <= maxWidth) current = candidate;
      else {
        if (current) out.push(current);
        current = word;
      }
    }
    out.push(current);
  }
  return out;
}

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function formatInvoiceDate(ymd: string | null | undefined): string {
  if (!ymd) return "-";
  const [y, m, d] = ymd.slice(0, 10).split("-").map(Number) as [number, number, number];
  return `${d} ${monthNames[m - 1]} ${y}`;
}

export function renderInvoicePdf(invoice: InvoiceSnapshot): Uint8Array {
  const pages: Page[] = [];
  let page = new Page();
  pages.push(page);
  let y = PAGE_H - MARGIN;
  const right = PAGE_W - MARGIN;

  const stamp = (target: Page) => {
    const label = invoice.voided ? "VOID" : invoice.draft ? "DRAFT" : "";
    if (!label) return;
    target.ops.push(`q 0.5 g BT /F2 90 Tf 0.9 0.92 0.91 rg 1 0.45 -0.45 1 130 330 Tm (${label}) Tj ET Q`);
  };

  const header = (target: Page) => {
    target.rect(0, PAGE_H - 14, PAGE_W, 14, EMERALD);
    target.rect(0, PAGE_H - 17, PAGE_W, 3, GOLD);
    target.text(MARGIN, PAGE_H - 52, "HF", { size: 24, bold: true, color: EMERALD });
    target.text(MARGIN + 36, PAGE_H - 52, "Removals Adelaide", { size: 14, bold: true, color: EMERALD });
    target.text(right, PAGE_H - 50, invoice.title.toUpperCase(), { size: 18, bold: true, color: INK, align: "right" });
    target.text(right, PAGE_H - 66, invoice.draft ? "DRAFT - not yet issued" : (invoice.invoiceNumber ?? ""), { size: 11, bold: true, color: GOLD, align: "right" });
    stamp(target);
  };
  header(page);
  y = PAGE_H - 96;

  // Seller + invoice meta
  const seller = invoice.seller;
  const sellerLines = [
    seller.legalName ?? "",
    seller.tradingName && seller.tradingName !== seller.legalName ? `Trading as ${seller.tradingName}` : "",
    seller.address ?? "",
    [seller.phone, seller.email].filter(Boolean).join("  |  "),
    seller.abn ? `ABN ${formatAbn(seller.abn)}` : "",
  ].filter(Boolean);
  let sy = y;
  for (const [index, text] of sellerLines.entries()) {
    page.text(MARGIN, sy, text, { size: index === 0 ? 11 : 9.5, bold: index === 0, color: index === 0 ? INK : MUTED });
    sy -= 13;
  }
  const meta: Array<[string, string]> = [
    ["Issue date", invoice.draft ? "Not issued" : formatInvoiceDate(invoice.issueDate)],
    ["Due date", invoice.draft ? "-" : formatInvoiceDate(invoice.dueDate)],
    ["Booking ref", invoice.bookingReference],
    ["Service date", formatInvoiceDate(invoice.serviceDate)],
  ];
  let my = y;
  for (const [label, value] of meta) {
    page.text(right - 150, my, label, { size: 9, color: MUTED });
    page.text(right, my, value, { size: 9.5, bold: true, align: "right" });
    my -= 13;
  }
  y = Math.min(sy, my) - 18;

  // Customer block
  page.text(MARGIN, y, "BILL TO", { size: 8.5, bold: true, color: GOLD });
  y -= 14;
  page.text(MARGIN, y, invoice.customer.name || "Customer name not recorded", { size: 11, bold: true });
  y -= 13;
  for (const text of [invoice.customer.email, invoice.customer.phone].filter(Boolean) as string[]) {
    page.text(MARGIN, y, text, { size: 9.5, color: MUTED });
    y -= 12;
  }
  if (invoice.booking?.pickup || invoice.booking?.destination) {
    const route = [invoice.booking.pickup, invoice.booking.destination].filter(Boolean).join("  ->  ");
    for (const text of wrap(route, right - MARGIN, 9, false)) {
      page.text(MARGIN, y, text, { size: 9, color: MUTED });
      y -= 11;
    }
  }
  y -= 14;

  // Table header
  const colDesc = MARGIN + 8;
  const colQty = right - 190;
  const colUnit = right - 105;
  const colAmt = right - 8;
  const tableHeader = (target: Page, ty: number) => {
    target.rect(MARGIN, ty - 6, right - MARGIN, 22, EMERALD);
    target.text(colDesc, ty, "Description", { size: 9, bold: true, color: [1, 1, 1] });
    target.text(colQty, ty, "Qty", { size: 9, bold: true, color: [1, 1, 1], align: "right" });
    target.text(colUnit, ty, invoice.seller.gstRegistered ? (invoice.amountsIncludeGst ? "Unit (inc GST)" : "Unit (ex GST)") : "Unit price", { size: 9, bold: true, color: [1, 1, 1], align: "right" });
    target.text(colAmt, ty, "Amount", { size: 9, bold: true, color: [1, 1, 1], align: "right" });
  };
  tableHeader(page, y);
  y -= 24;

  const newPage = () => {
    page = new Page();
    pages.push(page);
    header(page);
    y = PAGE_H - 100;
    tableHeader(page, y);
    y -= 24;
  };

  for (const line of invoice.lines) {
    const descLines = wrap(`${line.description}`, colQty - colDesc - 40, 9.5);
    const height = descLines.length * 12 + 8;
    if (y - height < 190) newPage();
    const kindLabel = INVOICE_LINE_KIND_LABELS[line.kind] ?? line.kind;
    descLines.forEach((text, index) => page.text(colDesc, y - index * 12, text, { size: 9.5 }));
    page.text(colDesc, y - descLines.length * 12 + 1, kindLabel, { size: 7.5, color: MUTED });
    page.text(colQty, y, formatQuantity(line.quantityMilli), { size: 9.5, align: "right" });
    page.text(colUnit, y, formatCents(line.unitPriceCents), { size: 9.5, align: "right" });
    page.text(colAmt, y, formatCents(line.amountCents), { size: 9.5, bold: true, align: "right" });
    y -= height + 4;
    page.line(MARGIN, y + 6, right);
  }

  // Totals
  if (y < 230) newPage();
  y -= 10;
  const totalsX = right - 215;
  const totalRow = (label: string, value: string, strong = false) => {
    page.text(totalsX, y, label, { size: strong ? 11 : 9.5, bold: strong, color: strong ? INK : MUTED });
    page.text(colAmt, y, value, { size: strong ? 11 : 9.5, bold: strong, align: "right" });
    y -= strong ? 17 : 14;
  };
  const gst = Boolean(invoice.seller.gstRegistered);
  if (gst) totalRow("Subtotal (excl. GST)", formatCents(invoice.totals.subtotalCents));
  if (gst) totalRow("GST (10%)", formatCents(invoice.totals.gstCents));
  page.line(totalsX, y + 8, right, INK, 0.8);
  y -= 2;
  totalRow(gst ? "Total (incl. GST)" : "Total", formatCents(invoice.totals.totalCents), true);
  if (gst && invoice.amountsIncludeGst) page.text(right, y + 6, "Total price includes GST", { size: 8, color: MUTED, align: "right" });
  y -= 6;
  for (const payment of invoice.payments) {
    const label = payment.kind === "reversal" ? "Payment reversed" : payment.kind === "deposit" ? "Deposit received" : "Payment received";
    const detail = `${label} ${formatInvoiceDate(payment.receivedOn)}${payment.method ? ` (${payment.method})` : ""}`;
    totalRow(detail, `${payment.kind === "reversal" ? "" : "-"}${formatCents(payment.amountCents)}`);
  }
  page.rect(totalsX - 8, y - 6, right - totalsX + 8, 24, [0.93, 0.95, 0.93]);
  page.text(totalsX, y + 2, "Balance due", { size: 11, bold: true, color: EMERALD });
  page.text(colAmt, y + 2, formatCents(invoice.totals.balanceDueCents), { size: 12, bold: true, color: EMERALD, align: "right" });
  y -= 34;

  // Payment instructions, notes, footer
  const blocks: Array<[string, string | null | undefined]> = [
    ["PAYMENT", [invoice.seller.paymentInstructions, invoice.seller.paymentTermsDays != null && !invoice.draft ? `Payment terms: ${invoice.seller.paymentTermsDays} days (due ${formatInvoiceDate(invoice.dueDate)}).` : ""].filter(Boolean).join("\n")],
    ["NOTES", invoice.notes],
  ];
  for (const [label, body] of blocks) {
    if (!body) continue;
    const wrapped = wrap(body, right - MARGIN, 9.5);
    if (y - wrapped.length * 12 - 20 < MARGIN + 20) newPage();
    page.text(MARGIN, y, label, { size: 8.5, bold: true, color: GOLD });
    y -= 13;
    for (const text of wrapped) { page.text(MARGIN, y, text, { size: 9.5 }); y -= 12; }
    y -= 8;
  }
  if (invoice.seller.footerNote) {
    for (const text of wrap(invoice.seller.footerNote, right - MARGIN, 8.5)) { page.text(MARGIN, MARGIN, text, { size: 8.5, color: MUTED }); }
  }
  pages.forEach((p, index) => p.text(right, 28, `Page ${index + 1} of ${pages.length}`, { size: 8, color: MUTED, align: "right" }));

  return serialize(pages, invoice);
}

function serialize(pages: Page[], invoice: InvoiceSnapshot): Uint8Array {
  const objects: string[] = [];
  const add = (body: string) => { objects.push(body); return objects.length; };
  const catalog = add("");
  const pagesRoot = add("");
  const f1 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const f2 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  const info = add(`<< /Title (${pdfText(`${invoice.title} ${invoice.invoiceNumber ?? "draft"}`)}) /Producer (HF Removals Adelaide Dispatch) /Creator (HF Removals Adelaide Dispatch) >>`);
  const kids: number[] = [];
  for (const p of pages) {
    const content = p.ops.join("\n");
    const stream = add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    kids.push(add(`<< /Type /Page /Parent ${pagesRoot} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${stream} 0 R >>`));
  }
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesRoot} 0 R >>`;
  objects[pagesRoot - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`;

  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(out.length);
    out += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  // Every character written is ASCII/escaped, so latin1 round-trips 1:1 and offsets stay byte-accurate.
  return Uint8Array.from(out, (ch) => ch.charCodeAt(0) & 0xff);
}
