import Link from "next/link";
import { isBookingSystemLive } from "../../../lib/server/config.ts";
import { getBookingByAccessToken } from "../../../lib/server/booking-repo.ts";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

interface PricingSnapshot {
  package?: string;
  ratePer30MinCents?: number;
  minimumBookingMinutes?: number;
  calloutMinutes?: number;
  bookingConfirmationCents?: number;
}

/**
 * This page NEVER confirms a booking itself — it only displays whatever
 * state the Stripe webhook has already written to the database. Because
 * webhook delivery can lag the browser redirect by a few seconds, a
 * `pending_payment` status here is normal and just means "processing."
 */
export default async function BookingSuccessPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;

  if (!isBookingSystemLive() || !token) {
    return <Fallback message="Booking not found." />;
  }

  const booking = await getBookingByAccessToken(token).catch(() => null);
  if (!booking) return <Fallback message="Booking not found." />;

  const isConfirmed = booking.booking_status === "confirmed" || booking.booking_status === "assigned" || booking.booking_status === "completed";
  const snapshot = (booking.pricing_snapshot ?? {}) as PricingSnapshot;
  const pickup = booking.pickup_address as { formattedAddress?: string; addressLine?: string; suburb?: string } | null;
  const destination = booking.destination_address as { formattedAddress?: string; addressLine?: string; suburb?: string } | null;

  return (
    <main className="booking-shell mx-auto max-w-2xl px-6 py-24 text-center">
      <h1 className="text-3xl font-semibold">{isConfirmed ? "✓ Booking Confirmed" : "Payment received — confirming…"}</h1>
      <p className="mt-4 text-neutral-600">
        {isConfirmed
          ? "Your move has been successfully reserved."
          : "We're finalising your booking. Refresh this page in a moment if it doesn't update automatically."}
      </p>
      {isConfirmed && (
        <p className="mt-2 font-medium text-green-700">
          $100 booking confirmation received. This has been credited toward your final job balance.
        </p>
      )}

      <dl className="mt-8 space-y-2 text-left">
        <Row label="Booking reference" value={booking.booking_number} />
        <Row label="Package" value={snapshot.package ?? "—"} />
        <Row label="Package rate" value={snapshot.ratePer30MinCents ? `$${(snapshot.ratePer30MinCents / 100).toFixed(0)} / 30 min ($${((snapshot.ratePer30MinCents * 2) / 100).toFixed(0)}/hr)` : "—"} />
        <Row label="Move date" value={new Date(booking.starts_at).toLocaleString("en-AU", { timeZone: "Australia/Adelaide" })} />
        <Row label="Pickup" value={pickup?.formattedAddress ?? `${pickup?.addressLine ?? ""} ${pickup?.suburb ?? ""}`} />
        <Row label="Destination" value={destination?.formattedAddress ?? `${destination?.addressLine ?? ""} ${destination?.suburb ?? ""}`} />
        <Row label="Minimum service" value={snapshot.minimumBookingMinutes ? `${snapshot.minimumBookingMinutes / 60} hours` : "—"} />
        <Row
          label="Call-out"
          value={
            snapshot.calloutMinutes && snapshot.ratePer30MinCents
              ? `${snapshot.calloutMinutes / 60} hour — $${((snapshot.ratePer30MinCents * (snapshot.calloutMinutes / 30)) / 100).toFixed(0)}`
              : "—"
          }
        />
        <Row label="Estimated minimum" value={`$${(booking.subtotal_cents / 100).toFixed(2)}`} />
        <Row label="Booking confirmation" value={`$${(booking.deposit_paid_cents / 100).toFixed(2)} paid`} />
        <Row label="Estimated minimum balance after booking payment" value={`$${(booking.balance_due_cents / 100).toFixed(2)}`} />
      </dl>

      <p className="mt-6 text-xs text-neutral-500">
        3-hour minimum service + 1-hour call-out fee. The call-out covers truck fuel and basic transport charges.
        Additional service time is billed in 30-minute increments at your selected package rate. Your final price is
        calculated when the job is completed. The $100 booking confirmation payment is credited toward your final
        balance.
      </p>

      <Link href="/" className="mt-10 inline-block rounded-full bg-neutral-900 px-6 py-3 text-white">Return home</Link>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b py-2">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function Fallback({ message }: { message: string }) {
  return (
    <main className="booking-shell mx-auto max-w-2xl px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold">{message}</h1>
      <Link href="/" className="mt-8 inline-block rounded-full bg-neutral-900 px-6 py-3 text-white">Return home</Link>
    </main>
  );
}
