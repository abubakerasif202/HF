import { NextRequest, NextResponse } from "next/server";
import { stripeConfig, isBookingSystemLive } from "../../../../lib/server/config.ts";
import { getStripe } from "../../../../lib/server/stripe.ts";
import { hasProcessedStripeEvent, markStripeEventProcessed, confirmBookingPayment, recordPayment, getBookingById } from "../../../../lib/server/booking-repo.ts";
import { getSupabaseAdmin } from "../../../../lib/server/supabase.ts";
import { sendBookingConfirmedEmail, notifyAdminOfConflict } from "../../../../lib/server/notifications.ts";
import { syncBookingToCalendar } from "../../../../lib/server/google-calendar.ts";
import type Stripe from "stripe";

export const dynamic = "force-dynamic";

/**
 * Stripe webhook — the ONLY source of truth for payment confirmation.
 * The /booking/success redirect page never confirms a booking on its own;
 * it only displays whatever state this webhook has already written.
 *
 * Idempotency: every event.id is recorded in `stripe_events` before any
 * side effect, so a retried delivery (Stripe retries on non-2xx or
 * timeout) is a safe no-op.
 */
export async function POST(request: NextRequest) {
  if (!isBookingSystemLive() || !stripeConfig.isWebhookConfigured()) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  // Signature verification requires the raw, unparsed body.
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, stripeConfig.webhookSecret());
  } catch (error) {
    return NextResponse.json({ error: `Invalid signature: ${(error as Error).message}` }, { status: 400 });
  }

  if (await hasProcessedStripeEvent(event.id)) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object as Stripe.Checkout.Session;
      const bookingId = session.metadata?.booking_id;
      if (!bookingId) return NextResponse.json({ received: true, warning: "no booking_id in metadata" });

      if (session.payment_status !== "paid") {
        // e.g. a delayed payment method still pending — nothing to confirm yet.
        await markStripeEventProcessed(event.id, event.type);
        return NextResponse.json({ received: true, note: "payment not yet paid" });
      }

      const booking = await getBookingById(bookingId);
      if (booking && booking.current_checkout_session_id && booking.current_checkout_session_id !== session.id) {
        // This event belongs to a superseded session (the customer
        // retried and got a newer one). The newer session is what
        // actually owns the booking now; ignore this stale event rather
        // than risk re-confirming or double-recording a payment.
        await markStripeEventProcessed(event.id, event.type);
        return NextResponse.json({ received: true, note: "stale checkout session, ignored" });
      }

      const amountPaid = session.amount_total ?? 0;
      const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null);

      await recordPayment({
        bookingId,
        checkoutSessionId: session.id,
        paymentIntentId,
        amountCents: amountPaid,
        currency: session.currency ?? "aud",
        status: "paid",
      });

      const confirmed = await confirmBookingPayment(bookingId, amountPaid);

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
        await sendBookingConfirmedEmail(confirmed).catch(() => {});
        await syncBookingToCalendar(confirmed).catch(() => {});
      }
    } else if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      const bookingId = session.metadata?.booking_id;
      if (bookingId) {
        const booking = await getBookingById(bookingId);
        // Only expire the booking if THIS session is still its current
        // one — a superseded session's expiry must not cancel a booking
        // that has since been retried under a newer session.
        if (booking && booking.booking_status === "pending_payment" && booking.current_checkout_session_id === session.id) {
          await getSupabaseAdmin().from("bookings").update({ booking_status: "expired" }).eq("id", bookingId).eq("booking_status", "pending_payment");
          await getSupabaseAdmin().from("booking_events").insert({ booking_id: bookingId, event: "hold_expired", actor: "stripe_webhook" });
        }
      }
    }
  } catch (error) {
    // Do NOT mark the event processed — Stripe will retry, and the next
    // attempt must re-run these side effects, not skip them.
    console.error("stripe webhook handling failed", event.id, event.type, error);
    return NextResponse.json({ error: "Internal error processing webhook" }, { status: 500 });
  }

  await markStripeEventProcessed(event.id, event.type);
  return NextResponse.json({ received: true });
}
