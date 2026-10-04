import Link from "next/link";
import { isBookingSystemLive } from "../../../lib/server/config.ts";
import { getBookingByAccessToken } from "../../../lib/server/booking-repo.ts";
import type { PricingSnapshot } from "../../../lib/booking/types.ts";
import { describeBookedPackage } from "../../../lib/booked-package.ts";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

const CONFIRMED_STATUSES = new Set(["confirmed", "assigned", "in_progress", "completed"]);

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function addressLabel(address: { formattedAddress?: string; addressLine?: string; suburb?: string } | null): string {
  if (!address) return "—";
  return address.formattedAddress ?? `${address.addressLine ?? ""} ${address.suburb ?? ""}`.trim();
}

/**
 * Displays whatever state the database already holds — this page never
 * confirms a booking itself. New bookings are confirmed by
 * POST /api/booking/confirm before the customer is sent here.
 */
export default async function BookingSuccessPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;

  if (!isBookingSystemLive() || !token) {
    return <Fallback message="Booking not found." />;
  }

  const booking = await getBookingByAccessToken(token).catch(() => null);
  if (!booking) return <Fallback message="Booking not found." />;

  if (!CONFIRMED_STATUSES.has(booking.booking_status)) {
    return (
      <Fallback
        message="This booking isn't confirmed"
        detail="Your selected time is no longer being held. Please choose an available time again."
        href="/book"
        cta="Start a new booking"
      />
    );
  }

  const snapshot = (booking.pricing_snapshot ?? {}) as PricingSnapshot;
  const bookedPackage = describeBookedPackage(snapshot, { packageId: booking.package_id, crewSize: booking.crew_size });
  // Historical (Stripe-era) bookings genuinely paid a confirmation
  // amount; everything since pays nothing up-front. Read what was
  // actually recorded — never assume either way.
  const amountPaidCents: number = booking.deposit_paid_cents ?? 0;
  const customer = Array.isArray(booking.customers) ? booking.customers[0] : booking.customers;

  return (
    <main className="booking-shell mx-auto max-w-2xl px-6 py-24 text-center">
      <h1 className="text-3xl font-semibold">✓ Booking Confirmed</h1>
      <p className="mt-4 text-neutral-600">Your booking has been received and confirmed.</p>
      {amountPaidCents === 0 && <p className="mt-2 font-medium text-green-700">No advance payment required.</p>}

      <dl className="mt-8 space-y-2 text-left">
        <Row label="Booking reference" value={booking.booking_number} />
        <Row label="Move date & time" value={new Date(booking.starts_at).toLocaleString("en-AU", { timeZone: "Australia/Adelaide", dateStyle: "full", timeStyle: "short" })} />
        <Row label="Package" value={bookedPackage.packageLine ?? "—"} />
        {bookedPackage.crewLine && <Row label="Crew" value={bookedPackage.crewLine} />}
        <Row label="Package rate" value={snapshot.ratePer30MinCents ? `$${(snapshot.ratePer30MinCents / 100).toFixed(0)} / 30 min ($${((snapshot.ratePer30MinCents * 2) / 100).toFixed(0)}/hr)` : "—"} />
        <Row label="Pickup" value={addressLabel(booking.pickup_address)} />
        <Row label="Destination" value={addressLabel(booking.destination_address)} />
        {customer?.name && <Row label="Booked by" value={customer.name} />}
        {customer?.email && <Row label="Confirmation sent to" value={customer.email} />}
        <Row label="Minimum service" value={snapshot.minimumBookingMinutes ? `${snapshot.minimumBookingMinutes / 60} hours` : "—"} />
        <Row
          label="Call-out"
          value={
            snapshot.calloutMinutes && snapshot.ratePer30MinCents
              ? `${snapshot.calloutMinutes / 60} hour — $${((snapshot.ratePer30MinCents * (snapshot.calloutMinutes / 30)) / 100).toFixed(0)}`
              : "—"
          }
        />
        <Row label="Estimated minimum" value={money(booking.subtotal_cents)} />
        {amountPaidCents > 0 ? (
          <Row label="Booking confirmation paid" value={money(amountPaidCents)} />
        ) : (
          <Row label="Advance payment" value="Not required" />
        )}
      </dl>

      <p className="mt-6 text-xs text-neutral-500">
        Your final price is calculated after your move is completed. 3-hour minimum service + 1-hour call-out fee.
        The call-out covers truck fuel and basic transport charges. Additional service time is billed in 30-minute
        increments at your selected package rate.
      </p>

      <Link href="/" className="mt-10 inline-block rounded-full bg-neutral-900 px-6 py-3 text-white">Return home</Link>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b py-2">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

function Fallback({ message, detail, href = "/", cta = "Return home" }: { message: string; detail?: string; href?: string; cta?: string }) {
  return (
    <main className="booking-shell mx-auto max-w-2xl px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold">{message}</h1>
      {detail && <p className="mt-4 text-neutral-600">{detail}</p>}
      <Link href={href} className="mt-8 inline-block rounded-full bg-neutral-900 px-6 py-3 text-white">{cta}</Link>
    </main>
  );
}
