import Link from "next/link";
import { requireAdmin } from "../../../../lib/server/admin-dal.ts";
import { getInvoiceSettings, listInvoices } from "../../../../lib/server/invoice-repo.ts";
import { formatCents, missingInvoiceSettings } from "../../../../lib/invoice.ts";
import { AdminAlert, AdminCard, AdminEmptyState, AdminPageHeader, DataTable } from "../../_components/ui";
import { AdminStatusBadge } from "../../_components/AdminStatusBadge";
import { Icon } from "../../_components/Icon";
import { ExportCsvLink } from "../../_components/ExportCsvLink";
import "../../styles/invoices.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invoices", robots: { index: false, follow: false } };

const TABS = [
  { key: "", label: "All" },
  { key: "draft", label: "Drafts" },
  { key: "issued", label: "Issued" },
  { key: "void", label: "Void" },
] as const;

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdmin();
  const { status = "" } = await searchParams;
  const active = TABS.some((tab) => tab.key === status) ? status : "";
  const [invoices, settings] = await Promise.all([listInvoices(active || undefined), getInvoiceSettings()]);
  const missing = missingInvoiceSettings(settings);

  return (
    <div className="a-inv-list">
      <AdminPageHeader
        eyebrow="Billing"
        title="Invoices"
        description="Draft, issue and download invoices. Create one from any booking's detail page."
        actions={<><ExportCsvLink href={active ? `/api/admin/export/invoices?status=${active}` : "/api/admin/export/invoices"} /><Link href="/admin/invoices/settings" className="admin-btn admin-btn--secondary"><Icon name="settings" size={16} />Invoice settings</Link></>}
      />
      {missing.length > 0 && (
        <AdminAlert tone="info">
          Invoices can be drafted now, but issuing is blocked until these are set: <strong>{missing.join(", ")}</strong>.{" "}
          <Link href="/admin/invoices/settings" className="admin-link">Open invoice settings</Link>
        </AdminAlert>
      )}
      <nav className="a-inv-tabs" aria-label="Invoice status">
        {TABS.map((tab) => (
          <Link key={tab.key || "all"} href={tab.key ? `/admin/invoices?status=${tab.key}` : "/admin/invoices"} aria-current={active === tab.key ? "page" : undefined} className="a-inv-tab">{tab.label}</Link>
        ))}
      </nav>
      <AdminCard flush>
        {invoices.length === 0 ? (
          <AdminEmptyState icon="dollar" title="No invoices yet" description="Open a booking and choose Create invoice to start one." action={<Link href="/admin/bookings" className="admin-btn admin-btn--secondary">Go to bookings</Link>} />
        ) : (
          <DataTable columns={[{ label: "Invoice" }, { label: "Customer" }, { label: "Booking" }, { label: "Service date" }, { label: "Total" }, { label: "Status" }]} minWidth={760}>
            {invoices.map((invoice) => (
              <tr key={invoice.id}>
                <td data-label="Invoice"><Link href={`/admin/invoices/${invoice.id}`} className="admin-link">{invoice.invoiceNumber ?? "Draft"}</Link></td>
                <td data-label="Customer">{invoice.customerName ?? "Not recorded"}</td>
                <td data-label="Booking"><Link href={`/admin/bookings/${invoice.bookingId}`} className="admin-link">{invoice.bookingReference}</Link></td>
                <td data-label="Service date">{invoice.serviceDate}</td>
                <td data-label="Total">{invoice.totalCents == null ? "—" : formatCents(invoice.totalCents)}</td>
                <td data-label="Status"><AdminStatusBadge kind="invoice" status={invoice.status} /></td>
              </tr>
            ))}
          </DataTable>
        )}
      </AdminCard>
    </div>
  );
}
