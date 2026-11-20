import Link from "next/link";
import { requireAdmin } from "../../../../lib/server/admin-dal.ts";
import { loadCustomerDirectory } from "../../../../lib/server/customer-repo.ts";
import { CUSTOMER_MAX_QUERY_LENGTH, filterCustomers, paginate } from "../../../../lib/customers.ts";
import { AdminAlert, AdminCard, AdminEmptyState, AdminPageHeader, DataTable, formatAdelaide, formatMoney } from "../../_components/ui";
import { Icon } from "../../_components/Icon";
import { ExportCsvLink } from "../../_components/ExportCsvLink";
import "../../styles/customers.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Customers", robots: { index: false, follow: false } };

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default async function CustomersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const params = await searchParams;
  const query = first(params.q).trim().slice(0, CUSTOMER_MAX_QUERY_LENGTH);
  const rawPage = Number(first(params.page) || "1");

  let directory: Awaited<ReturnType<typeof loadCustomerDirectory>> | null = null;
  try {
    directory = await loadCustomerDirectory();
  } catch (error) {
    console.error("HF customer directory failed:", (error as { code?: string })?.code);
  }

  const matches = directory ? filterCustomers(directory, query) : [];
  const { items, page, pageCount, total } = paginate(matches, rawPage);
  const link = (target: number) => `/admin/customers?${new URLSearchParams({ ...(query ? { q: query } : {}), ...(target > 1 ? { page: String(target) } : {}) }).toString()}`.replace(/\?$/, "");

  return (
    <div className="a-cust">
      <AdminPageHeader
        eyebrow="Operations"
        title="Customers"
        description="Everyone who has booked. Booking counts leave out abandoned holds; money shows issued invoices only."
actions={<ExportCsvLink href={`/api/admin/export/customers${query ? `?${new URLSearchParams({ q: query }).toString()}` : ""}`} />}
      />
      <form className="a-cust-search" role="search" action="/admin/customers" method="get">
        <label className="admin-field a-cust-search-field">
          <span className="admin-label">Search customers</span>
          <input className="admin-input" type="search" name="q" defaultValue={query} maxLength={CUSTOMER_MAX_QUERY_LENGTH} placeholder="Name, email or phone" autoComplete="off" />
        </label>
        <button type="submit" className="admin-btn admin-btn--primary"><Icon name="search" size={16} />Search</button>
        {query && <Link href="/admin/customers" className="admin-btn admin-btn--secondary">Clear</Link>}
      </form>
      {!directory ? (
        <AdminAlert tone="error">Customer records could not be loaded. Check the Supabase configuration and try again.</AdminAlert>
      ) : (
        <AdminCard flush>
          {total === 0 ? (
            <AdminEmptyState icon="user" title={query ? "No customers match that search" : "No customers yet"} description={query ? "Try a different name, email or phone number." : "Customers appear here after their first booking."} />
          ) : (
            <>
              <DataTable
                columns={[{ label: "Customer" }, { label: "Contact" }, { label: "Bookings" }, { label: "Last move" }, { label: "Invoiced" }, { label: "Outstanding" }]}
                minWidth={860}
              >
                {items.map((customer) => (
                  <tr key={customer.id}>
                    <td data-label="Customer"><Link href={`/admin/customers/${customer.id}`} className="admin-link">{customer.name || "Unnamed customer"}</Link></td>
                    <td data-label="Contact">
                      <span className="a-cust-contact">{customer.email || "No email"}</span>
                      <span className="a-cust-contact">{customer.phone || "No phone"}</span>
                    </td>
                    <td data-label="Bookings">{customer.bookingCount}</td>
                    <td data-label="Last move">{customer.lastMoveAt ? formatAdelaide(customer.lastMoveAt, { dateStyle: "medium" }) : "None"}</td>
                    <td data-label="Invoiced">{formatMoney(customer.invoicedCents)}</td>
                    <td data-label="Outstanding" className={customer.outstandingCents > 0 ? "a-cust-owing" : undefined}>{formatMoney(customer.outstandingCents)}</td>
                  </tr>
                ))}
              </DataTable>
              <nav className="a-cust-pager" aria-label="Customer pages">
                <span>{total} customer{total === 1 ? "" : "s"} · page {page} of {pageCount}</span>
                <span className="a-cust-pager-links">
                  {page > 1 && <Link className="admin-btn admin-btn--secondary" href={link(page - 1)}>Previous</Link>}
                  {page < pageCount && <Link className="admin-btn admin-btn--secondary" href={link(page + 1)}>Next</Link>}
                </span>
              </nav>
            </>
          )}
        </AdminCard>
      )}
    </div>
  );
}
