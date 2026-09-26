import assert from "node:assert/strict";
import test from "node:test";
import { decideCheckoutSessionCompleted, decideCheckoutSessionExpired } from "../lib/booking/webhook-validation.ts";

const bookingBase = {
  id: "b1",
  bookingStatus: "pending_payment",
  currentCheckoutSessionId: "cs_current",
  depositRequiredCents: 10000,
};

function eventBase(overrides = {}) {
  return {
    sessionId: "cs_current",
    sessionMetadataBookingId: "b1",
    paymentStatus: "paid",
    amountTotalCents: 10000,
    currency: "aud",
    ...overrides,
  };
}

test("webhook: valid $100 AUD payment for the current session confirms exactly once", () => {
  const decision = decideCheckoutSessionCompleted(eventBase(), bookingBase);
  assert.deepEqual(decision, { action: "confirm" });
});

test("webhook: missing booking_id metadata is ignored, not confirmed", () => {
  const decision = decideCheckoutSessionCompleted(eventBase({ sessionMetadataBookingId: undefined }), bookingBase);
  assert.equal(decision.action, "no_booking_id");
});

test("webhook: no matching booking row is ignored, not confirmed", () => {
  const decision = decideCheckoutSessionCompleted(eventBase(), null);
  assert.equal(decision.action, "no_booking_id");
});

test("webhook: wrong amount does not confirm the booking", () => {
  const decision = decideCheckoutSessionCompleted(eventBase({ amountTotalCents: 5000 }), bookingBase);
  assert.equal(decision.action, "reject_mismatch");
  assert.match(decision.reason, /10000/);
});

test("webhook: wrong currency does not confirm the booking", () => {
  const decision = decideCheckoutSessionCompleted(eventBase({ currency: "usd" }), bookingBase);
  assert.equal(decision.action, "reject_mismatch");
  assert.match(decision.reason, /currency/i);
});

test("webhook: a stale (superseded) checkout session event is ignored, not confirmed", () => {
  const decision = decideCheckoutSessionCompleted(eventBase({ sessionId: "cs_old" }), bookingBase);
  assert.equal(decision.action, "ignore_stale_session");
});

test("webhook: an unpaid async session event is ignored until it actually settles", () => {
  const decision = decideCheckoutSessionCompleted(eventBase({ paymentStatus: "unpaid" }), bookingBase);
  assert.equal(decision.action, "ignore_not_yet_paid");
});

test("webhook: a duplicate (replayed) valid event still decides to confirm — idempotency is enforced by the route's stripe_events check, not this pure decision", () => {
  const first = decideCheckoutSessionCompleted(eventBase(), bookingBase);
  const replay = decideCheckoutSessionCompleted(eventBase(), bookingBase);
  assert.deepEqual(first, replay);
});

test("webhook: expired session releases an eligible (still pending_payment, still current) hold", () => {
  const result = decideCheckoutSessionExpired({ sessionId: "cs_current", sessionMetadataBookingId: "b1", paymentStatus: "unpaid", amountTotalCents: 10000, currency: "aud" }, bookingBase);
  assert.equal(result.shouldExpire, true);
});

test("webhook: a late/out-of-order expiry event can never cancel an already-confirmed booking", () => {
  const confirmedBooking = { ...bookingBase, bookingStatus: "confirmed" };
  const result = decideCheckoutSessionExpired({ sessionId: "cs_current", sessionMetadataBookingId: "b1", paymentStatus: "unpaid", amountTotalCents: 10000, currency: "aud" }, confirmedBooking);
  assert.equal(result.shouldExpire, false);
});

test("webhook: an expiry event for a superseded session is ignored (customer already retried)", () => {
  const result = decideCheckoutSessionExpired({ sessionId: "cs_old", sessionMetadataBookingId: "b1", paymentStatus: "unpaid", amountTotalCents: 10000, currency: "aud" }, bookingBase);
  assert.equal(result.shouldExpire, false);
});

test("webhook: an expiry event with no matching booking is a safe no-op", () => {
  const result = decideCheckoutSessionExpired({ sessionId: "cs_current", sessionMetadataBookingId: "b1", paymentStatus: "unpaid", amountTotalCents: 10000, currency: "aud" }, null);
  assert.equal(result.shouldExpire, false);
});
