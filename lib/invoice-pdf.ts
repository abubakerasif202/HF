// Dependency-free PDF 1.4 writer for HF invoices, laid out to match the owner-approved HF invoice
// template: logo block, TAX INVOICE heading, bill-to / service summary, pick-up and drop-off panel,
// green description bar, tinted line rows, bank transfer details, totals, status panel and gold footer bar.
// A4, built-in Helvetica (WinAnsi), uncompressed content streams so text stays extractable.
import { HF_LOGO_JPEG } from "./invoice-logo.ts";
import { formatAbn, formatCents, formatQuantity } from "./invoice.ts";

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
    bankAccountName?: string | null; bankBsb?: string | null; bankAccountNumber?: string | null;
    paymentTermsDays?: number | null; footerNote?: string | null;
  };
  lines: Array<{ kind: string; description: string; quantityMilli: number; unitPriceCents: number; amountCents: number }>;
  payments: Array<{ kind: "deposit" | "payment" | "reversal"; amountCents: number; receivedOn: string; method?: string | null; reference?: string | null }>;
  totals: { subtotalCents: number; gstCents: number; totalCents: number; paidCents: number; balanceDueCents: number };
  booking?: { pickup?: string | null; destination?: string | null; packageName?: string | null; serviceSummary?: string | null };
  /** True when rendering a draft preview: stamped DRAFT, no number. */
  draft?: boolean;
  voided?: boolean;
}

type Rgb = [number, number, number];
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 44;
const GREEN: Rgb = [0, 0.231, 0.157];
const GOLD: Rgb = [0.788, 0.541, 0.169];
const INK: Rgb = [0.063, 0.094, 0.082];
const MUTED: Rgb = [0.42, 0.46, 0.44];
const TINT: Rgb = [0.933, 0.957, 0.937];
const PAID_TINT: Rgb = [0.906, 0.941, 0.918];
const RULE: Rgb = [0.84, 0.88, 0.87];
const WHITE: Rgb = [1, 1, 1];

// Helvetica advance widths (1000 units/em) for printable ASCII 32..126.
const HELV = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const HELV_BOLD = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];

function textWidth(text: string, size: number, bold: boolean, tracking = 0): number {
  const table = bold ? HELV_BOLD : HELV;
  let units = 0;
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    units += code >= 32 && code <= 126 ? (table[code - 32] as number) : 556;
  }
  return (units * size) / 1000 + tracking * text.length;
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

const c3 = (c: Rgb) => `${c[0].toFixed(3)} ${c[1].toFixed(3)} ${c[2].toFixed(3)}`;

