import { formatAbn, formatCents, formatQuantity } from "../../../../lib/invoice.ts";
import { formatInvoiceDate, invoiceStatusLabel, type InvoiceSnapshot } from "../../../../lib/invoice-pdf.ts";
import { HF_LOGO_JPEG } from "../../../../lib/invoice-logo.ts";

/**
 * HTML rendition of the invoice (same model and layout as the PDF, following the approved HF template),
 * used for the draft preview and the read-only view of issued invoices.
 */
export function InvoicePaper({ invoice }: { invoice: InvoiceSnapshot }) {
  const gst = Boolean(invoice.seller.gstRegistered);
  const status = invoiceStatusLabel(invoice);
  const stamp = invoice.voided ? "VOID" : invoice.draft ? "DRAFT" : null;
  const s = invoice.seller;
  return (
    <article className="a-inv-paper" aria-label={`${invoice.title} preview`}>
      {stamp && <span className="a-inv-stamp" aria-hidden="true">{stamp}</span>}
      <header className="a-inv-paper-head">
        <div>
          <img className="a-inv-logo" src={`data:image/jpeg;base64,${HF_LOGO_JPEG.base64}`} alt="HF Removals Adelaide" width={140} height={93} />
          <p className="a-inv-brand">{(s.tradingName ?? "HF Removals Adelaide").toUpperCase()}</p>
          <p className="a-inv-seller">
            {[s.legalName, s.abn ? `ABN ${formatAbn(s.abn)}` : ""].filter(Boolean).join("  |  ")}<br />
            {s.address}<br />
            {[s.phone, s.email].filter(Boolean).join("  |  ")}
          </p>
        </div>
        <div className="a-inv-title">
          <h2>{invoice.title}</h2>
          <p>{invoice.draft ? "Draft – not yet issued" : invoice.invoiceNumber}</p>
          {!invoice.draft && <p className="a-inv-issued">ISSUED {formatInvoiceDate(invoice.issueDate).toUpperCase()}</p>}
          <p className="a-inv-status">STATUS {status}</p>
        </div>
      </header>

      <div className="a-inv-meta a-inv-meta--two">
        <div><h3>Bill to</h3><p><strong>{invoice.customer.name || "Customer name not recorded"}</strong></p><p className="a-inv-muted">{[invoice.customer.phone, invoice.customer.email].filter(Boolean).join("  |  ")}</p><p className="a-inv-muted">Booking {invoice.bookingReference}</p></div>
        <div className="a-inv-right"><h3>Service summary</h3><p>{invoice.booking?.serviceSummary ?? invoice.booking?.packageName ?? "Removal service"}</p><p className="a-inv-muted">{formatInvoiceDate(invoice.serviceDate)}</p></div>
      </div>

      {(invoice.booking?.pickup || invoice.booking?.destination) && (
        <div className="a-inv-route">
          <div><h3>Pick-up address</h3><p>{invoice.booking?.pickup || "Not recorded"}</p></div>
          <div><h3>Drop-off address</h3><p>{invoice.booking?.destination || "Not recorded"}</p></div>
        </div>
      )}

      <div className="a-inv-table-wrap">
        <table className="a-inv-table">
          <thead>
            <tr>
              <th scope="col">Service description</th>
              <th scope="col" className="num">Qty</th>
              <th scope="col" className="num">{gst ? (invoice.amountsIncludeGst ? "Unit (inc GST)" : "Unit (ex GST)") : "Unit price"}</th>
              <th scope="col" className="num">Amount (AUD)</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.length === 0 && <tr><td colSpan={4} className="a-inv-none">No line items yet.</td></tr>}
            {invoice.lines.map((line, index) => (
              <tr key={index}>
                <td><strong>{line.description}</strong><small>{invoice.customer.name ?? "Customer"} | {formatInvoiceDate(invoice.serviceDate)}</small></td>
                <td className="num">{formatQuantity(line.quantityMilli)}</td>
                <td className="num">{formatCents(line.unitPriceCents)}</td>
                <td className="num"><strong>{formatCents(line.amountCents)}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="a-inv-foot">
        <section className="a-inv-note">
          <h3>Bank transfer details</h3>
          {(s.bankBsb || s.bankAccountNumber) ? (
            <p><strong>{s.bankAccountName ?? (s.tradingName ?? "").toUpperCase()}</strong><br />BSB {s.bankBsb}<br />Account {s.bankAccountNumber}<br />Reference {invoice.invoiceNumber ?? "(assigned on issue)"}</p>
          ) : <p className="a-inv-muted">Not configured in invoice settings.</p>}
          {s.paymentInstructions && <p className="a-inv-muted">{s.paymentInstructions}</p>}
        </section>
        <dl className="a-inv-totals">
          {gst && <div><dt>Subtotal (ex GST)</dt><dd>{formatCents(invoice.totals.subtotalCents)}</dd></div>}
          {gst && <div><dt>GST (10%)</dt><dd>{formatCents(invoice.totals.gstCents)}</dd></div>}
          <div className="a-inv-total"><dt>{gst ? "TOTAL (INCL. GST)" : "TOTAL"}</dt><dd>{formatCents(invoice.totals.totalCents)}</dd></div>
          {invoice.payments.map((payment, index) => (
            <div key={index} className="a-inv-pay">
              <dt>{payment.kind === "reversal" ? "Payment reversed" : payment.kind === "deposit" ? "Deposit received" : "Payment received"} {formatInvoiceDate(payment.receivedOn)}</dt>
              <dd>{payment.kind === "reversal" ? "" : "−"}{formatCents(payment.amountCents)}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="a-inv-balance"><div><strong>{status}</strong><small>Balance outstanding: {formatCents(Math.max(invoice.totals.balanceDueCents, 0))}</small></div><span>{formatCents(invoice.totals.paidCents > 0 ? invoice.totals.paidCents : invoice.totals.totalCents)}</span></div>
      {invoice.notes && <p className="a-inv-muted a-inv-notes">{invoice.notes}</p>}
      <p className="a-inv-thanks"><strong>Thank you for choosing HF Removals Adelaide.</strong><br />{gst ? "This tax invoice includes GST at 10%." : ""}{s.footerNote ? ` ${s.footerNote}` : ""}</p>
    </article>
  );
}
