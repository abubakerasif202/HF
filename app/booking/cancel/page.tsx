import Link from "next/link";
import { isBookingSystemLive } from "../../../lib/server/config.ts";
import { getBookingByAccessToken } from "../../../lib/server/booking-repo.ts";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

const CONFIRMED_STATUSES = new Set(["confirmed", "assigned", "in_progress", "completed"]);

/**
 * Legacy URL. This used to be Stripe Checkout's cancel_url. Online
 * booking no longer involves any payment, so nothing in the current flow
 * links here — the page is kept only so historical Stripe-era links
 * still resolve to something sensible.
 */
export default async function BookingCancelPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const booking = token && isBookingSystemLive() ? await getBookingByAccessToken(token).catch(() => null) : null;

  if (booking && CONFIRMED_STATUSES.has(booking.booking_status)) {
    return (
      <main className="booking-shell mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="text-2xl font-semibold">Your booking is confirmed</h1>
        <p className="mt-4 text-neutral-600">Booking {booking.booking_number} is confirmed. No further action is needed.</p>
        <Link href={`/booking/success?token=${booking.access_token}`} className="mt-8 inline-block rounded-full bg-neutral-900 px-6 py-3 text-white">
          View booking
        </Link>
      </main>
    );
  }

  return (
    <main className="booking-shell mx-auto max-w-2xl px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold">This booking wasn&apos;t completed</h1>
      <p className="mt-4 text-neutral-600">
        You&apos;re welcome to start a new booking — it only takes a few minutes, and no advance payment is required.
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <Link href="/book" className="rounded-full bg-neutral-900 px-6 py-3 text-white">Start a new booking</Link>
        <Link href="/contact" className="rounded-full border px-6 py-3">Get a Quote instead</Link>
      </div>
    </main>
  );
}