class Page {
  ops: string[] = [];
  usesLogo = false;
  /** Text with its baseline at y (PDF origin is bottom-left). */
  text(x: number, y: number, text: string, o: { size?: number; bold?: boolean; color?: Rgb; align?: "left" | "right"; tracking?: number } = {}) {
    const size = o.size ?? 10;
    const bold = o.bold ?? false;
    const tracking = o.tracking ?? 0;
    const width = textWidth(text, size, bold, tracking);
    const px = o.align === "right" ? x - width : x;
    this.ops.push(`BT /${bold ? "F2" : "F1"} ${size} Tf ${tracking ? `${tracking} Tc ` : ""}${c3(o.color ?? INK)} rg ${px.toFixed(2)} ${y.toFixed(2)} Td (${pdfText(text)}) Tj ET`);
  }
  rect(x: number, y: number, w: number, h: number, color: Rgb) {
    this.ops.push(`${c3(color)} rg ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
  }
  rrect(x: number, y: number, w: number, h: number, r: number, color: Rgb) {
    const k = r * 0.5523;
    this.ops.push(`${c3(color)} rg ${(x + r).toFixed(2)} ${y.toFixed(2)} m ${(x + w - r).toFixed(2)} ${y.toFixed(2)} l ${(x + w - r + k).toFixed(2)} ${y.toFixed(2)} ${(x + w).toFixed(2)} ${(y + r - k).toFixed(2)} ${(x + w).toFixed(2)} ${(y + r).toFixed(2)} c ${(x + w).toFixed(2)} ${(y + h - r).toFixed(2)} l ${(x + w).toFixed(2)} ${(y + h - r + k).toFixed(2)} ${(x + w - r + k).toFixed(2)} ${(y + h).toFixed(2)} ${(x + w - r).toFixed(2)} ${(y + h).toFixed(2)} c ${(x + r).toFixed(2)} ${(y + h).toFixed(2)} l ${(x + r - k).toFixed(2)} ${(y + h).toFixed(2)} ${x.toFixed(2)} ${(y + h - r + k).toFixed(2)} ${x.toFixed(2)} ${(y + h - r).toFixed(2)} c ${x.toFixed(2)} ${(y + r).toFixed(2)} l ${x.toFixed(2)} ${(y + r - k).toFixed(2)} ${(x + r - k).toFixed(2)} ${y.toFixed(2)} ${(x + r).toFixed(2)} ${y.toFixed(2)} c f`);
  }
  line(x1: number, y: number, x2: number, color: Rgb = RULE, width = 0.7) {
    this.ops.push(`${c3(color)} RG ${width} w ${x1.toFixed(2)} ${y.toFixed(2)} m ${x2.toFixed(2)} ${y.toFixed(2)} l S`);
  }
  logo(x: number, y: number, w: number) {
    this.usesLogo = true;
    const h = (w * HF_LOGO_JPEG.height) / HF_LOGO_JPEG.width;
    this.ops.push(`q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /Im1 Do Q`);
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

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** "18 November 2026". */
export function formatInvoiceDate(ymd: string | null | undefined): string {
  if (!ymd) return "-";
  const [y, m, d] = ymd.slice(0, 10).split("-").map(Number) as [number, number, number];
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
const shortDate = (ymd: string) => formatInvoiceDate(ymd).replace(/^(\d+) (\w{3})\w* /, "$1 $2 ");

/** Payment status shown under the heading and in the closing panel. */
export function invoiceStatusLabel(invoice: Pick<InvoiceSnapshot, "draft" | "voided" | "totals">): string {
  if (invoice.voided) return "VOID";
  if (invoice.draft) return "DRAFT";
  const { totalCents, paidCents, balanceDueCents } = invoice.totals;
  if (balanceDueCents <= 0 && totalCents > 0) return "PAID IN FULL";
  return paidCents > 0 ? "PART PAID" : "PAYMENT DUE";
}

export function renderInvoicePdf(invoice: InvoiceSnapshot): Uint8Array {
  const pages: Page[] = [];
  const right = PAGE_W - MARGIN;
  const width = right - MARGIN;
  const gst = Boolean(invoice.seller.gstRegistered);
  const status = invoiceStatusLabel(invoice);
  const seller = invoice.seller;
  let page = new Page();
  pages.push(page);

  const chrome = (target: Page) => {
    target.rect(0, 0, PAGE_W, 7, GOLD);
    const label = invoice.voided ? "VOID" : invoice.draft ? "DRAFT" : "";
    if (label) target.ops.push(`q BT /F2 96 Tf 0.91 0.93 0.92 rg 0.9 0.43 -0.43 0.9 120 330 Tm (${label}) Tj ET Q`);
  };
  chrome(page);

  // ---- header: logo + business block (left), title block (right) ----
  const logoW = 140;
  const logoH = (logoW * HF_LOGO_JPEG.height) / HF_LOGO_JPEG.width;
  let y = PAGE_H - 44 - logoH;
  page.logo(MARGIN, y, logoW);
  page.text(right, PAGE_H - 62, invoice.title.toUpperCase(), { size: 27, bold: true, align: "right" });
  page.text(right, PAGE_H - 80, invoice.draft ? "DRAFT - not yet issued" : (invoice.invoiceNumber ?? ""), { size: 10.5, color: MUTED, align: "right" });
  if (!invoice.draft) page.text(right, PAGE_H - 106, `ISSUED ${formatInvoiceDate(invoice.issueDate).toUpperCase()}`, { size: 9.5, bold: true, align: "right" });
  page.text(right, PAGE_H - 121, `STATUS ${status}`, { size: 9, bold: true, color: GOLD, align: "right" });
  if (!invoice.draft && !invoice.voided && invoice.dueDate && invoice.totals.balanceDueCents > 0) {
    page.text(right, PAGE_H - 135, `DUE ${formatInvoiceDate(invoice.dueDate).toUpperCase()}`, { size: 8.5, bold: true, color: MUTED, align: "right" });
  }

  y -= 20;
  page.text(MARGIN, y, (seller.tradingName ?? "HF Removals Adelaide").toUpperCase(), { size: 11.5, bold: true });
  const legal = [seller.legalName ? seller.legalName.replace(/\b(PTY LTD)\b/i, "Pty Ltd").replace(/^HF REMOVALS/, "HF Removals") : "", seller.abn ? `ABN ${formatAbn(seller.abn)}` : ""].filter(Boolean).join("  |  ");
  for (const text of [legal, seller.address ?? "", [seller.phone, seller.email].filter(Boolean).join("  |  ")].filter(Boolean)) {
    y -= 14.5;
    page.text(MARGIN, y, text, { size: 8.8, color: MUTED });
  }
  y -= 22;
  page.line(MARGIN, y, right);

  // ---- bill to / service summary ----
  y -= 24;
  page.text(MARGIN, y, "BILL TO", { size: 8.5, bold: true, color: GOLD, tracking: 0.4 });
  page.text(right, y, "SERVICE SUMMARY", { size: 8.5, bold: true, color: GOLD, align: "right", tracking: 0.4 });
  y -= 19;
  page.text(MARGIN, y, invoice.customer.name || "Customer name not recorded", { size: 14, bold: true });
  const summary = invoice.booking?.serviceSummary ?? invoice.booking?.packageName ?? "Removal service";
  page.text(right, y, summary, { size: 10, align: "right" });
  y -= 15;
  const contact = [invoice.customer.phone, invoice.customer.email].filter(Boolean).join("  |  ");
  if (contact) page.text(MARGIN, y, contact, { size: 9, color: MUTED });
  page.text(right, y, formatInvoiceDate(invoice.serviceDate), { size: 9, color: MUTED, align: "right" });
  y -= 14;
  page.text(MARGIN, y, `Booking ${invoice.bookingReference}`, { size: 8.5, color: MUTED });

  // ---- pick-up / drop-off panel ----
  y -= 22;
  const pickup = invoice.booking?.pickup ?? "";
  const dropoff = invoice.booking?.destination ?? "";
  if (pickup || dropoff) {
    const half = width / 2 - 28;
    const pLines = wrap(pickup || "Not recorded", half, 9.5, true);
    const dLines = wrap(dropoff || "Not recorded", half, 9.5, true);
    const rows = Math.max(pLines.length, dLines.length);
    const panelH = 36 + rows * 12.5;
    page.rrect(MARGIN, y - panelH, width, panelH, 9, TINT);
    page.text(MARGIN + 16, y - 18, "PICK-UP ADDRESS", { size: 7.8, bold: true, color: GOLD, tracking: 0.3 });
    page.text(MARGIN + width / 2 + 4, y - 18, "DROP-OFF ADDRESS", { size: 7.8, bold: true, color: GOLD, tracking: 0.3 });
    pLines.forEach((t, i) => page.text(MARGIN + 16, y - 34 - i * 12.5, t, { size: 9.5, bold: true }));
    dLines.forEach((t, i) => page.text(MARGIN + width / 2 + 4, y - 34 - i * 12.5, t, { size: 9.5, bold: true }));
    y -= panelH + 40;
  }

  // ---- description bar ----
  const colQty = right - 190;
  const colUnit = right - 105;
  const colAmt = right - 14;
  const bar = (target: Page, by: number) => {
    target.rrect(MARGIN, by - 9, width, 30, 7, GREEN);
    target.text(MARGIN + 16, by + 1, "SERVICE DESCRIPTION", { size: 8.5, bold: true, color: WHITE, tracking: 0.3 });
    target.text(colQty, by + 1, "QTY", { size: 8, bold: true, color: WHITE, align: "right" });
    target.text(colUnit, by + 1, gst ? (invoice.amountsIncludeGst ? "UNIT (INC GST)" : "UNIT (EX GST)") : "UNIT PRICE", { size: 8, bold: true, color: WHITE, align: "right" });
    target.text(colAmt, by + 1, "AMOUNT (AUD)", { size: 8.5, bold: true, color: WHITE, align: "right", tracking: 0.3 });
  };
  const newPage = () => {
    page = new Page();
    pages.push(page);
    chrome(page);
    page.text(MARGIN, PAGE_H - 52, `${invoice.title.toUpperCase()} ${invoice.invoiceNumber ?? "(draft)"} - continued`, { size: 11, bold: true, color: GREEN });
    y = PAGE_H - 92;
    bar(page, y);
    y -= 26;
  };
  bar(page, y);
  y -= 26;

  const sub = `${invoice.customer.name ?? "Customer"}  |  ${shortDate(invoice.serviceDate)}`;
  for (const line of invoice.lines) {
    const descLines = wrap(line.description, colQty - MARGIN - 70, 10.5, true);
    const rowH = 28 + descLines.length * 13;
    if (y - rowH < 250) newPage();
    page.rrect(MARGIN, y - rowH + 14, width, rowH, 7, TINT);
    descLines.forEach((t, i) => page.text(MARGIN + 16, y - 6 - i * 13, t, { size: 10.5, bold: true }));
    page.text(MARGIN + 16, y - 10 - descLines.length * 13, sub, { size: 8.5, color: MUTED });
    page.text(colQty, y - 6, formatQuantity(line.quantityMilli), { size: 10, align: "right" });
    page.text(colUnit, y - 6, formatCents(line.unitPriceCents), { size: 10, align: "right" });
    page.text(colAmt, y - 6, formatCents(line.amountCents), { size: 11, bold: true, align: "right" });
    y -= rowH + 8;
  }
  if (invoice.lines.length === 0) {
    page.text(MARGIN + 16, y - 6, "No line items yet.", { size: 10, color: MUTED });
    y -= 30;
  }

  // ---- bank details (left) + totals (right) ----
  if (y < 230) newPage();
  y -= 20;
  const blockTop = y;
  page.text(MARGIN, y, "BANK TRANSFER DETAILS", { size: 8.5, bold: true, color: GOLD, tracking: 0.3 });
  let by = y - 20;
  if (seller.bankBsb || seller.bankAccountNumber) {
    page.text(MARGIN, by, seller.bankAccountName ?? (seller.tradingName ?? "HF Removals Adelaide").toUpperCase(), { size: 10, bold: true });
    by -= 16;
    page.text(MARGIN, by, `BSB  ${seller.bankBsb ?? ""}`, { size: 9, color: MUTED });
    by -= 15;
    page.text(MARGIN, by, `Account  ${seller.bankAccountNumber ?? ""}`, { size: 9, color: MUTED });
    by -= 15;
    page.text(MARGIN, by, `Reference  ${invoice.invoiceNumber ?? "(assigned on issue)"}`, { size: 9, color: MUTED });
    by -= 15;
  }
  if (seller.paymentInstructions) {
    for (const t of wrap(seller.paymentInstructions, width / 2 - 30, 8.5)) { page.text(MARGIN, by, t, { size: 8.5, color: MUTED }); by -= 12; }
  }

  const tx = MARGIN + width / 2 + 6;
  let ty = blockTop;
  const row = (label: string, value: string) => {
    page.text(tx, ty, label, { size: 9.5, color: MUTED });
    page.text(right, ty, value, { size: 9.5, color: MUTED, align: "right" });
    ty -= 24;
  };
  if (gst) {
    row("Subtotal (ex GST)", formatCents(invoice.totals.subtotalCents));
    row("GST (10%)", formatCents(invoice.totals.gstCents));
  }
  page.line(tx, ty + 14, right);
  ty -= 6;
  page.rrect(tx - 6, ty - 18, right - tx + 6, 36, 7, GREEN);
  page.text(tx + 8, ty - 3, gst ? "TOTAL (INCL. GST)" : "TOTAL", { size: 8.5, bold: true, color: WHITE, tracking: 0.3 });
  page.text(right - 12, ty - 5, formatCents(invoice.totals.totalCents), { size: 15, bold: true, color: WHITE, align: "right" });
  ty -= 40;
  for (const payment of invoice.payments) {
    const label = payment.kind === "reversal" ? "Payment reversed" : payment.kind === "deposit" ? "Deposit received" : "Payment received";
    page.text(tx, ty, `${label} ${shortDate(payment.receivedOn)}`, { size: 8.5, color: MUTED });
    page.text(right, ty, `${payment.kind === "reversal" ? "" : "-"}${formatCents(payment.amountCents)}`, { size: 8.5, color: MUTED, align: "right" });
    ty -= 13;
  }

  y = Math.min(by, ty) - 18;
  if (y < 150) newPage();

  // ---- status panel ----
  page.rrect(MARGIN, y - 52, width, 52, 8, PAID_TINT);
  page.text(MARGIN + 18, y - 22, status, { size: 11, bold: true, color: GREEN });
  page.text(MARGIN + 18, y - 38, `Balance outstanding: ${formatCents(Math.max(invoice.totals.balanceDueCents, 0))}`, { size: 8.5, color: MUTED });
  page.text(right - 18, y - 28, formatCents(invoice.totals.paidCents > 0 ? invoice.totals.paidCents : invoice.totals.totalCents), { size: 14, bold: true, color: GREEN, align: "right" });
  y -= 66;

  if (invoice.notes) {
    for (const t of wrap(invoice.notes, width, 9)) { page.text(MARGIN, y, t, { size: 9, color: MUTED }); y -= 12; }
    y -= 4;
  }
  // Footer is anchored near the bottom edge, like the approved template.
  if (y < 110) newPage();
  y = 78;
  page.line(MARGIN, y + 20, right);
  const centre = (t: string, size: number, bold: boolean, color: Rgb) => page.text(PAGE_W / 2 - textWidth(t, size, bold) / 2, y, t, { size, bold, color });
  centre("Thank you for choosing HF Removals Adelaide.", 9.5, true, INK);
  y -= 14;
  centre(gst ? "This tax invoice includes GST at 10%." : (seller.footerNote ?? ""), 8.5, false, MUTED);
  if (gst && seller.footerNote) { y -= 12; centre(seller.footerNote, 8.5, false, MUTED); }

  pages.forEach((p, index) => { if (pages.length > 1) p.text(right, 20, `Page ${index + 1} of ${pages.length}`, { size: 8, color: MUTED, align: "right" }); });
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
  const jpeg = atob(HF_LOGO_JPEG.base64); // one char per byte
  const image = add(`<< /Type /XObject /Subtype /Image /Width ${HF_LOGO_JPEG.width} /Height ${HF_LOGO_JPEG.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n${jpeg}\nendstream`);
  const kids: number[] = [];
  for (const p of pages) {
    const content = p.ops.join("\n");
    const stream = add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    kids.push(add(`<< /Type /Page /Parent ${pagesRoot} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> /XObject << /Im1 ${image} 0 R >> >> /Contents ${stream} 0 R >>`));
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
  // Content is ASCII; the logo is one char per byte, so latin1 round-trips 1:1 and offsets stay byte-accurate.
  return Uint8Array.from(out, (ch) => ch.charCodeAt(0) & 0xff);
}
