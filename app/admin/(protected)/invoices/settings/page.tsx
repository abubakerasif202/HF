import { requireAdmin } from "../../../../../lib/server/admin-dal.ts";
import { getInvoiceSettings } from "../../../../../lib/server/invoice-repo.ts";
import { business } from "../../../../../lib/site-data.ts";
import { missingInvoiceSettings } from "../../../../../lib/invoice.ts";
import { AdminAlert, AdminCard, AdminDataList, AdminDataRow, AdminPageHeader } from "../../../_components/ui";
import { InvoiceSettingsForm } from "./InvoiceSettingsForm";
import "../../../styles/invoices.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invoice settings", robots: { index: false, follow: false } };

export default async function InvoiceSettingsPage() {
  await requireAdmin();
  const settings = await getInvoiceSettings();
  const missing = missingInvoiceSettings(settings);
  return (
    <div className="a-inv-settings">
      <AdminPageHeader
        back={{ href: "/admin/invoices", label: "Invoices" }}
        eyebrow="Billing"
        title="Invoice settings"
        description="These details print on every invoice. Nothing is filled in for you: leave a field blank until you have the confirmed value."
      />
      {missing.length > 0
        ? <AdminAlert tone="info">Issuing is blocked until these are set: <strong>{missing.join(", ")}</strong>.</AdminAlert>
        : <AdminAlert tone="success">All required invoice details are configured. New invoices can be issued.</AdminAlert>}
      <AdminCard title="Business details on the invoice" icon="note" description="Taken from HF's published business profile. Change them in the site configuration, not here.">
        <AdminDataList>
          <AdminDataRow label="Legal name" value={business.legalName} />
          <AdminDataRow label="Trading name" value={business.name} />
          <AdminDataRow label="Address" value={business.address.full} />
          <AdminDataRow label="Phone" value={business.phones[0]?.display} />
          <AdminDataRow label="Email" value={business.emails[0]} />
        </AdminDataList>
      </AdminCard>
      <InvoiceSettingsForm settings={settings} />
    </div>
  );
}
