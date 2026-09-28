import { NextRequest, NextResponse } from "next/server";
import { stripeConfig, supabaseConfig } from "../../../../lib/server/config.ts";
import { getStripe } from "../../../../lib/server/stripe.ts";
import { hasProcessedStripeEvent, markStripeEventProcessed, confirmBookingPayment, recordPayment, getBookingById } from "../../../../lib/server/booking-repo.ts";
import { getSupabaseAdmin } from "../../../../lib/server/supabase.ts";
import { sendBookingConfirmedEmail, notifyAdminOfConflict } from "../../../../lib/server/notifications.ts";
import { syncBookingToCalendar } from "../../../../lib/server/google-calendar.ts";
import { decideCheckoutSessionCompleted, decideCheckoutSessionExpired } from "../../../../lib/booking/webhook-validation.ts";
import type Stripe from "stripe";

export const dynamic = "force-dynamic";

function toBookingForValidation(booking: Awaited<ReturnType<typeof getBookingById>>) {
  if (!booking) return null;
  return {
    id: booking.id as string,
    bookingStatus: booking.booking_status as string,
    currentCheckoutSessionId: (booking.current_checkout_session_id as string | null) ?? null,
    depositRequiredCents: booking.deposit_required_cents as number,
  };
}

async function logMismatch(bookingId: string, eventId: string, reason: string) {
  await getSupabaseAdmin().from("booking_events").insert({
    booking_id: bookingId,
    event: "payment_amount_mismatch",
    actor: "stripe_webhook",
    metadata: { stripe_event_id: eventId, reason },
  });
  const booking = await getBookingById(bookingId);
  if (booking) await notifyAdminOfConflict(booking).catch(() => {});
}

/**
 * DORMANT — historical compatibility only.
 *
 * Online bookings no longer take an advance payment, and no new booking
 * ever enters Stripe Checkout (/api/booking/checkout returns 410). New
 * bookings are confirmed by POST /api/booking/confirm. This handler is
 * kept solely so a late event for a GENUINE historical Checkout session
 * is still processed consistently. It can never transition a
 * no-payment booking: every branch requires the event's session id to
 * equal the booking's recorded current_checkout_session_id, which is
 * always null for no-payment bookings.
 *
 * Idempotency: every event.id is recorded in `stripe_events` ONLY after
 * its side effects complete successfully, so a retried delivery (Stripe
 * retries on non-2xx or timeout) safely re-runs to completion rather than
 * being silently skipped mid-way (see markStripeEventProcessed usage
 * below — never called before the try block finishes).
 */
