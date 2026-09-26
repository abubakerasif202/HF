import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withBookingSystemGuard, jsonError } from "../../../../lib/server/api-helpers.ts";
import { getBookingByAccessToken } from "../../../../lib/server/booking-repo.ts";

export const dynamic = "force-dynamic";

const querySchema = z.object({ token: z.string().uuid() });

/**
 * GET /api/booking/lookup?token=...
 *
 * Public booking lookup, deliberately keyed by the unguessable
 * `access_token` (UUID) rather than the sequential booking id or the
 * human-readable booking number — so a customer can view their own
 * confirmation without exposing any other customer's booking by
 * enumeration.
 */
export async function GET(request: NextRequest) {
  return withBookingSystemGuard(async () => {
    const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
    if (!parsed.success) return jsonError(400, "Invalid token");

    const booking = await getBookingByAccessToken(parsed.data.token);
    if (!booking) return jsonError(404, "Booking not found");

    return NextResponse.json({
      bookingNumber: booking.booking_number,
      bookingStatus: booking.booking_status,
      paymentStatus: booking.payment_status,
      startsAt: booking.starts_at,
      pickupAddress: booking.pickup_address,
      destinationAddress: booking.destination_address,
      depositPaidCents: booking.deposit_paid_cents,
      balanceDueCents: booking.balance_due_cents,
      subtotalCents: booking.subtotal_cents,
    });
  });
}
