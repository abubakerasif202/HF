import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withBookingSystemGuard, jsonError } from "../../../../lib/server/api-helpers.ts";
import { enforceRateLimit } from "../../../../lib/server/rate-limit.ts";
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
    const limited = await enforceRateLimit(request, "confirm");
    if (!body.success) return limited ?? jsonError(400, "Invalid request", { issues: body.error.issues });

    const booking = await getBookingById(body.data.bookingId);
    const ownsBooking = Boolean(booking && booking.access_token === body.data.accessToken);

    // Idempotency beats rate limiting: a customer re-submitting (e.g. a
    // double click) for a booking that is ALREADY confirmed always gets
    // the existing confirmed result, never an alarming 429. Only new
    // confirmation attempts are limited.
    if (limited) {
      if (booking && ownsBooking && CONFIRMED_STATUSES.has(booking.booking_status)) {
        return confirmedResponse(booking, true);
      }
      return limited;
    }

    if (!booking || !ownsBooking) {
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

    return confirmedResponse(outcome.booking, outcome.reason === "already_confirmed");
  });
}

const CONFIRMED_STATUSES = new Set(["confirmed", "assigned", "in_progress", "completed"]);

function confirmedResponse(booking: { booking_number: string; access_token: string }, alreadyConfirmed: boolean) {
  return NextResponse.json({
    confirmed: true,
    alreadyConfirmed,
    bookingNumber: booking.booking_number,
    successUrl: `/booking/success?token=${booking.access_token}`,
  });
}
