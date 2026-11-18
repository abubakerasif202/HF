"use client";

import Link from "next/link";
import { useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  computeInvoiceTotals, formatCents, formatQuantity, INVOICE_LINE_KINDS, INVOICE_LINE_KIND_LABELS, invoiceReadiness, lineAmountCents,
  parseMoneyToCents, parseQuantityToMilli, formatInvoiceNumber, type InvoiceLine, type InvoiceLineKind, type InvoicePayment, type InvoiceSettings,
} from "../../../../../lib/invoice.ts";
import type { InvoiceSnapshot } from "../../../../../lib/invoice-pdf.ts";
import { AdminAlert, AdminCard } from "../../../_components/ui";
import { Icon } from "../../../_components/Icon";
import { InvoicePaper } from "../InvoicePaper";
import { discardInvoiceDraftAction, issueInvoiceAction, saveInvoiceDraftAction } from "../actions";

interface LineState { key: string; kind: InvoiceLineKind; description: string; quantity: string; price: string }
interface PaymentState { key: string; kind: "deposit" | "payment"; amount: string; receivedOn: string; method: string; reference: string; source: "manual" | "booking_deposit" }

export interface EditorInvoice {
  id: string;
  version: number;
  bookingId: string;
  bookingReference: string;
  bookingStatus: string | null;
  pricingSource: string;
  amountsIncludeGst: boolean | null;
  customer: { name: string | null; email: string | null; phone: string | null };
  serviceDate: string;
  notes: string | null;
  lines: InvoiceLine[];
  payments: Array<InvoicePayment & { kind: "deposit" | "payment" }>;
  replacesNumber: string | null;
}

const PRESETS: Array<{ kind: InvoiceLineKind; label: string; description: string }> = [
  { kind: "call_out", label: "Call-out fee", description: "Call-out fee" },
  { kind: "travel", label: "Travel", description: "Travel" },
  { kind: "packing", label: "Packing", description: "Packing materials and labour" },
  { kind: "surcharge", label: "Surcharge", description: "Surcharge" },
  { kind: "discount", label: "Discount", description: "Discount" },
  { kind: "other", label: "Other", description: "" },
];

let counter = 0;
const nextKey = () => `k${(counter += 1)}`;
const toLineState = (line: InvoiceLine): LineState => ({
  key: nextKey(), kind: line.kind, description: line.description, quantity: formatQuantity(line.quantityMilli), price: (line.unitPriceCents / 100).toFixed(2),
});
const toPaymentState = (p: EditorInvoice["payments"][number]): PaymentState => ({
  key: nextKey(), kind: p.kind, amount: (p.amountCents / 100).toFixed(2), receivedOn: p.receivedOn, method: p.method ?? "", reference: p.reference ?? "", source: p.source ?? "manual",
});

interface Props {
  invoice: EditorInvoice;
  settings: InvoiceSettings | null;
  /** Seller identity and booking facts for the preview; lines/totals are rebuilt from the form. */
  previewBase: Pick<InvoiceSnapshot, "seller" | "booking" | "title">;
  todayYmd: string;
}

