import { formatAbn, formatCents, formatQuantity, INVOICE_LINE_KIND_LABELS } from "../../../../lib/invoice.ts";
import { formatInvoiceDate, type InvoiceSnapshot } from "../../../../lib/invoice-pdf.ts";

/**
 * HTML rendition of the invoice document (same model as the PDF), used for
 * the on-screen preview of drafts and the read-only view of issued invoices.
 */
export function InvoicePaper({ invoice }: { invoice: InvoiceSnapshot }) {
  const gst = Boolean(invoice.seller.gstRegistered);
  const stamp = invoice.voided ? "VOID" : invoice.draft ? "DRAFT" : null;
  return (
    <article className="a-inv-paper" aria-label={`${invoice.title} preview`} data-stamp={stamp ?? undefined}>
      {stamp && <span className="a-inv-stamp" aria-hidden="true">{stamp}</span>}
      <header className="a-inv-paper-head">
        <div>
          <p className="a-inv-brand"><strong>HF</strong> Removals Adelaide</p>
          <p className="a-inv-seller">
            {invoice.seller.legalName}<br />
            {invoice.seller.address}<br />
            {[invoice.seller.phone, invoice.seller.email].filter(Boolean).join(" · ")}
            {invoice.seller.abn && <><br />ABN {formatAbn(invoice.seller.abn)}</>}
          </p>
        </div>
        <div className="a-inv-title">
          <h2>{invoice.title}</h2>
          <p>{invoice.draft ? "Draft – not yet issued" : invoice.invoiceNumber}</p>
        </div>
      </header>

      <dl className="a-inv-meta">
        <div><dt>Bill to</dt><dd><strong>{invoice.customer.name || "Customer name not recorded"}</strong>{invoice.customer.email && <><br />{invoice.customer.email}</>}{invoice.customer.phone && <><br />{invoice.customer.phone}</>}</dd></div>
        <div><dt>Issue date</dt><dd>{invoice.draft ? "Not issued" : formatInvoiceDate(invoice.issueDate)}</dd></div>
        <div><dt>Due date</dt><dd>{invoice.draft ? "—" : formatInvoiceDate(invoice.dueDate)}</dd></div>
        <div><dt>Booking ref</dt><dd>{invoice.bookingReference}</dd></div>
        <div><dt>Service date</dt><dd>{formatInvoiceDate(invoice.serviceDate)}</dd></div>
      </dl>
      {(invoice.booking?.pickup || invoice.booking?.destination) && (
        <p className="a-inv-route">{[invoice.booking.pickup, invoice.booking.destination].filter(Boolean).join("  →  ")}</p>
      )}

      <div className="a-inv-table-wrap">
        <table className="a-inv-table">
          <thead>
            <tr>
              <th scope="col">Description</th>
              <th scope="col" className="num">Qty</th>
              <th scope="col" className="num">{gst ? (invoice.amountsIncludeGst ? "Unit (inc GST)" : "Unit (ex GST)") : "Unit price"}</th>
              <th scope="col" className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.length === 0 && <tr><td colSpan={4} className="a-inv-none">No line items yet.</td></tr>}
            {invoice.lines.map((line, index) => (
              <tr key={index}>
                <td>{line.description}<small>{INVOICE_LINE_KIND_LABELS[line.kind]}</small></td>
                <td className="num">{formatQuantity(line.quantityMilli)}</td>
                <td className="num">{formatCents(line.unitPriceCents)}</td>
                <td className="num"><strong>{formatCents(line.amountCents)}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="a-inv-totals">
        {gst && <div><dt>Subtotal (excl. GST)</dt><dd>{formatCents(invoice.totals.subtotalCents)}</dd></div>}
        {gst && <div><dt>GST (10%)</dt><dd>{formatCents(invoice.totals.gstCents)}</dd></div>}
        <div className="a-inv-total"><dt>{gst ? "Total (incl. GST)" : "Total"}</dt><dd>{formatCents(invoice.totals.totalCents)}</dd></div>
        {invoice.payments.map((payment, index) => (
          <div key={index}>
            <dt>{payment.kind === "reversal" ? "Payment reversed" : payment.kind === "deposit" ? "Deposit received" : "Payment received"} {formatInvoiceDate(payment.receivedOn)}{payment.method ? ` (${payment.method})` : ""}</dt>
            <dd>{payment.kind === "reversal" ? "" : "−"}{formatCents(payment.amountCents)}</dd>
          </div>
        ))}
        <div className="a-inv-balance"><dt>Balance due</dt><dd>{formatCents(invoice.totals.balanceDueCents)}</dd></div>
      </dl>

      {invoice.seller.paymentInstructions && (
        <section className="a-inv-note"><h3>Payment</h3><p>{invoice.seller.paymentInstructions}{invoice.seller.paymentTermsDays != null && !invoice.draft ? `\nPayment terms: ${invoice.seller.paymentTermsDays} days (due ${formatInvoiceDate(invoice.dueDate)}).` : ""}</p></section>
      )}
      {invoice.notes && <section className="a-inv-note"><h3>Notes</h3><p>{invoice.notes}</p></section>}
      {invoice.seller.footerNote && <p className="a-inv-footer">{invoice.seller.footerNote}</p>}
    </article>
  );
}
