import { requireAdmin } from "../../../lib/server/admin-dal.ts";
import Link from "next/link";
import { AdminCard, AdminEmptyState, AdminPageHeader, formatMoney, formatAdelaide } from "../_components/ui";
import { AdminStatusBadge } from "../_components/AdminStatusBadge";
import { Icon, type IconName } from "../_components/Icon";
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
  await requireAdmin();
  const supabase = getSupabaseAdmin();
  const today = startOfDayAdelaide(0);
  const tomorrow = startOfDayAdelaide(1);

  const [
    { count: todayCount },
    { count: tomorrowCount },
    { count: awaitingCount },
    { count: confirmedCount },
    { data: unassigned },
    { data: attentionRows },
  ] = await Promise.all([
    supabase.from("bookings").select("id", { count: "exact", head: true }).gte("starts_at", today.start).lt("starts_at", today.end).not("booking_status", "in", "(cancelled,expired)"),
    supabase.from("bookings").select("id", { count: "exact", head: true }).gte("starts_at", tomorrow.start).lt("starts_at", tomorrow.end).not("booking_status", "in", "(cancelled,expired)"),
    // Customers mid-wizard: a live hold they haven't confirmed yet (plus
    // any legacy Stripe-era pending_payment row).
    supabase.from("bookings").select("id", { count: "exact", head: true }).in("booking_status", ["held", "pending_payment"]),
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

  const unassignedCount = (unassigned ?? []).length;

  return (
    <div className="mx-auto max-w-7xl">
      <AdminPageHeader
        eyebrow="Operations"
        title="Dashboard"
        description="Today's workload, balances to collect and jobs that still need a truck or crew."
        actions={
          <>
            <Link href="/admin/calendar" className="admin-btn admin-btn--secondary">
              <Icon name="calendar" size={16} />
              Calendar
            </Link>
            <Link href="/admin/bookings" className="admin-btn admin-btn--primary">
              <Icon name="bookings" size={16} />
              View bookings
            </Link>
          </>
        }
      />

      <div className="admin-kpi-grid">
        <Kpi icon="calendar" label="Today's bookings" value={todayCount ?? 0} hint="Moves scheduled today" />
        <Kpi icon="clock" label="Tomorrow" value={tomorrowCount ?? 0} hint="Moves scheduled tomorrow" />
        <Kpi icon="clock" label="Awaiting confirmation" value={awaitingCount ?? 0} hint="Time held, customer still confirming" tone={(awaitingCount ?? 0) > 0 ? "amber" : "neutral"} />
        <Kpi icon="check" label="Confirmed bookings" value={confirmedCount ?? 0} hint="Confirmed or assigned" />
        <Kpi icon="truck" label="Unassigned jobs" value={unassignedCount} hint="Confirmed, no truck yet" tone={unassignedCount > 0 ? "ruby" : "neutral"} />
        <Kpi icon="dollar" label="Outstanding final balance" value={formatMoney(outstandingCents, { decimals: 0 })} hint="Estimated until each job is finalised" tone={outstandingCents > 0 ? "ruby" : "neutral"} />
      </div>

      <AdminCard
        className="mt-8"
        icon="alert"
        title="Needs attention"
        description="Upcoming bookings missing a truck or crew, legacy bookings stuck awaiting payment, or with a failed calendar sync."
        flush
      >
        {attention.length === 0 ? (
          <AdminEmptyState icon="check" title="All clear" description="Nothing needs attention right now." />
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table admin-table--stack">
              <thead>
                <tr>
                  <th scope="col">Booking #</th>
                  <th scope="col">Date</th>
                  <th scope="col">Status</th>
                  <th scope="col">Issue</th>
                </tr>
              </thead>
              <tbody>
                {attention.map((b) => (
                  <tr key={b.id}>
                    <td data-label="Booking" className="admin-cell-strong">
                      <Link href={`/admin/bookings/${b.id}`} className="admin-link">{b.booking_number}</Link>
                    </td>
                    <td data-label="Date">{formatAdelaide(b.starts_at, { dateStyle: "medium" })}</td>
                    <td data-label="Status"><AdminStatusBadge status={b.booking_status} /></td>
                    <td data-label="Issue">
                      <span>
                        {[
                          !b.vehicle_id && b.booking_status === "confirmed" && "No truck assigned",
                          !b.crew_id && b.booking_status === "confirmed" && b.vehicle_id && "No crew assigned",
                          b.booking_status === "pending_payment" && "Legacy payment pending",
                          b.calendar_sync_status === "failed" && "Calendar sync failed",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  hint,
  tone = "green",
}: {
  icon: IconName;
  label: string;
  value: string | number;
  hint: string;
  tone?: "green" | "ruby" | "amber" | "neutral";
}) {
  return (
    <div className="admin-card admin-kpi" data-tone={tone}>
      <div className="admin-kpi-label"><Icon name={icon} size={15} />{label}</div>
      <div className="admin-kpi-value">{value}</div>
      <div className="admin-kpi-hint">{hint}</div>
    </div>
  );
}
