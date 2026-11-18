import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "../../../../../lib/server/admin-dal.ts";
import { adelaideYmd } from "../../../../../lib/admin/dates.ts";
import { buildInvoiceDocument, getInvoice, getInvoiceSettings, listInvoiceEvents } from "../../../../../lib/server/invoice-repo.ts";
import { getSupabaseAdmin } from "../../../../../lib/server/supabase.ts";
import { balanceDueCents as computeBalance, formatCents } from "../../../../../lib/invoice.ts";
import { ActivityTimeline, AdminAlert, AdminCard, AdminDataList, AdminDataRow, formatAdelaide } from "../../../_components/ui";
import { AdminStatusBadge } from "../../../_components/AdminStatusBadge";
import { Icon } from "../../../_components/Icon";
import { InvoicePaper } from "../InvoicePaper";
import { InvoiceEditor, type EditorInvoice } from "./InvoiceEditor";
import { PaymentPanel, VoidPanel } from "./IssuedActions";
import "../../../styles/invoices.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invoice", robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const [invoice, settings] = await Promise.all([getInvoice(id), getInvoiceSettings()]);
  if (!invoice) notFound();
  const [document, events, bookingRow, replaced] = await Promise.all([
    buildInvoiceDocument(invoice, settings),
    listInvoiceEvents(id),
    getSupabaseAdmin().from("bookings").select("booking_status").eq("id", invoice.bookingId).maybeSingle(),
    invoice.replacesInvoiceId ? getSupabaseAdmin().from("invoices").select("invoice_number").eq("id", invoice.replacesInvoiceId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const todayYmd = adelaideYmd(new Date());
  const bookingStatus = (bookingRow.data as { booking_status?: string } | null)?.booking_status ?? null;
  const title = invoice.status === "draft" ? "Draft invoice" : (invoice.invoiceNumber ?? "Invoice");

  const timeline = events.map((e) => ({ id: e.id, title: e.event.replaceAll("_", " "), meta: e.actor ?? "system", time: formatAdelaide(e.createdAt) }));

  return (
    <div className="a-inv">
      <Link href="/admin/invoices" className="admin-back-link"><Icon name="arrowLeft" size={16} />All invoices</Link>
      <header className="a-inv-header">
        <div>
          <p className="admin-page-eyebrow">Invoice · {invoice.bookingReference}</p>
          <h1 className="admin-page-title">{title}</h1>
        </div>
        <div className="a-inv-header-actions">
          <AdminStatusBadge kind="invoice" status={invoice.status} />
          <Link href={`/admin/bookings/${invoice.bookingId}`} className="admin-btn admin-btn--secondary admin-btn--sm">Open booking</Link>
          {invoice.status !== "draft" && <a href={`/api/admin/invoices/${invoice.id}/pdf`} className="admin-btn admin-btn--primary admin-btn--sm" download>Download PDF</a>}
        </div>
      </header>

      {invoice.status === "draft" ? (
        <InvoiceEditor
          invoice={{
            id: invoice.id, version: invoice.version, bookingId: invoice.bookingId, bookingReference: invoice.bookingReference, bookingStatus,
            pricingSource: invoice.pricingSource, amountsIncludeGst: invoice.amountsIncludeGst,
            customer: { name: invoice.customer.name ?? null, email: invoice.customer.email ?? null, phone: invoice.customer.phone ?? null },
            serviceDate: invoice.serviceDate, notes: invoice.notes, lines: invoice.lines,
            payments: invoice.payments.filter((p): p is typeof p & { kind: "deposit" | "payment" } => p.kind !== "reversal"),
            replacesNumber: (replaced.data as { invoice_number?: string | null } | null)?.invoice_number ?? null,
          } satisfies EditorInvoice}
          settings={settings}
          previewBase={{ seller: document.seller, booking: document.booking, title: document.title }}
          todayYmd={todayYmd}
        />
      ) : (
        <div className="a-inv-grid">
          <div className="a-inv-main">
            {invoice.status === "void" && <AdminAlert tone="error">This invoice was voided {invoice.voidedAt ? formatAdelaide(invoice.voidedAt) : ""}. Reason: {invoice.voidReason}</AdminAlert>}
            <InvoicePaper invoice={document} />
          </div>
          <aside className="a-inv-side" aria-label="Invoice details">
            <AdminCard title="Summary" icon="pricing" variant="sunken">
              <AdminDataList>
                <AdminDataRow label="Invoice" value={invoice.invoiceNumber} tone="strong" />
                <AdminDataRow label="Issued" value={invoice.issueDate} />
                <AdminDataRow label="Due" value={invoice.dueDate} />
                <AdminDataRow label="Total" value={invoice.totalCents == null ? null : formatCents(invoice.totalCents)} tone="strong" />
                <AdminDataRow label="Balance due now" value={invoice.status === "issued" && invoice.totalCents != null ? formatCents(computeBalance(invoice.totalCents, invoice.payments)) : "—"} tone="ruby" />
              </AdminDataList>
              <p className="admin-help">The issued document is a frozen snapshot. Later booking or customer edits never change it.</p>
            </AdminCard>
            {invoice.status === "issued" && invoice.totalCents != null && (
              <PaymentPanel
                invoiceId={invoice.id}
                balanceDueCents={computeBalance(invoice.totalCents, invoice.payments)}
                payments={invoice.payments.map((p) => ({ id: p.id, kind: p.kind, amountCents: p.amountCents, receivedOn: p.receivedOn, method: p.method ?? null, reversed: invoice.payments.some((other) => other.kind === "reversal" && other.reversesPaymentId === p.id) }))}
                todayYmd={todayYmd}
              />
            )}
            {invoice.status === "issued" && <VoidPanel invoiceId={invoice.id} invoiceNumber={invoice.invoiceNumber ?? ""} />}
            <AdminCard title="Activity" icon="activity">
              {timeline.length ? <ActivityTimeline items={timeline} /> : <p className="admin-help">No activity recorded.</p>}
            </AdminCard>
          </aside>
        </div>
      )}
    </div>
  );
}
