import { requireAdmin } from "../../../../lib/server/admin-dal.ts";
import { getSupabaseAdmin } from "../../../../lib/server/supabase.ts";
import { BookingRow } from "./BookingRow";
import { AdminCard, AdminEmptyState, AdminPageHeader } from "../../_components/ui";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function AdminBookingsPage() {
  await requireAdmin();
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

  const rows = bookings ?? [];

  return (
    <div className="mx-auto max-w-7xl">
      <AdminPageHeader
        title="Bookings"
        description="Manage confirmed, pending and completed customer moves. Assign a truck and crew straight from the list."
      />

      <AdminCard flush>
        {rows.length === 0 ? (
          <AdminEmptyState
            icon="bookings"
            title="No bookings yet"
            description="Online bookings appear here as soon as a customer reserves a time."
          />
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table admin-table--stack min-[900px]:min-w-[980px]">
              <thead>
                <tr>
                  <th scope="col">Booking #</th>
                  <th scope="col">Date</th>
                  <th scope="col">Customer</th>
                  <th scope="col">Pickup → Destination</th>
                  <th scope="col">Truck &amp; crew</th>
                  <th scope="col">Payment</th>
                  <th scope="col">Status</th>
                  <th scope="col"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((booking) => (
                  <BookingRow
                    key={booking.id}
                    booking={{ ...booking, customers: Array.isArray(booking.customers) ? (booking.customers[0] ?? null) : booking.customers }}
                    vehicles={vehicles ?? []}
                    crews={crews ?? []}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>
    </div>
  );
}
