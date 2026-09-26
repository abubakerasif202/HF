import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "../../../../lib/server/supabase.ts";
import { StatusControls } from "./StatusControls";
import { RescheduleForm } from "./RescheduleForm";
import { CalendarSyncStatus } from "./CalendarSyncStatus";
import { NoteForm } from "./NoteForm";
import { FinalizeJobForm } from "./FinalizeJobForm";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function AdminBookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
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

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">{booking.booking_number}</h1>
        <p className="text-sm text-neutral-500">Created {new Date(booking.created_at).toLocaleString("en-AU", { timeZone: "Australia/Adelaide" })}</p>
      </div>

      <Section title="Status">
        <div className="flex flex-wrap items-center gap-3">
          <Badge>{booking.booking_status}</Badge>
          <Badge>{booking.payment_status}</Badge>
        </div>
        <StatusControls bookingId={booking.id} currentStatus={booking.booking_status} />
      </Section>

      <Section title="Customer">
        <Row label="Name" value={customer?.name ?? "—"} />
        <Row label="Email" value={customer?.email ?? "—"} />
        <Row label="Phone" value={customer?.phone ?? "—"} />
      </Section>

      <Section title="Move">
        <Row label="Service" value={service?.name ?? "—"} />
        <Row label="Pickup" value={pickup?.formattedAddress ?? `${pickup?.addressLine ?? ""} ${pickup?.suburb ?? ""}`} />
        <Row label="Destination" value={destination?.formattedAddress ?? `${destination?.addressLine ?? ""} ${destination?.suburb ?? ""}`} />
        <Row label="Crew size" value={String(booking.crew_size)} />
        <Row label="Customer notes" value={booking.customer_notes ?? "—"} />
      </Section>

      <Section title="Schedule">
        <Row label="Start" value={new Date(booking.starts_at).toLocaleString("en-AU", { timeZone: "Australia/Adelaide" })} />
        <Row label="End" value={new Date(booking.ends_at).toLocaleString("en-AU", { timeZone: "Australia/Adelaide" })} />
        <Row label="Estimated duration" value={`${booking.estimated_duration_minutes} minutes`} />
        <RescheduleForm bookingId={booking.id} currentStartsAt={booking.starts_at} />
      </Section>

      <Section title="Resources">
        <Row label="Vehicle" value={vehicle?.name ?? "Unassigned"} />
        <Row label="Crew" value={crew?.name ?? "Unassigned"} />
      </Section>

      <Section title="Payment">
        <Row label="Estimated / final total" value={`$${(booking.subtotal_cents / 100).toFixed(2)}`} />
        <Row label="Booking confirmation required" value={`$${(booking.deposit_required_cents / 100).toFixed(2)}`} />
        <Row label="Booking confirmation paid" value={`$${(booking.deposit_paid_cents / 100).toFixed(2)}`} />
        <Row label="Balance due" value={`$${(booking.balance_due_cents / 100).toFixed(2)}`} />
        <Row label="Payment status" value={booking.payment_status} />
        <Row label="Stripe checkout session" value={booking.current_checkout_session_id ?? "—"} mono />
      </Section>

      <Section title="Final job billing">
        {(() => {
          const snapshot = (booking.pricing_snapshot ?? {}) as { package?: string; ratePer30MinCents?: number };
          if (booking.finalised_at) {
            return (
              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-xs uppercase tracking-wide text-neutral-400">Package</p>
                  <Row label={snapshot.package ?? "—"} value={snapshot.ratePer30MinCents ? `$${(snapshot.ratePer30MinCents / 100).toFixed(0)} / 30 min` : "—"} />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-neutral-400">Service</p>
                  <Row label="Actual duration" value={`${booking.actual_duration_minutes} minutes`} />
                  <Row label="Billable duration" value={`${booking.billable_duration_minutes} minutes`} />
                  <Row label="Service charge" value={`$${(booking.service_charge_cents / 100).toFixed(2)}`} />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-neutral-400">Call-out</p>
                  <Row label="1 hour" value={`$${(booking.callout_fee_cents / 100).toFixed(2)} — truck fuel + basic transport included`} />
                </div>
                <div className="rounded-lg bg-neutral-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-neutral-400">Final billing</p>
                  <Row label="Final job total" value={`$${(booking.final_total_cents / 100).toFixed(2)}`} />
                  <Row label="Booking confirmation paid" value={`-$${(booking.deposit_paid_cents / 100).toFixed(2)}`} />
                  <Row label="Balance due" value={`$${(booking.balance_due_cents / 100).toFixed(2)}`} />
                  <Row label="Finalised" value={new Date(booking.finalised_at).toLocaleString("en-AU", { timeZone: "Australia/Adelaide" })} />
                </div>
              </div>
            );
          }
          return <FinalizeJobForm bookingId={booking.id} bookingStatus={booking.booking_status} />;
        })()}
      </Section>

      <Section title="Calendar sync">
        <CalendarSyncStatus bookingId={booking.id} status={booking.calendar_sync_status} error={booking.calendar_sync_error} />
      </Section>

      <Section title="Notifications">
        <ul className="space-y-1 text-sm">
          {(notifications ?? []).map((n) => (
            <li key={n.id}>
              {n.template} → {n.recipient}: <span className={n.status === "sent" ? "text-green-700" : "text-red-600"}>{n.status}</span>
              {n.error && <span className="text-neutral-400"> ({n.error})</span>}
            </li>
          ))}
          {(notifications ?? []).length === 0 && <li className="text-neutral-400">No notifications logged yet.</li>}
        </ul>
      </Section>

      <Section title="Internal notes">
        <pre className="whitespace-pre-wrap rounded-lg bg-neutral-50 p-3 text-sm">{booking.internal_notes || "No internal notes yet."}</pre>
        <NoteForm bookingId={booking.id} />
      </Section>

      <Section title="Activity">
        <ol className="space-y-2 border-l pl-4 text-sm">
          {(events ?? []).map((e) => (
            <li key={e.id}>
              <div className="font-medium">{e.event.replace(/_/g, " ")}</div>
              <div className="text-xs text-neutral-400">{new Date(e.created_at).toLocaleString("en-AU", { timeZone: "Australia/Adelaide" })} · {e.actor ?? "system"}</div>
            </li>
          ))}
          {(events ?? []).length === 0 && <li className="text-neutral-400">No events recorded.</li>}
        </ol>
      </Section>

      <p className="text-xs text-neutral-400">Vehicle/crew reassignment available from the bookings list.</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border p-4">
      <h2 className="mb-3 font-medium">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4 border-b py-1 text-sm last:border-b-0">
      <span className="text-neutral-500">{label}</span>
      <span className={mono ? "font-mono text-xs" : ""}>{value || "—"}</span>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs">{children}</span>;
}
