"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatCents, parseMoneyToCents } from "../../../../../lib/invoice.ts";
import { AdminAlert, AdminCard } from "../../../_components/ui";
import { recordPaymentAction, reversePaymentAction, voidInvoiceAction } from "../actions";

interface PaymentRow { id: string; kind: "deposit" | "payment" | "reversal"; amountCents: number; receivedOn: string; method: string | null; reversed: boolean }

/** Record money received against an issued invoice, or reverse a mistaken entry. Append-only and retry-safe. */
export function PaymentPanel({ invoiceId, balanceDueCents, payments, todayYmd }: { invoiceId: string; balanceDueCents: number; payments: PaymentRow[]; todayYmd: string }) {
  const router = useRouter();
  const id = useId();
  const [pending, startTransition] = useTransition();
  const [amount, setAmount] = useState("");
  const [receivedOn, setReceivedOn] = useState(todayYmd);
  const [method, setMethod] = useState("");
  const [reference, setReference] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  // A fresh key per entry; a retry of the same entry (e.g. after a timeout) reuses it.
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [reversing, setReversing] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [reverseKey, setReverseKey] = useState(() => crypto.randomUUID());

  function record() {
    const cents = parseMoneyToCents(amount);
    if (!cents) { setError("Enter the amount received, for example 250.00."); return; }
    setError(""); setNotice("");
    startTransition(async () => {
      const result = await recordPaymentAction({ invoiceId, amountCents: cents, receivedOn, method: method.trim() || null, reference: reference.trim() || null, idempotencyKey: key });
      if (result.error !== undefined) { setError(result.error); return; }
      setNotice(result.replayed ? "That payment was already recorded." : `Payment recorded. Balance due ${formatCents(result.balanceDueCents)}.`);
      setAmount(""); setMethod(""); setReference(""); setKey(crypto.randomUUID());
      router.refresh();
    });
  }

  function reverse(payment: PaymentRow) {
    setError(""); setNotice("");
    startTransition(async () => {
      const result = await reversePaymentAction({ invoiceId, paymentId: payment.id, amountCents: payment.amountCents, receivedOn: todayYmd, reason: reason.trim(), idempotencyKey: reverseKey });
      if (result.error !== undefined) { setError(result.error); return; }
      setNotice("Payment reversed."); setReversing(null); setReason(""); setReverseKey(crypto.randomUUID());
      router.refresh();
    });
  }

  return (
    <AdminCard title="Payments received" icon="dollar" description="Recorded separately from the issued invoice, which never changes.">
      {error && <AdminAlert tone="error">{error}</AdminAlert>}
      {notice && <AdminAlert tone="success">{notice}</AdminAlert>}
      {payments.length > 0 && (
        <ul className="a-inv-paylist">
          {payments.map((payment) => (
            <li key={payment.id}>
              <span>{payment.kind === "reversal" ? "Reversal" : payment.kind === "deposit" ? "Deposit" : "Payment"} · {payment.receivedOn}{payment.method ? ` · ${payment.method}` : ""}</span>
              <strong>{payment.kind === "reversal" ? "+" : "−"}{formatCents(payment.amountCents)}</strong>
              {payment.kind !== "reversal" && !payment.reversed && (reversing === payment.id ? (
                <span className="a-inv-reverse">
                  <label className="admin-field"><span className="admin-label">Reason for reversal</span><input className="admin-input" value={reason} maxLength={120} onChange={(e) => setReason(e.target.value)} /></label>
                  <button type="button" className="admin-btn admin-btn--secondary admin-btn--sm" disabled={pending || reason.trim().length < 3} onClick={() => reverse(payment)}>Reverse payment</button>
                  <button type="button" className="admin-btn admin-btn--secondary admin-btn--sm" onClick={() => setReversing(null)}>Cancel</button>
                </span>
              ) : <button type="button" className="admin-btn admin-btn--secondary admin-btn--sm" onClick={() => setReversing(payment.id)}>Reverse</button>)}
            </li>
          ))}
        </ul>
      )}
      {balanceDueCents > 0 ? (
        <form className="a-inv-payform" onSubmit={(e) => { e.preventDefault(); record(); }} aria-label="Record a payment">
          <label className="admin-field" htmlFor={`${id}-amt`}><span className="admin-label">Amount ($)</span><input id={`${id}-amt`} className="admin-input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={(balanceDueCents / 100).toFixed(2)} /></label>
          <label className="admin-field" htmlFor={`${id}-on`}><span className="admin-label">Received on</span><input id={`${id}-on`} className="admin-input" type="date" max={todayYmd} value={receivedOn} onChange={(e) => setReceivedOn(e.target.value)} required /></label>
          <label className="admin-field" htmlFor={`${id}-m`}><span className="admin-label">Method</span><input id={`${id}-m`} className="admin-input" value={method} maxLength={60} onChange={(e) => setMethod(e.target.value)} placeholder="Bank transfer, cash…" /></label>
          <label className="admin-field" htmlFor={`${id}-r`}><span className="admin-label">Reference</span><input id={`${id}-r`} className="admin-input" value={reference} maxLength={120} onChange={(e) => setReference(e.target.value)} /></label>
          <button type="submit" className="admin-btn admin-btn--primary" disabled={pending}>{pending ? "Recording…" : "Record payment"}</button>
        </form>
      ) : <p className="admin-help">The balance is paid in full.</p>}
    </AdminCard>
  );
}

/** Auditable void with optional reissue. There was no earlier correction workflow, so this is the one. */
export function VoidPanel({ invoiceId, invoiceNumber }: { invoiceId: string; invoiceNumber: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const id = useId();

  function submit(reissue: boolean) {
    setError("");
    startTransition(async () => {
      const result = await voidInvoiceAction(invoiceId, reason.trim(), reissue);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <AdminCard title="Correct this invoice" icon="alert" description="Issued invoices cannot be edited. Void it with a reason and, if needed, start a corrected draft.">
      {!open ? <button type="button" className="admin-btn admin-btn--secondary" onClick={() => setOpen(true)}>Void or correct…</button> : (
        <div className="a-inv-void" role="group" aria-label={`Void ${invoiceNumber}`}>
          {error && <AdminAlert tone="error">{error}</AdminAlert>}
          <label className="admin-field" htmlFor={`${id}-why`}><span className="admin-label">Reason (required, kept in the audit trail)</span>
            <textarea id={`${id}-why`} className="admin-input" rows={2} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
          <p className="admin-help">{invoiceNumber} stays on record as VOID and its number is never reused. A reissued draft gets a new number when issued.</p>
          <div className="a-inv-actions a-inv-actions--row">
            <button type="button" className="admin-btn admin-btn--primary" disabled={pending || reason.trim().length < 3} onClick={() => submit(true)}>{pending ? "Working…" : "Void and start corrected draft"}</button>
            <button type="button" className="admin-btn admin-btn--secondary" disabled={pending || reason.trim().length < 3} onClick={() => submit(false)}>Void only</button>
            <button type="button" className="admin-btn admin-btn--secondary" disabled={pending} onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </div>
      )}
    </AdminCard>
  );
}
