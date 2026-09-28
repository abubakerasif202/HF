// Pure, DB/Stripe-free validation logic for the Stripe webhook. Kept
// separate from app/api/stripe/webhook/route.ts so the decision rules —
// which event to trust, which to ignore, which to flag — are unit
// testable without a live Stripe or Supabase connection.

export interface CheckoutSessionEventInput {
  sessionId: string;
  sessionMetadataBookingId: string | undefined;
  paymentStatus: string | null | undefined;
  amountTotalCents: number | null | undefined;
  currency: string | null | undefined;
}

export interface BookingForValidation {
  id: string;
  bookingStatus: string;
  currentCheckoutSessionId: string | null;
  depositRequiredCents: number;
}

export type WebhookDecision =
  | { action: "confirm" }
  | { action: "ignore_stale_session"; reason: string }
  | { action: "ignore_not_yet_paid"; reason: string }
  | { action: "reject_mismatch"; reason: string }
  | { action: "no_booking_id" };

const EXPECTED_CURRENCY = "aud";

/**
 * Decides what a `checkout.session.completed` / `.async_payment_succeeded`
 * event should do to a booking, WITHOUT performing any side effect. Every
 * branch is a deliberate safety check:
 *
 *  - no_booking_id: malformed/foreign session, nothing to do.
 *  - ignore_stale_session: the booking has since been retried under a
 *    newer Checkout session; this event belongs to a superseded one and
 *    must never re-confirm or double-record a payment.
 *  - ignore_not_yet_paid: an async payment method (e.g. bank transfer)
 *    that hasn't settled yet — wait for the next event.
 *  - reject_mismatch: the session's actual amount/currency doesn't match
 *    what this booking was charged for. Never confirm on a client- or
 *    Stripe-side amount we didn't expect — surface for admin review
 *    instead of trusting it blindly.
 *  - confirm: safe to record the payment and confirm the booking.
 */
export function decideCheckoutSessionCompleted(
  event: CheckoutSessionEventInput,
  booking: BookingForValidation | null,
): WebhookDecision {
  if (!event.sessionMetadataBookingId) return { action: "no_booking_id" };
  if (!booking) return { action: "no_booking_id" };

  // Strict match: a booking with NO recorded Checkout session is a
  // no-advance-payment booking that never entered Stripe, so no Stripe
  // event may ever touch it.
  if (!booking.currentCheckoutSessionId) {
    return { action: "ignore_stale_session", reason: "Booking has no Stripe Checkout session (no-advance-payment booking); ignoring." };
  }
  if (booking.currentCheckoutSessionId !== event.sessionId) {
    return { action: "ignore_stale_session", reason: "Event belongs to a superseded Checkout session for this booking." };
  }

  if (event.paymentStatus !== "paid") {
    return { action: "ignore_not_yet_paid", reason: `Checkout session payment_status is "${event.paymentStatus}", not "paid".` };
  }

  if ((event.currency ?? "").toLowerCase() !== EXPECTED_CURRENCY) {
    return { action: "reject_mismatch", reason: `Expected currency ${EXPECTED_CURRENCY}, session reports ${event.currency}.` };
  }

  if (event.amountTotalCents !== booking.depositRequiredCents) {
    return {
      action: "reject_mismatch",
      reason: `Expected ${booking.depositRequiredCents} cents (this booking's required confirmation amount), session reports ${event.amountTotalCents}.`,
    };
  }

  return { action: "confirm" };
}

/**
 * Decides whether a `checkout.session.expired` event should actually
 * expire the booking. Guards against two out-of-order scenarios: a stale
 * session's expiry arriving after a retry, and — most importantly — an
 * expiry event arriving for a booking that a completed-event has already
 * confirmed (must never un-confirm a paid booking).
 */
export function decideCheckoutSessionExpired(
  event: CheckoutSessionEventInput,
  booking: BookingForValidation | null,
): { shouldExpire: boolean; reason: string } {
  if (!booking) return { shouldExpire: false, reason: "No matching booking." };
  if (booking.currentCheckoutSessionId !== event.sessionId) {
    return { shouldExpire: false, reason: "Event belongs to a superseded Checkout session; the booking has since been retried." };
  }
  if (booking.bookingStatus !== "pending_payment") {
    return { shouldExpire: false, reason: `Booking is "${booking.bookingStatus}", not pending_payment — never un-confirm or otherwise override it.` };
  }
  return { shouldExpire: true, reason: "Session matches, booking is still pending_payment." };
}
