import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withBookingSystemGuard, jsonError } from "../../../../lib/server/api-helpers.ts";
import { getBusinessSettings, getPricingRule, getBookingById, setBookingPendingPayment } from "../../../../lib/server/booking-repo.ts";
import { getSupabaseAdmin } from "../../../../lib/server/supabase.ts";
import { getStripe } from "../../../../lib/server/stripe.ts";
import { calculateQuote } from "../../../../lib/booking/pricing.ts";
import { business } from "../../../../lib/site-data.ts";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  bookingId: z.string().uuid(),
  accessToken: z.string().uuid(),
});

/**
 * POST /api/booking/checkout
 *
 * Re-verifies the booking is still `held` and re-calculates the price and
 * deposit server-side (never trusting a client-supplied amount), then
 * creates a Stripe Checkout Session for the deposit only. The booking
 * moves to `pending_payment`; the Stripe webhook — not this route, and
 * not the success redirect — is what confirms it.
 */
export async function POST(request: NextRequest) {
  return withBookingSystemGuard(async () => {
    const body = bodySchema.safeParse(await request.json().catch(() => null));
    if (!body.success) return jsonError(400, "Invalid request", { issues: body.error.issues });

    const booking = await getBookingById(body.data.bookingId);
    if (!booking || booking.access_token !== body.data.accessToken) {
      return jsonError(404, "Booking not found.");
    }
    // `pending_payment` is included so a customer whose first Checkout
    // session expired/was cancelled can retry without the booking being
    // treated as already-paid-for or unbookable.
    if (booking.booking_status !== "held" && booking.booking_status !== "pending_payment") {
      return jsonError(409, "This booking is no longer awaiting payment.", { status: booking.booking_status });
    }
    if (booking.hold_expires_at && new Date(booking.hold_expires_at).getTime() < Date.now()) {
      return jsonError(409, "Your hold has expired. Please choose a time again.", { code: "hold_expired" });
    }

    const settings = await getBusinessSettings();
    const rule = await getPricingRule(booking.crew_size);
    // Uses the booking's own scheduled duration as the "actual" duration
    // estimate at hold time — the true actual duration is only known once
    // staff finalise the job (see /admin/bookings/[id] "Complete Job").
    const quote = calculateQuote(
      { crewSize: booking.crew_size, actualDurationMinutes: booking.estimated_duration_minutes, startsAt: new Date(booking.starts_at) },
      rule,
      settings,
      settings.timezone,
    );

    if (!quote.isFullyConfigured || quote.bookingConfirmationCents <= 0) {
      return jsonError(503, "Booking confirmation pricing is not fully configured yet. An admin must set the deposit policy before payments can be taken.");
    }

    // The pricing_snapshot preserves the exact policy in effect right now
    // (rate, minimum, call-out, confirmation amount) so a later change to
    // pricing_rules/business_settings can never rewrite this booking's
    // historical numbers — including at job-finalisation time.
    const pricingSnapshot = {
      package: quote.packageName,
      ratePer30MinCents: quote.ratePer30MinCents,
      minimumBookingMinutes: quote.minimumBookingMinutes,
      calloutMinutes: quote.calloutMinutes,
      bookingConfirmationCents: quote.bookingConfirmationCents,
    };

    await getSupabaseAdmin()
      .from("bookings")
      .update({
        subtotal_cents: quote.finalTotalCents,
        deposit_required_cents: quote.bookingConfirmationCents,
        balance_due_cents: quote.estimatedBalanceCents,
        pricing_snapshot: pricingSnapshot,
      })
      .eq("id", booking.id);

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? business.domain;

    // Expire any previous Checkout session for this booking (e.g. a retry
    // after the first session expired or was abandoned) so at most one
    // live session — and one webhook `checkout.session.expired` event —
    // can ever apply to this booking at a time.
    if (booking.current_checkout_session_id) {
      await getStripe()
        .checkout.sessions.expire(booking.current_checkout_session_id)
        .catch(() => {
          // Already expired, completed or otherwise unexpirable — fine to ignore.
        });
    }

    // Stripe requires expires_at between 30 minutes and 24 hours from now.
    // This is always the FLOOR for the session, never clamped down to the
    // current hold_expires_at — the hold is extended to match the session
    // below instead, so the session can never outlive it.
    const expiresAtEpoch = Math.floor(Date.now() / 1000) + 30 * 60;

    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: quote.currency,
            unit_amount: quote.bookingConfirmationCents,
            product_data: {
              name: `${business.name} — Booking confirmation payment`,
              description: `Booking ${booking.booking_number} — credited toward your final job balance`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: { booking_id: booking.id, booking_number: booking.booking_number },
      expires_at: expiresAtEpoch,
      success_url: `${siteUrl}/booking/success?token=${booking.access_token}`,
      cancel_url: `${siteUrl}/booking/cancel?token=${booking.access_token}`,
    });

    await setBookingPendingPayment(booking.id, session.id, new Date(expiresAtEpoch * 1000));

    return NextResponse.json({ checkoutUrl: session.url });
  });
}
