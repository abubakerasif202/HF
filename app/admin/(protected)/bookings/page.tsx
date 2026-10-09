import Link from "next/link";
import { requireAdmin } from "../../../../lib/server/admin-dal.ts";
import { getSupabaseAdmin } from "../../../../lib/server/supabase.ts";
import { BookingRow, type BookingListItem } from "./BookingRow";
import { BookingStatusFilter, BookingsSummaryStrip } from "./BookingsOverview";
import { groupBookings, statusCounts, summariseBookings } from "./grouping";
import { AdminEmptyState, AdminPageHeader, formatAdelaide } from "../../_components/ui";
import "../../styles/bookings.css";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function AdminBookingsPage({ searchParams }: { searchParams: Promise<{ status?: string | string[] }> }) {
  await requireAdmin();
  const { status: statusParam } = await searchParams;
  const supabase = getSupabaseAdmin();
  const [{ data: bookings }, { data: vehicles }, { data: crews }] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, booking_number, starts_at, booking_status, payment_status, crew_size, package_id, vehicle_id, crew_id, subtotal_cents, deposit_paid_cents, balance_due_cents, pickup_address, destination_address, customers(name, email, phone)")
      .order("starts_at", { ascending: true })
      .limit(100),
    supabase.from("vehicles").select("id, name").eq("active", true),
    supabase.from("crews").select("id, name").eq("active", true),
  ]);

  const now = new Date();
  const rows: BookingListItem[] = (bookings ?? []).map((booking) => ({
    ...booking,
    customers: Array.isArray(booking.customers) ? (booking.customers[0] ?? null) : booking.customers,
  }));
  const statuses = statusCounts(rows);
  const requested = Array.isArray(statusParam) ? statusParam[0] : statusParam;
  const activeStatus = statuses.some((s) => s.status === requested) ? (requested as string) : "all";
  const visible = activeStatus === "all" ? rows : rows.filter((row) => row.booking_status === activeStatus);
  const groups = groupBookings(visible, now);
  const summary = summariseBookings(rows, now);
  let rowIndex = 0;

  return (
    <div className="a-bk">
      <AdminPageHeader
        eyebrow={`Schedule · ${formatAdelaide(now.toISOString(), { weekday: "long", day: "numeric", month: "long" })}`}
        title={<>Every move,<br /><em>in order.</em></>}
        description="Confirmed, pending and completed customer moves, grouped by day. Assign a truck and crew straight from the list."
        actions={
          <Link href="/admin/calendar" className="admin-btn admin-btn--secondary">
            Open calendar
          </Link>
        }
      />

      {rows.length === 0 ? (
        <div className="admin-card">
          <AdminEmptyState icon="bookings" title="No bookings yet" description="Online bookings appear here as soon as a customer reserves a time." />
        </div>
      ) : (
        <>
          <BookingsSummaryStrip summary={summary} shown={rows.length} />

          <div className="a-bk-toolbar">
            <BookingStatusFilter active={activeStatus} total={rows.length} statuses={statuses} />
            <p className="a-bk-scope" role="status">
              Showing {visible.length} of the {rows.length} {rows.length === 1 ? "booking" : "bookings"} loaded
              {rows.length >= 100 ? " (the list loads up to 100)" : ""}.
            </p>
          </div>

          {groups.length === 0 ? (
            <div className="admin-card">
              <AdminEmptyState
                icon="filter"
                title="No bookings with this status"
                description="Nothing in the loaded bookings matches that filter."
                action={<Link href="/admin/bookings" className="admin-btn admin-btn--secondary admin-btn--sm">Show all bookings</Link>}
              />
            </div>
          ) : (
            groups.map((group) => (
              <section key={group.key} className="a-bk-group" data-key={group.key} aria-labelledby={`bk-group-${group.key}`}>
                <header className="a-bk-group-head">
                  <h2 id={`bk-group-${group.key}`}>{group.label}</h2>
                  <span className="a-bk-count">{group.rows.length}</span>
                  <span className="a-bk-group-hint">{group.hint}</span>
                </header>
                <ul className="a-bk-list">
                  {group.rows.map((booking) => (
                    <BookingRow key={booking.id} booking={booking} vehicles={vehicles ?? []} crews={crews ?? []} index={rowIndex++} />
                  ))}
                </ul>
              </section>
            ))
          )}
        </>
      )}
    </div>
  );
}