export function InvoiceEditor({ invoice, settings, previewBase, todayYmd }: Props) {
  const router = useRouter();
  const uid = useId();
  const [pending, startTransition] = useTransition();
  const [version, setVersion] = useState(invoice.version);
  const [customer, setCustomer] = useState(invoice.customer);
  const [serviceDate, setServiceDate] = useState(invoice.serviceDate);
  const [notes, setNotes] = useState(invoice.notes ?? "");
  const [includeGst, setIncludeGst] = useState<boolean | null>(invoice.amountsIncludeGst);
  const [lines, setLines] = useState<LineState[]>(() => invoice.lines.map(toLineState));
  const [payments, setPayments] = useState<PaymentState[]>(() => invoice.payments.map(toPaymentState));
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [confirmIssue, setConfirmIssue] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  // One key per issue intent: a retry after a network failure reuses it and can never issue twice.
  const [issueKey] = useState(() => crypto.randomUUID());

  const parsedLines = useMemo(() => lines.map((line) => ({
    line, quantityMilli: parseQuantityToMilli(line.quantity), unitPriceCents: parseMoneyToCents(line.price),
  })), [lines]);
  const parsedPayments = useMemo(() => payments.map((payment) => ({ payment, amountCents: parseMoneyToCents(payment.amount) })), [payments]);
  const fieldErrors = parsedLines.some((p) => p.quantityMilli === null || p.unitPriceCents === null || !p.line.description.trim())
    || parsedPayments.some((p) => !p.amountCents || p.amountCents <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(p.payment.receivedOn));

  const validLines: InvoiceLine[] = parsedLines.flatMap((p) => p.quantityMilli !== null && p.unitPriceCents !== null && p.line.description.trim()
    ? [{ kind: p.line.kind, description: p.line.description.trim(), quantityMilli: p.quantityMilli, unitPriceCents: p.unitPriceCents }] : []);
  const validPayments: InvoicePayment[] = parsedPayments.flatMap((p) => p.amountCents
    ? [{ kind: p.payment.kind, amountCents: p.amountCents, receivedOn: p.payment.receivedOn, method: p.payment.method.trim() || null, reference: p.payment.reference.trim() || null, source: p.payment.source }] : []);

  const readiness = invoiceReadiness({
    amountsIncludeGst: includeGst, lines: validLines, payments: validPayments, pricingSource: invoice.pricingSource,
    customerName: customer.name, bookingStatus: invoice.bookingStatus,
  }, settings);
  const blockers = fieldErrors ? ["Fix the highlighted line or payment fields."] : readiness.blockers;

  const snapshotKey = JSON.stringify({
    customer, serviceDate, notes, includeGst,
    lines: lines.map((l) => [l.kind, l.description, l.quantity, l.price]),
    payments: payments.map((p) => [p.kind, p.amount, p.receivedOn, p.method, p.reference, p.source]),
  });
  const [savedKey, setSavedKey] = useState(snapshotKey);
  const dirty = snapshotKey !== savedKey;

  const gstRegistered = settings?.gstRegistered ?? null;
  const totals = computeInvoiceTotals({ lines: validLines, gstRegistered, amountsIncludeGst: includeGst });
  // GST-registered but the amount mode was never chosen: any total would be a guess, so none is shown.
  const modeUnset = gstRegistered === true && includeGst === null;
  const previewDoc: InvoiceSnapshot = {
    ...previewBase,
    title: gstRegistered ? "Tax invoice" : "Invoice",
    invoiceNumber: null, issueDate: null, dueDate: null, bookingReference: invoice.bookingReference, serviceDate, customer, notes: notes.trim() || null,
    amountsIncludeGst: includeGst,
    lines: validLines.map((line) => ({ ...line, amountCents: lineAmountCents(line) })),
    payments: validPayments.map((p) => ({ kind: p.kind, amountCents: p.amountCents, receivedOn: p.receivedOn, method: p.method, reference: p.reference })),
    totals: { subtotalCents: totals.subtotalCents, gstCents: totals.gstCents, totalCents: totals.totalCents, paidCents: readiness.paidCents, balanceDueCents: readiness.balanceDueCents },
    draft: true,
  };

  function updateLine(key: string, patch: Partial<LineState>) { setLines((all) => all.map((l) => (l.key === key ? { ...l, ...patch } : l))); setSaved(""); }
  function updatePayment(key: string, patch: Partial<PaymentState>) { setPayments((all) => all.map((p) => (p.key === key ? { ...p, ...patch } : p))); setSaved(""); }

  function save(after?: () => void) {
    if (fieldErrors) { setError("Fix the highlighted line or payment fields before saving."); return; }
    setError(""); setSaved("");
    startTransition(async () => {
      const result = await saveInvoiceDraftAction({
        invoiceId: invoice.id, version, customer: { name: customer.name?.trim() || null, email: customer.email?.trim() || null, phone: customer.phone?.trim() || null },
        notes: notes.trim() || null, serviceDate, amountsIncludeGst: includeGst,
        lines: validLines,
        payments: validPayments.map((p) => ({ kind: p.kind as "deposit" | "payment", amountCents: p.amountCents, receivedOn: p.receivedOn, method: p.method ?? null, reference: p.reference ?? null, source: p.source ?? "manual" })),
      });
      if (result.error !== undefined) { setError(result.error); return; }
      setVersion(result.version); setSavedKey(snapshotKey); setSaved("Draft saved.");
      after?.();
    });
  }

  function issue() {
    setError("");
    startTransition(async () => {
      const result = await issueInvoiceAction(invoice.id, issueKey);
      if (result.error !== undefined) { setError(result.error); setConfirmIssue(false); return; }
      router.refresh();
    });
  }

  function discard() {
    setError("");
    startTransition(async () => {
      const result = await discardInvoiceDraftAction(invoice.id);
      if (result?.error) { setError(result.error); setConfirmDiscard(false); }
    });
  }

  const nextNumber = settings?.invoicePrefix ? formatInvoiceNumber(settings.invoicePrefix, settings.nextInvoiceNumber) : null;
  const bad = (invalid: boolean) => (invalid ? "true" : undefined);

  return (
    <div className="a-inv-editor">
      {invoice.replacesNumber && <AdminAlert tone="info">This draft replaces voided invoice {invoice.replacesNumber}. The voided number is never reused.</AdminAlert>}
      {error && <AdminAlert tone="error">{error}</AdminAlert>}
      {saved && !dirty && <AdminAlert tone="success">{saved}</AdminAlert>}

      <div className="a-inv-grid">
        <div className="a-inv-main">
          <AdminCard title="Customer and job" icon="user" description="Prefilled from the booking. Edits here change this invoice only.">
            <div className="admin-form-grid admin-form-grid--2">
              <label className="admin-field"><span className="admin-label">Customer name</span><input className="admin-input" value={customer.name ?? ""} onChange={(e) => { setCustomer({ ...customer, name: e.target.value }); setSaved(""); }} maxLength={200} /></label>
              <label className="admin-field"><span className="admin-label">Email</span><input className="admin-input" type="email" value={customer.email ?? ""} onChange={(e) => { setCustomer({ ...customer, email: e.target.value }); setSaved(""); }} maxLength={200} /></label>
              <label className="admin-field"><span className="admin-label">Phone</span><input className="admin-input" value={customer.phone ?? ""} onChange={(e) => { setCustomer({ ...customer, phone: e.target.value }); setSaved(""); }} maxLength={60} /></label>
              <label className="admin-field"><span className="admin-label">Service date</span><input className="admin-input" type="date" value={serviceDate} onChange={(e) => { setServiceDate(e.target.value); setSaved(""); }} required /></label>
            </div>
          </AdminCard>

          <AdminCard title="Line items" icon="dollar" description="Hourly work uses hours as the quantity; a fixed quote is one line at quantity 1. Amounts are calculated in whole cents.">
            {gstRegistered ? (
              <fieldset className="a-inv-gst-mode">
                <legend className="admin-label">Entered amounts</legend>
                <label><input type="radio" name={`${uid}-gst`} checked={includeGst === true} onChange={() => { setIncludeGst(true); setSaved(""); }} /> <span><strong>Include GST</strong> — the unit prices already contain GST (GST = total ÷ 11)</span></label>
                <label><input type="radio" name={`${uid}-gst`} checked={includeGst === false} onChange={() => { setIncludeGst(false); setSaved(""); }} /> <span><strong>Exclude GST</strong> — 10% GST is added on top</span></label>
                {includeGst === null && <p className="a-inv-gst-warn" role="note">Choose one before issuing. HF&apos;s booked prices are not recorded as GST-inclusive or exclusive.</p>}
              </fieldset>
            ) : gstRegistered === false ? <p className="admin-help">HF is recorded as not GST-registered, so no GST is added and this is a plain invoice.</p>
              : <p className="admin-help">GST registration is not set in <Link href="/admin/invoices/settings" className="admin-link">invoice settings</Link>. Totals below add no GST.</p>}

            <div className="a-inv-lines" role="group" aria-label="Invoice line items">
              {lines.length === 0 && <p className="a-inv-none-flag" role="alert">No priced line items. Add at least one before issuing.</p>}
              {parsedLines.map(({ line, quantityMilli, unitPriceCents }, index) => {
                const amount = quantityMilli !== null && unitPriceCents !== null ? lineAmountCents({ kind: line.kind, quantityMilli, unitPriceCents }) : null;
                return (
                  <div className="a-inv-line" key={line.key}>
                    <label className="admin-field a-inv-line-kind"><span className="admin-label">Type</span>
                      <select className="admin-input" value={line.kind} onChange={(e) => updateLine(line.key, { kind: e.target.value as InvoiceLineKind })}>
                        {INVOICE_LINE_KINDS.map((kind) => <option key={kind} value={kind}>{INVOICE_LINE_KIND_LABELS[kind]}</option>)}
                      </select></label>
                    <label className="admin-field a-inv-line-desc"><span className="admin-label">Description</span>
                      <input className="admin-input" value={line.description} maxLength={300} aria-invalid={bad(!line.description.trim())} onChange={(e) => updateLine(line.key, { description: e.target.value })} /></label>
                    <label className="admin-field a-inv-line-qty"><span className="admin-label">Qty</span>
                      <input className="admin-input" inputMode="decimal" value={line.quantity} aria-invalid={bad(quantityMilli === null)} onChange={(e) => updateLine(line.key, { quantity: e.target.value })} /></label>
                    <label className="admin-field a-inv-line-price"><span className="admin-label">{gstRegistered ? (includeGst ? "Unit price (inc GST)" : includeGst === false ? "Unit price (ex GST)" : "Unit price") : "Unit price"} ($)</span>
                      <input className="admin-input" inputMode="decimal" value={line.price} aria-invalid={bad(unitPriceCents === null)} onChange={(e) => updateLine(line.key, { price: e.target.value })} /></label>
                    <div className="a-inv-line-amount" aria-label={`Line ${index + 1} amount`}>{amount === null ? "—" : formatCents(amount)}</div>
                    <button type="button" className="admin-btn admin-btn--secondary admin-btn--sm a-inv-remove" onClick={() => { setLines((all) => all.filter((l) => l.key !== line.key)); setSaved(""); }} aria-label={`Remove line ${index + 1}`}><Icon name="trash" size={15} /></button>
                  </div>
                );
              })}
            </div>
            <div className="a-inv-add" role="group" aria-label="Add a line item">
              {PRESETS.map((preset) => (
                <button type="button" key={preset.kind} className="admin-btn admin-btn--secondary admin-btn--sm" onClick={() => { setLines((all) => [...all, { key: nextKey(), kind: preset.kind, description: preset.description, quantity: "1", price: "" }]); setSaved(""); }}>
                  <Icon name="plus" size={14} />{preset.label}
                </button>
              ))}
            </div>
            <p className="admin-help">Discounts are entered as positive amounts and subtract from the total (and from the GST base).</p>
          </AdminCard>

          <AdminCard title="Deposits and payments" icon="dollar" description="Money already received. These are separate from the charges above and reduce the balance due.">
            {payments.length === 0 && <p className="admin-help">No deposits or payments recorded yet.</p>}
            {parsedPayments.map(({ payment, amountCents }) => (
              <div className="a-inv-payment" key={payment.key}>
                <label className="admin-field"><span className="admin-label">Type</span>
                  <select className="admin-input" value={payment.kind} onChange={(e) => updatePayment(payment.key, { kind: e.target.value as "deposit" | "payment" })}><option value="deposit">Deposit</option><option value="payment">Payment</option></select></label>
                <label className="admin-field"><span className="admin-label">Amount ($)</span>
                  <input className="admin-input" inputMode="decimal" value={payment.amount} aria-invalid={bad(!amountCents)} onChange={(e) => updatePayment(payment.key, { amount: e.target.value })} /></label>
                <label className="admin-field"><span className="admin-label">Received on</span>
                  <input className="admin-input" type="date" value={payment.receivedOn} max={todayYmd} onChange={(e) => updatePayment(payment.key, { receivedOn: e.target.value })} /></label>
                <label className="admin-field"><span className="admin-label">Method</span>
                  <input className="admin-input" value={payment.method} maxLength={60} onChange={(e) => updatePayment(payment.key, { method: e.target.value })} /></label>
                <label className="admin-field"><span className="admin-label">Reference</span>
                  <input className="admin-input" value={payment.reference} maxLength={120} onChange={(e) => updatePayment(payment.key, { reference: e.target.value })} /></label>
                <button type="button" className="admin-btn admin-btn--secondary admin-btn--sm a-inv-remove" onClick={() => { setPayments((all) => all.filter((p) => p.key !== payment.key)); setSaved(""); }} aria-label="Remove payment"><Icon name="trash" size={15} /></button>
              </div>
            ))}
            <button type="button" className="admin-btn admin-btn--secondary admin-btn--sm" onClick={() => { setPayments((all) => [...all, { key: nextKey(), kind: "deposit", amount: "", receivedOn: todayYmd, method: "", reference: "", source: "manual" }]); setSaved(""); }}><Icon name="plus" size={14} />Add deposit or payment</button>
          </AdminCard>

          <AdminCard title="Notes" icon="note" description="Shown on the invoice.">
            <label className="admin-field"><span className="admin-label sr-only">Invoice notes</span><textarea className="admin-input" rows={3} maxLength={2000} value={notes} onChange={(e) => { setNotes(e.target.value); setSaved(""); }} /></label>
          </AdminCard>
        </div>

        <aside className="a-inv-side" aria-label="Totals and actions">
          <AdminCard title="Totals" icon="pricing" variant="sunken">
            {modeUnset && <p className="admin-help">Choose &quot;Include GST&quot; or &quot;Exclude GST&quot; to see the totals. They are not guessed.</p>}
            <dl className="a-inv-sum">
              {gstRegistered && <div><dt>Subtotal (excl. GST)</dt><dd>{modeUnset ? "—" : formatCents(totals.subtotalCents)}</dd></div>}
              {gstRegistered && <div><dt>GST (10%)</dt><dd>{modeUnset ? "—" : formatCents(totals.gstCents)}</dd></div>}
              <div className="is-total"><dt>{gstRegistered ? "Total (incl. GST)" : "Total"}</dt><dd>{modeUnset ? "—" : formatCents(totals.totalCents)}</dd></div>
              <div><dt>Paid so far</dt><dd>{readiness.paidCents ? `−${formatCents(readiness.paidCents)}` : formatCents(0)}</dd></div>
              <div className="is-balance"><dt>Balance due</dt><dd>{modeUnset ? "—" : formatCents(readiness.balanceDueCents)}</dd></div>
            </dl>
          </AdminCard>

          <AdminCard title="Before you issue" icon="check">
            {blockers.length === 0 && readiness.warnings.length === 0 && <p className="a-inv-ready">Everything needed is in place.</p>}
            {blockers.length > 0 && <ul className="a-inv-blockers" aria-label="Blocking problems">{blockers.map((b) => <li key={b}><Icon name="alert" size={14} />{b}</li>)}</ul>}
            {readiness.warnings.length > 0 && <ul className="a-inv-warnings" aria-label="Review">{readiness.warnings.map((w) => <li key={w}><Icon name="clock" size={14} />{w}</li>)}</ul>}
            {settings && !blockers.some((b) => b.startsWith("Configure")) ? null : <Link href="/admin/invoices/settings" className="admin-btn admin-btn--secondary admin-btn--sm">Open invoice settings</Link>}
          </AdminCard>

          <div className="a-inv-actions">
            <button type="button" className="admin-btn admin-btn--secondary" disabled={pending || !dirty} onClick={() => save()}>{pending ? "Saving…" : dirty ? "Save draft" : "Draft saved"}</button>
            <button type="button" className="admin-btn admin-btn--secondary" aria-pressed={showPreview} onClick={() => setShowPreview((v) => !v)}>{showPreview ? "Hide preview" : "Preview"}</button>
            <a className="admin-btn admin-btn--secondary" href={`/api/admin/invoices/${invoice.id}/pdf`} target="_blank" rel="noopener" aria-disabled={dirty || undefined} onClick={(e) => { if (dirty) { e.preventDefault(); setError("Save the draft first. The PDF preview uses the last saved version."); } }}>Preview PDF</a>
            {!confirmIssue ? (
              <button type="button" className="admin-btn admin-btn--primary" disabled={pending || blockers.length > 0 || dirty} onClick={() => setConfirmIssue(true)} title={dirty ? "Save the draft first" : blockers[0]}>Issue invoice</button>
            ) : (
              <div className="a-inv-confirm" role="group" aria-label="Confirm issuing">
                <p>Issue this invoice{nextNumber ? ` as ${nextNumber}` : ""}? It will be locked. Corrections afterwards need a void and reissue.</p>
                <button type="button" className="admin-btn admin-btn--primary" disabled={pending} onClick={issue}>{pending ? "Issuing…" : "Confirm and issue"}</button>
                <button type="button" className="admin-btn admin-btn--secondary" disabled={pending} onClick={() => setConfirmIssue(false)}>Cancel</button>
              </div>
            )}
            {dirty && <p className="admin-help">Save the draft to enable issuing.</p>}
            {!confirmDiscard ? (
              <button type="button" className="admin-btn admin-btn--secondary a-inv-discard" disabled={pending} onClick={() => setConfirmDiscard(true)}>Discard draft</button>
            ) : (
              <div className="a-inv-confirm" role="group" aria-label="Confirm discarding">
                <p>Discard this draft? The booking and its price are not changed.</p>
                <button type="button" className="admin-btn admin-btn--secondary" disabled={pending} onClick={discard}>Yes, discard</button>
                <button type="button" className="admin-btn admin-btn--secondary" onClick={() => setConfirmDiscard(false)}>Keep draft</button>
              </div>
            )}
          </div>
        </aside>
      </div>

      {showPreview && <AdminCard title="Preview" icon="note" description="This is how the invoice will read. The PDF uses the same content."><InvoicePaper invoice={previewDoc} /></AdminCard>}
    </div>
  );
}
