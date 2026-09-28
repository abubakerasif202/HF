import { jsonError } from "../../../../lib/server/api-helpers.ts";

export const dynamic = "force-dynamic";

/**
 * POST /api/booking/checkout — RETIRED.
 *
 * Online bookings no longer take any advance payment, so no new booking
 * may ever enter Stripe Checkout. Bookings are confirmed through
 * POST /api/booking/confirm instead. This route is kept only so stale
 * clients get an explicit answer rather than a 404.
 */
export async function POST() {
  return jsonError(410, "Online payment is no longer part of booking. Please confirm your booking without payment.", {
    code: "advance_payment_retired",
  });
}
