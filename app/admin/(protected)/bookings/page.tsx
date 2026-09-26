import { getSupabaseAdmin } from "../../../../lib/server/supabase.ts";
import { BookingRow } from "./BookingRow";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function AdminBookingsPage() {
  const supabase = getSupabaseAdmin();
  const [{ data: bookings }, { data: vehicles }, { data: crews }] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, booking_number, starts_at, booking_status, payment_status, crew_size, vehicle_id, crew_id, subtotal_cents, deposit_paid_cents, balance_due_cents, pickup_address, destination_address, customers(name, email, phone)")
      .order("starts_at", { ascending: true })
      .limit(100),
    supabase.from("vehicles").select("id, name").eq("active", true),
    supabase.from("crews").select("id, name").eq("active", true),
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-semibold">Bookings</h1>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b text-neutral-500">
              <th className="py-2">Booking #</th>
              <th>Date</th>
              <th>Customer</th>
              <th>Pickup → Destination</th>
              <th>Truck</th>
              <th>Crew</th>
              <th>Payment</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(bookings ?? []).map((booking) => (
              <BookingRow
                key={booking.id}
                booking={{ ...booking, customers: Array.isArray(booking.customers) ? (booking.customers[0] ?? null) : booking.customers }}
                vehicles={vehicles ?? []}
                crews={crews ?? []}
              />
            ))}
            {(bookings ?? []).length === 0 && (
              <tr>
                <td colSpan={9} className="py-8 text-center text-neutral-400">No bookings yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
