"use client";

import { useActionState } from "react";
import { formatInvoiceNumber, type InvoiceSettings } from "../../../../../lib/invoice.ts";
import { AdminAlert, AdminCard } from "../../../_components/ui";
import { saveInvoiceSettingsAction } from "../actions";

interface SaveState { error?: string; saved?: boolean }

export function InvoiceSettingsForm({ settings }: { settings: InvoiceSettings | null }) {
  const [state, formAction, pending] = useActionState(
    async (_prev: SaveState, formData: FormData): Promise<SaveState> => {
      const result = await saveInvoiceSettingsAction(formData);
      return result.error ? { error: result.error } : { saved: true };
    },
    {} as SaveState,
  );
  const tri = (value: boolean | null, yes: string, no: string) => (value === null ? "" : value ? yes : no);
  const next = settings?.nextInvoiceNumber ?? 1;
  return (
    <form action={formAction} className="a-inv-settings-form" aria-label="Invoice settings">
      {state.error && <AdminAlert tone="error">{state.error}</AdminAlert>}
      {state.saved && !pending && <AdminAlert tone="success">Invoice settings saved.</AdminAlert>}

      <AdminCard title="Tax" icon="pricing" description="Required to issue. Check the ABN against the ABN Lookup record.">
        <div className="admin-form-grid admin-form-grid--2">
          <label className="admin-field"><span className="admin-label">ABN</span>
            <input className="admin-input" name="abn" inputMode="numeric" defaultValue={settings?.abn ?? ""} placeholder="11 digits" autoComplete="off" />
            <span className="admin-help">Validated with the ABR checksum. Leave blank until confirmed.</span></label>
          <label className="admin-field"><span className="admin-label">GST registered?</span>
            <select className="admin-input" name="gst_registered" defaultValue={tri(settings?.gstRegistered ?? null, "yes", "no")}>
              <option value="">Not set</option><option value="yes">Yes – issue tax invoices with GST</option><option value="no">No – plain invoices, no GST</option>
            </select></label>
          <label className="admin-field"><span className="admin-label">Are HF&apos;s booked rates GST-inclusive?</span>
            <select className="admin-input" name="rates_include_gst" defaultValue={tri(settings?.ratesIncludeGst ?? null, "inclusive", "exclusive")}>
              <option value="">Not set – choose on each invoice</option><option value="inclusive">Rates include GST</option><option value="exclusive">Rates exclude GST (add 10%)</option>
            </select>
            <span className="admin-help">Only used to pre-select the amount mode on new drafts when GST-registered.</span></label>
        </div>
      </AdminCard>

      <AdminCard title="Numbering and terms" icon="note" description="Numbers are allocated atomically at issue and never reused, even if an invoice is voided.">
        <div className="admin-form-grid admin-form-grid--2">
          <label className="admin-field"><span className="admin-label">Invoice number prefix</span>
            <input className="admin-input" name="invoice_prefix" defaultValue={settings?.invoicePrefix ?? ""} maxLength={12} placeholder="e.g. INV-" autoComplete="off" />
            <span className="admin-help">Letters, numbers and dashes. {settings?.invoicePrefix ? `Next number: ${formatInvoiceNumber(settings.invoicePrefix, next)}.` : "Numbers are the prefix plus a five-digit counter."}</span></label>
          <label className="admin-field"><span className="admin-label">Next invoice number</span>
            <input className="admin-input" name="next_invoice_number" inputMode="numeric" defaultValue={String(next)} />
            <span className="admin-help">Can only be raised, never lowered, so a number cannot be reused.</span></label>
          <label className="admin-field"><span className="admin-label">Payment terms (days)</span>
            <input className="admin-input" name="payment_terms_days" inputMode="numeric" defaultValue={settings?.paymentTermsDays ?? ""} placeholder="e.g. 7" /></label>
        </div>
      </AdminCard>

      <AdminCard title="Bank transfer details" icon="dollar" description="Printed in the Bank Transfer Details block on every invoice. Enter only details you have confirmed.">
        <div className="admin-form-grid admin-form-grid--2">
          <label className="admin-field"><span className="admin-label">Account name</span>
            <input className="admin-input" name="bank_account_name" maxLength={80} defaultValue={settings?.bankAccountName ?? ""} autoComplete="off" /></label>
          <label className="admin-field"><span className="admin-label">BSB</span>
            <input className="admin-input" name="bank_bsb" inputMode="numeric" maxLength={7} defaultValue={settings?.bankBsb ?? ""} placeholder="6 digits" autoComplete="off" /></label>
          <label className="admin-field"><span className="admin-label">Account number</span>
            <input className="admin-input" name="bank_account_number" inputMode="numeric" maxLength={12} defaultValue={settings?.bankAccountNumber ?? ""} autoComplete="off" /></label>
        </div>
        <label className="admin-field"><span className="admin-label">Extra payment note (optional)</span>
          <textarea className="admin-input" name="payment_instructions" rows={2} maxLength={1000} defaultValue={settings?.paymentInstructions ?? ""} /></label>
        <label className="admin-field"><span className="admin-label">Footer note (optional)</span>
          <input className="admin-input" name="footer_note" maxLength={500} defaultValue={settings?.footerNote ?? ""} /></label>
        <p className="admin-help">The invoice uses the HF logo from the approved HF invoice template.</p>
      </AdminCard>

      <div className="a-inv-actions a-inv-actions--row">
        <button type="submit" className="admin-btn admin-btn--primary" disabled={pending}>{pending ? "Saving…" : "Save invoice settings"}</button>
      </div>
    </form>
  );
}