export async function POST(request: NextRequest) {
  if (!supabaseConfig.isConfigured() || !stripeConfig.isConfigured() || !stripeConfig.isWebhookConfigured()) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  // Signature verification requires the raw, unparsed body — never JSON.parse
  // (or otherwise transform) the body before this call.
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, stripeConfig.webhookSecret());
  } catch (error) {
    // Never log the signature, the webhook secret, or the raw body here —
    // only the (safe, non-secret) verification failure message.
    return NextResponse.json({ error: `Invalid signature: ${(error as Error).message}` }, { status: 400 });
  }

  if (await hasProcessedStripeEvent(event.id)) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object as Stripe.Checkout.Session;
      const bookingId = session.metadata?.booking_id;
      const booking = bookingId ? await getBookingById(bookingId) : null;

      const decision = decideCheckoutSessionCompleted(
        {
          sessionId: session.id,
          sessionMetadataBookingId: bookingId,
          paymentStatus: session.payment_status,
          amountTotalCents: session.amount_total,
          currency: session.currency,
        },
        toBookingForValidation(booking),
      );

      if (decision.action === "no_booking_id") {
        return NextResponse.json({ received: true, warning: "no matching booking" });
      }
      if (decision.action === "ignore_stale_session" || decision.action === "ignore_not_yet_paid") {
        await markStripeEventProcessed(event.id, event.type);
        return NextResponse.json({ received: true, note: decision.reason });
      }
      if (decision.action === "reject_mismatch") {
        // Never confirm on an amount/currency we didn't expect. This is a
        // final decision (not a transient failure), so mark the event
        // processed to avoid an endless Stripe retry loop, and surface it
        // to a human instead of silently accepting the payment.
        await logMismatch(bookingId!, event.id, decision.reason);
        await markStripeEventProcessed(event.id, event.type);
        return NextResponse.json({ received: true, warning: decision.reason }, { status: 200 });
      }

      // decision.action === "confirm" — bookingId and booking are non-null here.
      const amountPaid = session.amount_total ?? 0;
      const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null);

      // Payment record + booking status flip are the authoritative DB
      // confirmation; both happen before any external side effect below.
      await recordPayment({
        bookingId: bookingId!,
        checkoutSessionId: session.id,
        paymentIntentId,
        amountCents: amountPaid,
        currency: session.currency ?? "aud",
        status: "paid",
      });

      const confirmed = await confirmBookingPayment(bookingId!, amountPaid);

      if (confirmed.booking_status !== "confirmed") {
        // The slot was released (hold/session expired, or the booking was
        // cancelled) before this payment landed. Do NOT silently confirm
        // over whatever now occupies that vehicle/time — flag for a human.
        await getSupabaseAdmin().from("booking_events").insert({
          booking_id: bookingId,
          event: "payment_conflict_needs_review",
          actor: "stripe_webhook",
          metadata: { stripe_event_id: event.id, booking_status: confirmed.booking_status },
        });
        await notifyAdminOfConflict(confirmed).catch(() => {});
      } else {
        // External side effects run AFTER the authoritative DB write, and
        // their failure never un-confirms the booking (each is caught
        // independently and logged via its own notifications/booking
        // fields for retry).
        await sendBookingConfirmedEmail(confirmed).catch(() => {});
        await syncBookingToCalendar(confirmed).catch(() => {});
      }
    } else if (event.type === "checkout.session.async_payment_failed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const bookingId = session.metadata?.booking_id;
      const booking = bookingId ? await getBookingById(bookingId) : null;
      // Only a genuine historical session for this exact booking may record anything.
      if (bookingId && booking && booking.current_checkout_session_id === session.id) {
        const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null);
        await recordPayment({
          bookingId,
          checkoutSessionId: session.id,
          paymentIntentId,
          amountCents: session.amount_total ?? 0,
          currency: session.currency ?? "aud",
          status: "failed",
        });
        await getSupabaseAdmin().from("booking_events").insert({
          booking_id: bookingId,
          event: "payment_failed",
          actor: "stripe_webhook",
          metadata: { stripe_event_id: event.id, checkout_session_id: session.id },
        });
        // Booking stays `pending_payment` — the customer can retry via
        // /booking/cancel's "Retry payment", which creates a fresh session.
      }
    } else if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      const bookingId = session.metadata?.booking_id;
      const booking = bookingId ? await getBookingById(bookingId) : null;
      const { shouldExpire } = decideCheckoutSessionExpired(
        { sessionId: session.id, sessionMetadataBookingId: bookingId, paymentStatus: session.payment_status, amountTotalCents: session.amount_total, currency: session.currency },
        toBookingForValidation(booking),
      );
      if (shouldExpire && bookingId) {
        await getSupabaseAdmin().from("bookings").update({ booking_status: "expired" }).eq("id", bookingId).eq("booking_status", "pending_payment");
        await getSupabaseAdmin().from("booking_events").insert({ booking_id: bookingId, event: "hold_expired", actor: "stripe_webhook" });
      }
    }
  } catch (error) {
    // Do NOT mark the event processed — Stripe will retry, and the next
    // attempt must re-run these side effects, not skip them.
    console.error("stripe webhook handling failed", event.id, event.type, (error as Error).message);
    return NextResponse.json({ error: "Internal error processing webhook" }, { status: 500 });
  }

  await markStripeEventProcessed(event.id, event.type);
  return NextResponse.json({ received: true });
}
