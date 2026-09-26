import Link from "next/link";
import { isBookingSystemLive } from "../../../lib/server/config.ts";
import { getBookingByAccessToken } from "../../../lib/server/booking-repo.ts";
import { RetryPaymentButton } from "./RetryPaymentButton";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

// Kept outside the component: the ESLint react-hooks/purity rule flags
// Date.now() called directly in a component body, even though this is a
// Server Component where re-evaluating "is the hold still valid" on every
// request is exactly the intended behaviour.
function isHoldStillValid(holdExpiresAt: string | null): boolean {
  if (!holdExpiresAt) return false;
  return new Date(holdExpiresAt).getTime() > Date.now();
}

export default async function BookingCancelPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const booking = token && isBookingSystemLive() ? await getBookingByAccessToken(token).catch(() => null) : null;

  const stillHeld = booking?.booking_status === "held" || booking?.booking_status === "pending_payment";
  const holdStillValid = isHoldStillValid(booking?.hold_expires_at ?? null);

  return (
    <main className="booking-shell mx-auto max-w-2xl px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold">Your booking has not been confirmed</h1>
      <p className="mt-4 text-neutral-600">
        {stillHeld && holdStillValid
          ? "Your time slot is still held for a few more minutes — you can retry payment before it expires."
          : "Your held time slot has been released. You're welcome to start a new booking."}
      </p>
      <div className="mt-8 flex justify-center gap-3">
        {stillHeld && holdStillValid && booking ? (
          <RetryPaymentButton bookingId={booking.id} accessToken={booking.access_token} />
        ) : (
          <Link href="/book" className="rounded-full bg-neutral-900 px-6 py-3 text-white">Start a new booking</Link>
        )}
        <Link href="/contact" className="rounded-full border px-6 py-3">Get a Quote instead</Link>
      </div>
    </main>
  );
}
