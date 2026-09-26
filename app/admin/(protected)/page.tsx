import Link from "next/link";
import { getSupabaseAdmin } from "../../../lib/server/supabase.ts";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

function startOfDayAdelaide(daysFromNow: number): { start: string; end: string } {
  // Simple, honest day-boundary math for the dashboard's "today/tomorrow"
  // cards. This intentionally reuses the server's own day boundary rather
  // than importing the full booking timezone helpers, since a card that's
  // off by the DST offset for a moment is a cosmetic dashboard concern,
  // not a booking-correctness one (unlike availability/pricing, which do
  // use the exact Adelaide-timezone helpers in lib/booking/timezone.ts).
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysFromNow);
  const end = new Date(start.getTime() + 24 * 60 * 60_000);
  return { start: start.toISOString(), end: end.toISOString() };
}

export default async function AdminDashboardPage() {
  const supabase = getSupabaseAdmin();
  const today = startOfDayAdelaide(0);
  const tomorrow = startOfDayAdelaide(1);

  const [
    { count: todayCount },
    { count: tomorrowCount },
    { count: pendingCount },
    { count: confirmedCount },
    { data: unassigned },
    { data: attentionRows },
  ] = await Promise.all([
    supabase.from("bookings").select("id", { count: "exact", head: true }).gte("starts_at", today.start).lt("starts_at", today.end).not("booking_status", "in", "(cancelled,expired)"),
    supabase.from("bookings").select("id", { count: "exact", head: true }).gte("starts_at", tomorrow.start).lt("starts_at", tomorrow.end).not("booking_status", "in", "(cancelled,expired)"),
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("booking_status", "pending_payment"),
    supabase.from("bookings").select("id", { count: "exact", head: true }).in("booking_status", ["confirmed", "assigned"]),
    supabase.from("bookings").select("id").eq("booking_status", "confirmed").is("vehicle_id", null),
    supabase
      .from("bookings")
      .select("id, booking_number, booking_status, payment_status, vehicle_id, crew_id, calendar_sync_status, starts_at")
      .in("booking_status", ["confirmed", "assigned", "pending_payment"])
      .order("starts_at", { ascending: true })
      .limit(50),
  ]);

  const { data: outstandingRows } = await supabase.from("bookings").select("balance_due_cents").gt("balance_due_cents", 0).in("booking_status", ["confirmed", "assigned", "completed"]);
  const outstandingCents = (outstandingRows ?? []).reduce((sum, r) => sum + r.balance_due_cents, 0);

  const attention = (attentionRows ?? []).filter(
    (b) =>
      (b.booking_status === "confirmed" && !b.vehicle_id) ||
      (b.booking_status === "confirmed" && !b.crew_id) ||
      b.booking_status === "pending_payment" ||
      b.calendar_sync_status === "failed",
  );

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Card label="Today's jobs" value={todayCount ?? 0} />
        <Card label="Tomorrow's jobs" value={tomorrowCount ?? 0} />
        <Card label="Pending payment" value={pendingCount ?? 0} />
        <Card label="Confirmed" value={confirmedCount ?? 0} />
        <Card label="Unassigned truck" value={(unassigned ?? []).length} />
        <Card label="Outstanding balance" value={`$${(outstandingCents / 100).toFixed(0)}`} />
      </div>

      <h2 className="mt-10 text-lg font-semibold">Needs attention</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead>
            <tr className="border-b text-neutral-500">
              <th className="py-2">Booking #</th>
              <th>Date</th>
              <th>Issue</th>
            </tr>
          </thead>
          <tbody>
            {attention.map((b) => (
              <tr key={b.id} className="border-b">
                <td className="py-2">
                  <Link href={`/admin/bookings/${b.id}`} className="underline">{b.booking_number}</Link>
                </td>
                <td>{new Date(b.starts_at).toLocaleDateString("en-AU", { timeZone: "Australia/Adelaide" })}</td>
                <td>
                  {!b.vehicle_id && b.booking_status === "confirmed" && "No truck assigned"}
                  {!b.crew_id && b.booking_status === "confirmed" && b.vehicle_id && "No crew assigned"}
                  {b.booking_status === "pending_payment" && "Payment pending"}
                  {b.calendar_sync_status === "failed" && " · Calendar sync failed"}
                </td>
              </tr>
            ))}
            {attention.length === 0 && (
              <tr><td colSpan={3} className="py-8 text-center text-neutral-400">Nothing needs attention right now.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border p-4">
      <div className="text-xs uppercase text-neutral-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}
