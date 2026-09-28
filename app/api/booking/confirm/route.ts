import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withBookingSystemGuard, jsonError } from "../../../../lib/server/api-helpers.ts";
import {
  getBusinessSettings,
  getPricingRule,
  getBookingById,
  confirmBookingWithoutPayment,
} from "../../../../lib/server/booking-repo.ts";
import { sendBookingConfirmedEmail } from "../../../../lib/server/notifications.ts";
import { syncBookingToCalendar } from "../../../../lib/server/google-calendar.ts";
import { calculateQuote, buildPricingSnapshot } from "../../../../lib/booking/pricing.ts";
import { runNoPaymentConfirmation, HOLD_EXPIRED_MESSAGE } from "../../../../lib/booking/confirmation.ts";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  bookingId: z.string().uuid(),
  accessToken: z.string().uuid(),
});

/**
 * POST /api/booking/confirm
 *
 * Confirms the customer's own held booking with NO advance payment. The
 * browser supplies only the booking id and its unguessable access token;
 * status, price, package and resources are never read from the request.
 * The price snapshot is recomputed here from the booking's own crew size
 * and scheduled duration, and the database RPC performs the atomic
 * held -> confirmed transition (token + state + hold-expiry checked in
 * the same UPDATE). Repeat calls are harmless: they return the existing
 * confirmed booking and trigger no further email or calendar sync.
 */
export async function POST(request: NextRequest) {
  return withBookingSystemGuard(async () => {
    const body = bodySchema.safeParse(await request.json().catch(() => null));
    if (!body.success) return jsonError(400, "Invalid request", { issues: body.error.issues });

    const booking = await getBookingById(body.data.bookingId);
    if (!booking || booking.access_token !== body.data.accessToken) {
      return jsonError(404, "Booking not found.");
    }
    if (booking.booking_status === "expired") {
      return jsonError(409, HOLD_EXPIRED_MESSAGE, { code: "hold_expired" });
    }

    const settings = await getBusinessSettings();
    const rule = await getPricingRule(booking.crew_size);
    // The booking's own scheduled duration is the estimate at booking
    // time; the real figure is computed when staff finalise the job.
    const quote = calculateQuote(
      { crewSize: booking.crew_size, actualDurationMinutes: booking.estimated_duration_minutes, startsAt: new Date(booking.starts_at) },
      rule,
      settings,
      settings.timezone,
    );
    if (!quote.isFullyConfigured) {
      return jsonError(503, "Pricing for this package isn't configured yet. Please call us to book.");
    }

    const outcome = await runNoPaymentConfirmation({
      confirm: () =>
        confirmBookingWithoutPayment({
          bookingId: body.data.bookingId,
          accessToken: body.data.accessToken,
          pricingSnapshot: buildPricingSnapshot(quote),
          subtotalCents: quote.finalTotalCents,
        }),
      sendConfirmationEmail: sendBookingConfirmedEmail,
      syncCalendar: syncBookingToCalendar,
      onSideEffectError: (what, error) => console.error(`booking confirmation ${what} side effect failed`, booking.booking_number, (error as Error).message),
    });

    if (outcome.httpStatus !== 200 || !outcome.booking) {
      return jsonError(outcome.httpStatus, outcome.message ?? "Could not confirm this booking.", { code: outcome.reason });
    }

    return NextResponse.json({
      confirmed: true,
      alreadyConfirmed: outcome.reason === "already_confirmed",
      bookingNumber: outcome.booking.booking_number,
      successUrl: `/booking/success?token=${outcome.booking.access_token}`,
    });
  });
}
