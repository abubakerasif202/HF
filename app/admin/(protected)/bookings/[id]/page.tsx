import { requireAdmin } from "../../../../../lib/server/admin-dal.ts";
import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "../../../../../lib/server/supabase.ts";
import { StatusControls } from "./StatusControls";
import { RescheduleForm } from "./RescheduleForm";
import { CalendarSyncStatus } from "./CalendarSyncStatus";
import { NoteForm } from "./NoteForm";
import { FinalizeJobForm } from "./FinalizeJobForm";
import { AdminCard, AdminDataList, AdminDataRow, AdminPageHeader, formatAdelaide, formatMoney } from "../../../_components/ui";
import { AdminStatusBadge } from "../../../_components/AdminStatusBadge";
import { Icon } from "../../../_components/Icon";
import { describePackage } from "../../../../../lib/booking/pricing.ts";
import { googleCalendarEventLink } from "../../../../../lib/server/google-calendar.ts";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

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

  const customer = Array.isArray(booking.customers) ? booking.customers[0] : booking.customers;
  const service = Array.isArray(booking.services) ? booking.services[0] : booking.services;
  const vehicle = Array.isArray(booking.vehicles) ? booking.vehicles[0] : booking.vehicles;
  const crew = Array.isArray(booking.crews) ? booking.crews[0] : booking.crews;
  const pickup = booking.pickup_address as { formattedAddress?: string; addressLine?: string; suburb?: string } | null;
  const destination = booking.destination_address as { formattedAddress?: string; addressLine?: string; suburb?: string } | null;
  const snapshot = (booking.pricing_snapshot ?? {}) as { package?: string; ratePer30MinCents?: number };
  // Truck/package booked: by package id, falling back to crew size for historical bookings.
  const pkg = describePackage({ packageId: booking.package_id as string | null, crewSize: booking.crew_size });
  const packageSummary = pkg.truckCapacity ? `${pkg.packageName} — ${pkg.truckCapacity}` : pkg.packageName;
  // Money genuinely received before the job. Historical Stripe-era
  // bookings recorded a real $100; every no-advance-payment booking is 0.
  const paidBeforeJobCents: number = booking.deposit_paid_cents ?? 0;
  const hadAdvancePayment = paidBeforeJobCents > 0 || booking.deposit_required_cents > 0;

  return (
    <div className="mx-auto max-w-6xl">
      <AdminPageHeader
        back={{ href: "/admin/bookings", label: "All bookings" }}
        eyebrow="Booking"
        title={booking.booking_number}
        description={`Created ${formatAdelaide(booking.created_at)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <AdminStatusBadge status={booking.booking_status} />
            <AdminStatusBadge kind="payment" status={booking.payment_status} />
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-5">
          <AdminCard icon="user" title="Customer">
            <AdminDataList>
              <AdminDataRow label="Name" value={customer?.name} tone="strong" />
              <AdminDataRow label="Email" value={customer?.email ? <a className="admin-link" href={`mailto:${customer.email}`}>{customer.email}</a> : null} />
              <AdminDataRow label="Phone" value={customer?.phone ? <a className="admin-link" href={`tel:${customer.phone}`}>{customer.phone}</a> : null} />
            </AdminDataList>
          </AdminCard>

          <AdminCard icon="mapPin" title="Move details">
            <AdminDataList>
              <AdminDataRow label="Service" value={service?.name} />
              <AdminDataRow label="Pickup" value={pickup?.formattedAddress ?? `${pickup?.addressLine ?? ""} ${pickup?.suburb ?? ""}`.trim()} />
              <AdminDataRow label="Destination" value={destination?.formattedAddress ?? `${destination?.addressLine ?? ""} ${destination?.suburb ?? ""}`.trim()} />
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

          <AdminCard
            icon="dollar"
            title="Final job billing"
            description={
              hadAdvancePayment
                ? "3-hour minimum service plus a separate 1-hour call-out. The booking confirmation this customer actually paid is deducted once from the total."
                : "3-hour minimum service plus a separate 1-hour call-out. No advance payment was taken, so the balance is the full final total."
            }
          >
            {booking.finalised_at ? (
              <div>
                <div className="admin-billing-parts">
                  <div className="admin-billing-part">
                    <p className="admin-billing-part-title"><Icon name="clock" size={15} />Service time</p>
                    <AdminDataList>
                      <AdminDataRow label="Actual service time" value={`${booking.actual_duration_minutes} min`} />
                      <AdminDataRow label="Billable service time" value={`${booking.billable_duration_minutes} min`} />
                      <AdminDataRow label="Service charge" value={formatMoney(booking.service_charge_cents)} tone="strong" />
                    </AdminDataList>
                  </div>
                  <div className="admin-billing-part">
                    <p className="admin-billing-part-title"><Icon name="truck" size={15} />Call-out</p>
                    <AdminDataList>
                      <AdminDataRow label="Call-out (1 hour)" value={formatMoney(booking.callout_fee_cents)} tone="strong" />
                    </AdminDataList>
                    <div className="admin-help mt-1">Truck fuel + basic transport included.</div>
                  </div>
                </div>
                <div className="admin-billing-summary">
                  <AdminDataList>
                    <AdminDataRow className="admin-billing-total" label="Final total" value={formatMoney(booking.final_total_cents)} />
                    {paidBeforeJobCents > 0 ? (
                      <AdminDataRow label="Booking confirmation paid" value={`−${formatMoney(paidBeforeJobCents)}`} tone="green" />
                    ) : (
                      <AdminDataRow label="Paid before move" value={`${formatMoney(0)} — advance payment not required`} />
                    )}
                    <AdminDataRow className="admin-billing-balance" label="Balance remaining" value={formatMoney(booking.balance_due_cents)} />
                  </AdminDataList>
                </div>
                <div className="admin-help mt-3">Finalised {formatAdelaide(booking.finalised_at)}</div>
              </div>
            ) : (
              <FinalizeJobForm bookingId={booking.id} bookingStatus={booking.booking_status} />
            )}
          </AdminCard>
        </div>

        <div className="grid content-start gap-5">
          <AdminCard icon="activity" title="Status" description="Move the booking through its lifecycle.">
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

          <AdminCard icon="sync" title="Google Calendar" description="Optional mirror — this booking system stays the source of truth.">
            <CalendarSyncStatus
              bookingId={booking.id}
              status={booking.calendar_sync_status}
              error={booking.calendar_sync_error}
              canSync={["confirmed", "assigned", "in_progress", "completed", "cancelled"].includes(booking.booking_status)}
              eventLink={booking.calendar_sync_status === "synced" && booking.booking_status !== "cancelled" ? googleCalendarEventLink(booking.google_calendar_event_id) : null}
            />
          </AdminCard>

          <AdminCard icon="bell" title="Notifications">
            {(notifications ?? []).length === 0 ? (
              <p className="admin-help">No notifications logged yet.</p>
            ) : (
              <ul className="admin-list">
                {(notifications ?? []).map((n) => (
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
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <AdminCard icon="note" title="Internal notes" description="Staff only — never shown to the customer.">
          <pre className="admin-note-box">{booking.internal_notes || "No internal notes yet."}</pre>
          <NoteForm bookingId={booking.id} />
        </AdminCard>

        <AdminCard icon="activity" title="Activity">
          {(events ?? []).length === 0 ? (
            <p className="admin-help">No events recorded.</p>
          ) : (
            <ol className="admin-timeline">
              {(events ?? []).map((e) => (
                <li key={e.id}>
                  <div className="admin-timeline-title">{e.event.replace(/_/g, " ")}</div>
                  <div className="admin-timeline-meta">{formatAdelaide(e.created_at)} · {e.actor ?? "system"}</div>
                </li>
              ))}
            </ol>
          )}
        </AdminCard>
      </div>
    </div>
  );
}
