import { requireAdmin } from "../../../../../lib/server/admin-dal.ts";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "../../../../../lib/server/supabase.ts";
import { StatusControls } from "./StatusControls";
import { RescheduleForm } from "./RescheduleForm";
import { CalendarSyncStatus } from "./CalendarSyncStatus";
import { NoteForm } from "./NoteForm";
import { BookingHero } from "./BookingHero";
import { BillingCard } from "./BillingCard";
import { AdminCard, AdminDataList, AdminDataRow, ActivityTimeline, formatAdelaide, formatMoney } from "../../../_components/ui";
import { AdminStatusBadge } from "../../../_components/AdminStatusBadge";
import { Icon } from "../../../_components/Icon";
import { describePackage } from "../../../../../lib/booking/pricing.ts";
import { googleCalendarEventLink } from "../../../../../lib/server/google-calendar.ts";
import { fullAddress, type AddressJson } from "../places";
import "../../../styles/bookings.css";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

export default async function AdminBookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const [{ data: booking }, { data: events }, { data: notifications }] = await Promise.all([
    supabase.from("bookings").select("*, customers(name, email, phone), services(name), vehicles(name), crews(name)").eq("id", id).maybeSingle(),
    supabase.from("booking_events").select("*").eq("booking_id", id).order("created_at", { ascending: true }),
    supabase.from("notifications").select("*").eq("booking_id", id).order("created_at", { ascending: true }),
  ]);

  if (!booking) notFound();

  const customer = firstOf(booking.customers);
  const service = firstOf(booking.services);
  const vehicle = firstOf(booking.vehicles);
  const crew = firstOf(booking.crews);
  const pickup = booking.pickup_address as AddressJson;
  const destination = booking.destination_address as AddressJson;
  const snapshot = (booking.pricing_snapshot ?? {}) as { package?: string; ratePer30MinCents?: number };
  // Truck/package booked: by package id, falling back to crew size for historical bookings.
  const pkg = describePackage({ packageId: booking.package_id as string | null, crewSize: booking.crew_size });
  const packageSummary = pkg.truckCapacity ? `${pkg.packageName} — ${pkg.truckCapacity}` : pkg.packageName;
  // Money genuinely received before the job. Historical Stripe-era
  // bookings recorded a real $100; every no-advance-payment booking is 0.
  const paidBeforeJobCents: number = booking.deposit_paid_cents ?? 0;
  const hadAdvancePayment = paidBeforeJobCents > 0 || booking.deposit_required_cents > 0;
  const timeline = (events ?? []).map((e) => ({
    id: String(e.id),
    title: String(e.event).replace(/_/g, " "),
    meta: e.actor ?? "system",
    time: formatAdelaide(e.created_at),
  }));
  const notificationList = notifications ?? [];

  return (
    <div className="a-bk a-bk--detail">
      <AdminBackLink />
      <BookingHero
        bookingNumber={booking.booking_number}
        createdAt={booking.created_at}
        status={booking.booking_status}
        paymentStatus={booking.payment_status}
        startsAt={booking.starts_at}
        endsAt={booking.ends_at}
        durationMinutes={booking.estimated_duration_minutes}
        customer={customer}
        pickup={pickup}
        destination={destination}
        packageSummary={packageSummary}
        vehicleName={vehicle?.name ?? null}
        crewName={crew?.name ?? null}
      />

      <div className="a-bk-body">
        <div className="a-bk-col">
          <AdminCard icon="mapPin" title="Move details">
            <AdminDataList>
              <AdminDataRow label="Service" value={service?.name} />
              <AdminDataRow label="Pickup" value={fullAddress(pickup)} />
              <AdminDataRow label="Destination" value={fullAddress(destination)} />
              <AdminDataRow label="Package / truck" value={packageSummary} tone="strong" />
              <AdminDataRow label="Crew size" value={String(booking.crew_size)} />
              <AdminDataRow label="Customer notes" value={booking.customer_notes} />
            </AdminDataList>
          </AdminCard>

          <AdminCard icon="calendar" title="Schedule">
            <AdminDataList>
              <AdminDataRow label="Start" value={formatAdelaide(booking.starts_at)} tone="strong" />
              <AdminDataRow label="End" value={formatAdelaide(booking.ends_at)} />
              <AdminDataRow label="Estimated duration" value={`${booking.estimated_duration_minutes} minutes`} />
            </AdminDataList>
            <RescheduleForm bookingId={booking.id} currentStartsAt={booking.starts_at} />
          </AdminCard>

          <BillingCard booking={booking} hadAdvancePayment={hadAdvancePayment} paidBeforeJobCents={paidBeforeJobCents} />

          <div className="a-bk-pair">
            <AdminCard icon="dollar" title="Payment">
              <AdminDataList>
                <AdminDataRow label="Status" value={<AdminStatusBadge kind="payment" status={booking.payment_status} />} />
                {hadAdvancePayment ? (
                  <>
                    <AdminDataRow label="Confirmation required (legacy)" value={formatMoney(booking.deposit_required_cents)} />
                    <AdminDataRow label="Confirmation paid" value={formatMoney(paidBeforeJobCents)} tone="green" />
                  </>
                ) : (
                  <AdminDataRow label="Advance payment" value="Not required" />
                )}
                <AdminDataRow
                  label={booking.finalised_at ? "Balance due" : "Estimated balance"}
                  value={formatMoney(booking.balance_due_cents)}
                  tone={booking.balance_due_cents > 0 ? "ruby" : "strong"}
                />
                {booking.current_checkout_session_id && (
                  <AdminDataRow label="Stripe checkout session (legacy)" value={booking.current_checkout_session_id} tone="mono" />
                )}
              </AdminDataList>
            </AdminCard>

            <AdminCard icon="pricing" title="Pricing">
              <AdminDataList>
                <AdminDataRow label="Package" value={snapshot.package ?? packageSummary} />
                <AdminDataRow label="Rate" value={snapshot.ratePer30MinCents ? `${formatMoney(snapshot.ratePer30MinCents, { decimals: 0 })} / 30 min` : null} />
                <AdminDataRow label="Estimated / final total" value={formatMoney(booking.subtotal_cents)} tone="strong" />
              </AdminDataList>
              <div className="admin-help mt-2">Locked at confirmation — later rate changes never affect this booking.</div>
            </AdminCard>
          </div>

          <AdminCard icon="bell" title="Notifications">
            {notificationList.length === 0 ? (
              <p className="admin-help">No notifications logged yet.</p>
            ) : (
              <ul className="admin-list">
                {notificationList.map((n) => (
                  <li key={n.id} className="border-b py-2 last:border-b-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{n.template.replace(/_/g, " ")}</span>
                      <span className="admin-badge" data-tone={n.status === "sent" ? "success" : "danger"}>
                        <Icon name={n.status === "sent" ? "check" : "alert"} size={13} />
                        {n.status}
                      </span>
                    </div>
                    <div className="admin-help break-all">{n.recipient}</div>
                    {n.error && <div className="mt-1 text-xs font-semibold text-[var(--admin-danger)]">{n.error}</div>}
                  </li>
                ))}
              </ul>
            )}
          </AdminCard>
        </div>

        <aside className="a-bk-col a-bk-rail" aria-label="Booking actions and history">
          <AdminCard icon="activity" title="Status" description="Move the booking through its lifecycle." variant="sunken">
            <div className="flex flex-wrap items-center gap-2">
              <AdminStatusBadge status={booking.booking_status} />
            </div>
            <StatusControls bookingId={booking.id} currentStatus={booking.booking_status} />
          </AdminCard>

          <AdminCard icon="truck" title="Resources" description="Reassign from the bookings list.">
            <AdminDataList>
              <AdminDataRow label="Vehicle" value={vehicle?.name ?? "Unassigned"} tone={vehicle?.name ? "strong" : "ruby"} />
              <AdminDataRow label="Crew" value={crew?.name ?? "Unassigned"} tone={crew?.name ? "strong" : "ruby"} />
            </AdminDataList>
          </AdminCard>

          <AdminCard icon="note" title="Internal notes" description="Staff only — never shown to the customer.">
            <pre className="admin-note-box">{booking.internal_notes || "No internal notes yet."}</pre>
            <NoteForm bookingId={booking.id} />
          </AdminCard>

          <AdminCard icon="activity" title="Activity">
            {timeline.length === 0 ? <p className="admin-help">No events recorded.</p> : <ActivityTimeline items={timeline} />}
          </AdminCard>

          <AdminCard icon="sync" title="Google Calendar" description="Optional mirror — this booking system stays the source of truth.">
            <CalendarSyncStatus
              bookingId={booking.id}
              status={booking.calendar_sync_status}
              error={booking.calendar_sync_error}
              canSync={["confirmed", "assigned", "in_progress", "completed", "cancelled"].includes(booking.booking_status)}
              eventLink={booking.calendar_sync_status === "synced" && booking.booking_status !== "cancelled" ? googleCalendarEventLink(booking.google_calendar_event_id) : null}
            />
          </AdminCard>
        </aside>
      </div>
    </div>
  );
}

function AdminBackLink() {
  return (
    <Link href="/admin/bookings" className="admin-back-link">
      <Icon name="arrowLeft" size={16} />
      All bookings
    </Link>
  );
}
