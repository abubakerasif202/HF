import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "../../../../../lib/server/admin-dal.ts";
import { loadCustomerDetail } from "../../../../../lib/server/customer-repo.ts";
import { AdminAlert, AdminCard, AdminDataList, AdminDataRow, AdminEmptyState, AdminPageHeader, DataTable, formatAdelaide, formatMoney } from "../../../_components/ui";
import { AdminStatusBadge } from "../../../_components/AdminStatusBadge";
import { CustomerEditForm } from "./CustomerEditForm";
import "../../../styles/customers.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Customer", robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function quoteField(payload: Record<string, unknown> | null, key: string): string {
  const value = payload?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  let detail: Awaited<ReturnType<typeof loadCustomerDetail>> = null;
  let failed = false;
  try {
    detail = await loadCustomerDetail(id);
  } catch (error) {
    failed = true;
    console.error("HF customer detail failed:", (error as { code?: string })?.code);
  }
  if (!failed && !detail) notFound();

  return (
    <div className="a-cust">
      <AdminPageHeader back={{ href: "/admin/customers", label: "All customers" }} eyebrow="Customer" title={detail?.customer.name || "Customer"} />
      {!detail ? (
        <AdminAlert tone="error">Customer details could not be loaded. Try again shortly.</AdminAlert>
      ) : (
        <>
          <div className="a-cust-grid">
            <AdminCard title="Contact details" icon="user">
              <CustomerEditForm customer={{ id: detail.customer.id, name: detail.customer.name, email: detail.customer.email, phone: detail.customer.phone }} />
            </AdminCard>
            <AdminCard title="Summary" icon="dollar">
              <AdminDataList>
                <AdminDataRow label="Bookings" value={String(detail.bookingCount)} />
                <AdminDataRow label="Total invoiced" value={formatMoney(detail.invoicedCents)} tone="strong" />
                <AdminDataRow label="Outstanding" value={formatMoney(detail.outstandingCents)} tone={detail.outstandingCents > 0 ? "ruby" : undefined} />
                <AdminDataRow label="Customer since" value={formatAdelaide(detail.customer.createdAt, { dateStyle: "medium" })} />
              </AdminDataList>
            </AdminCard>
          </div>

          <AdminCard title="Bookings" icon="bookings" flush>
            {detail.bookings.length === 0 ? (
              <AdminEmptyState icon="bookings" title="No bookings" description="This customer has no bookings on record." />
            ) : (
              <DataTable columns={[{ label: "Booking" }, { label: "Move date" }, { label: "Status" }]} minWidth={520}>
                {detail.bookings.map((booking) => (
                  <tr key={booking.id}>
                    <td data-label="Booking"><Link href={`/admin/bookings/${booking.id}`} className="admin-link">{booking.bookingNumber}</Link></td>
                    <td data-label="Move date">{formatAdelaide(booking.startsAt, { dateStyle: "medium", timeStyle: "short" })}</td>
                    <td data-label="Status"><AdminStatusBadge kind="booking" status={booking.status} /></td>
                  </tr>
                ))}
              </DataTable>
            )}
          </AdminCard>

          <AdminCard title="Invoices" icon="dollar" flush>
            {detail.invoices.length === 0 ? (
              <AdminEmptyState icon="dollar" title="No invoices" description="Invoices created from this customer's bookings appear here." />
            ) : (
              <DataTable columns={[{ label: "Invoice" }, { label: "Booking" }, { label: "Total" }, { label: "Paid" }, { label: "Balance" }, { label: "Status" }]} minWidth={720}>
                {detail.invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td data-label="Invoice"><Link href={`/admin/invoices/${invoice.id}`} className="admin-link">{invoice.invoiceNumber ?? "Draft"}</Link></td>
                    <td data-label="Booking">{invoice.bookingReference || "—"}</td>
                    <td data-label="Total">{invoice.totalCents == null ? "—" : formatMoney(invoice.totalCents)}</td>
                    <td data-label="Paid">{invoice.status === "issued" ? formatMoney(invoice.paidCents) : "—"}</td>
                    <td data-label="Balance">{invoice.status === "issued" ? formatMoney(invoice.balanceCents) : "—"}</td>
                    <td data-label="Status"><AdminStatusBadge kind="invoice" status={invoice.status} /></td>
                  </tr>
                ))}
              </DataTable>
            )}
          </AdminCard>

          <AdminCard title="Quote enquiries" description="Matched by the same email address or phone number." icon="inbox" flush>
            {detail.quotes.length === 0 ? (
              <AdminEmptyState icon="inbox" title="No matching enquiries" description="No website quote enquiry used this customer's email or phone." />
            ) : (
              <DataTable columns={[{ label: "Received" }, { label: "Route" }, { label: "Status" }]} minWidth={560}>
                {detail.quotes.map((quote) => (
                  <tr key={quote.id}>
                    <td data-label="Received"><Link href="/admin/quotes" className="admin-link">{formatAdelaide(quote.createdAt, { dateStyle: "medium" })}</Link></td>
                    <td data-label="Route">{[quoteField(quote.payload, "moving_from"), quoteField(quote.payload, "moving_to")].filter(Boolean).join(" to ") || "Not given"}</td>
                    <td data-label="Status"><AdminStatusBadge kind="quote" status={quote.quoteStatus} /></td>
                  </tr>
                ))}
              </DataTable>
            )}
          </AdminCard>
        </>
      )}
    </div>
  );
}
