import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runNoPaymentConfirmation, HOLD_EXPIRED_MESSAGE } from "../lib/booking/confirmation.ts";
import { isBookingSystemLive } from "../lib/server/config.ts";
import { LIVE_STATUSES } from "../lib/booking/state-machine.ts";
import { pickFreeVehicle } from "../lib/booking/availability.ts";
import { decideCheckoutSessionCompleted, decideCheckoutSessionExpired } from "../lib/booking/webhook-validation.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// ---------------------------------------------------------------------------
// Booking system live state no longer depends on Stripe
// ---------------------------------------------------------------------------

function withEnv(vars, fn) {
  const saved = {};
  for (const key of Object.keys(vars)) {
    saved[key] = process.env[key];
    if (vars[key] === undefined) delete process.env[key];
    else process.env[key] = vars[key];
  }
  try {
    return fn();
  } finally {
    for (const key of Object.keys(saved)) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}

const NO_STRIPE = { STRIPE_SECRET_KEY: undefined, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: undefined, STRIPE_WEBHOOK_SECRET: undefined };

test("config: booking system is live with Supabase alone — no Stripe keys required", () => {
  const live = withEnv({ ...NO_STRIPE, NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "service-role" }, isBookingSystemLive);
  assert.equal(live, true);
});

test("config: booking system stays off without Supabase, even when Stripe is configured", () => {
  const live = withEnv({ NEXT_PUBLIC_SUPABASE_URL: undefined, SUPABASE_SERVICE_ROLE_KEY: undefined, STRIPE_SECRET_KEY: "sk_test_x" }, isBookingSystemLive);
  assert.equal(live, false);
});

// ---------------------------------------------------------------------------
// In-memory model of confirm_booking_without_payment (migration 0011).
// It mirrors the SQL exactly: one conditional transition keyed on
// id + access_token + status 'held' + unexpired hold; only the caller that
// flips the row gets transitioned = true. Awaiting between the "read" and
// the "write" deliberately interleaves concurrent callers.
// ---------------------------------------------------------------------------

function createFakeDb(overrides = {}) {
  const booking = {
    id: "11111111-1111-4111-8111-111111111111",
    booking_number: "HF-2026-00042",
    access_token: "22222222-2222-4222-8222-222222222222",
    booking_status: "held",
    payment_status: "not_required",
    hold_expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    deposit_required_cents: 0,
    deposit_paid_cents: 0,
    subtotal_cents: 0,
    balance_due_cents: 0,
    pricing_snapshot: null,
    ...overrides,
  };
  const db = { booking, events: [], payments: [], emails: [], calendar: [] };

  db.rpc = async ({ bookingId, accessToken, pricingSnapshot, subtotalCents }) => {
    await new Promise((resolve) => setImmediate(resolve));
    const row = db.booking;
    const owns = row.id === bookingId && row.access_token === accessToken;
    const holdValid = row.hold_expires_at && new Date(row.hold_expires_at).getTime() > Date.now();
    if (owns && row.booking_status === "held" && holdValid) {
      Object.assign(row, {
        booking_status: "confirmed",
        payment_status: "not_required",
        deposit_required_cents: 0,
        deposit_paid_cents: 0,
        subtotal_cents: subtotalCents,
        balance_due_cents: subtotalCents,
        pricing_snapshot: pricingSnapshot,
        hold_expires_at: null,
      });
      db.events.push({ booking_id: row.id, event: "booking_confirmed" });
      return { transitioned: true, reason: "confirmed", booking: { ...row } };
    }
    if (!owns) return { transitioned: false, reason: "not_found", booking: null };
    if (["confirmed", "assigned", "in_progress", "completed"].includes(row.booking_status)) {
      return { transitioned: false, reason: "already_confirmed", booking: { ...row } };
    }
    if (row.booking_status === "expired" || (row.booking_status === "held" && !holdValid)) {
      return { transitioned: false, reason: "hold_expired", booking: null };
    }
    return { transitioned: false, reason: "invalid_status", booking: null };
  };
  return db;
}

const SNAPSHOT = { package: "2 Movers + Truck", ratePer30MinCents: 7900, minimumBookingMinutes: 180, calloutMinutes: 60, advancePaymentRequired: false, advancePaymentCents: 0 };

function confirmVia(db, { accessToken = db.booking.access_token, emailFails = false, calendarFails = false } = {}) {
  return runNoPaymentConfirmation({
    confirm: () => db.rpc({ bookingId: db.booking.id, accessToken, pricingSnapshot: SNAPSHOT, subtotalCents: 63200 }),
    sendConfirmationEmail: async (b) => {
      if (emailFails) throw new Error("resend down");
      db.emails.push(b.id);
    },
    syncCalendar: async (b) => {
      if (calendarFails) throw new Error("google down");
      db.calendar.push(b.id);
    },
  });
}

test("confirm: a valid hold becomes confirmed without any payment", async () => {
  const db = createFakeDb();
  const outcome = await confirmVia(db);
  assert.equal(outcome.httpStatus, 200);
  assert.equal(outcome.reason, "confirmed");
  assert.equal(db.booking.booking_status, "confirmed");
  assert.equal(db.booking.hold_expires_at, null);
});

test("confirm: payment_status is not_required — never paid/deposit_paid — and no payment record is created", async () => {
  const db = createFakeDb();
  await confirmVia(db);
  assert.equal(db.booking.payment_status, "not_required");
  assert.equal(db.booking.deposit_paid_cents, 0);
  assert.equal(db.booking.deposit_required_cents, 0);
  assert.equal(db.payments.length, 0);
});

test("confirm: the final balance of a new booking equals its full estimated total", async () => {
  const db = createFakeDb();
  await confirmVia(db);
  assert.equal(db.booking.subtotal_cents, 63200);
  assert.equal(db.booking.balance_due_cents, 63200);
});

test("confirm: the pricing snapshot is frozen onto the booking at confirmation", async () => {
  const db = createFakeDb();
  await confirmVia(db);
  assert.deepEqual(db.booking.pricing_snapshot, SNAPSHOT);
});

test("confirm: an expired hold cannot be confirmed and returns the friendly re-select message", async () => {
  const db = createFakeDb({ hold_expires_at: new Date(Date.now() - 60_000).toISOString() });
  const outcome = await confirmVia(db);
  assert.equal(outcome.httpStatus, 409);
  assert.equal(outcome.reason, "hold_expired");
  assert.equal(outcome.message, HOLD_EXPIRED_MESSAGE);
  assert.equal(db.booking.booking_status, "held");
  assert.equal(db.emails.length, 0);
});

test("confirm: a hold already swept to expired cannot be confirmed", async () => {
  const db = createFakeDb({ booking_status: "expired" });
  const outcome = await confirmVia(db);
  assert.equal(outcome.reason, "hold_expired");
  assert.equal(db.booking.booking_status, "expired");
});

test("confirm: the wrong access token cannot confirm someone else's booking (and reveals nothing)", async () => {
  const db = createFakeDb();
  const outcome = await confirmVia(db, { accessToken: "33333333-3333-4333-8333-333333333333" });
  assert.equal(outcome.httpStatus, 404);
  assert.equal(outcome.booking, null);
  assert.equal(db.booking.booking_status, "held");
  assert.equal(db.events.length, 0);
});

test("confirm: a cancelled or legacy pending_payment booking cannot be confirmed without payment", async () => {
  for (const status of ["cancelled", "pending_payment"]) {
    const db = createFakeDb({ booking_status: status });
    const outcome = await confirmVia(db);
    assert.equal(outcome.httpStatus, 409);
    assert.equal(outcome.reason, "invalid_status");
    assert.equal(db.booking.booking_status, status);
  }
});

test("confirm: double-clicking Confirm Booking (concurrent requests) confirms once, emails once, syncs calendar once", async () => {
  const db = createFakeDb();
  const outcomes = await Promise.all([confirmVia(db), confirmVia(db), confirmVia(db)]);
  assert.deepEqual(outcomes.map((o) => o.httpStatus), [200, 200, 200]);
  assert.equal(outcomes.filter((o) => o.reason === "confirmed").length, 1);
  assert.equal(outcomes.filter((o) => o.reason === "already_confirmed").length, 2);
  assert.equal(db.events.filter((e) => e.event === "booking_confirmed").length, 1);
  assert.equal(db.emails.length, 1);
  assert.equal(db.calendar.length, 1);
});

test("confirm: a repeat confirmation later is idempotent — returns the existing booking, no side effects", async () => {
  const db = createFakeDb();
  await confirmVia(db);
  const again = await confirmVia(db);
  assert.equal(again.httpStatus, 200);
  assert.equal(again.reason, "already_confirmed");
  assert.equal(again.booking.booking_number, "HF-2026-00042");
  assert.equal(db.emails.length, 1);
  assert.equal(db.calendar.length, 1);
});

test("confirm: an email or calendar outage never un-confirms the booking", async () => {
  const db = createFakeDb();
  const outcome = await confirmVia(db, { emailFails: true, calendarFails: true });
  assert.equal(outcome.httpStatus, 200);
  assert.equal(db.booking.booking_status, "confirmed");
});

// ---------------------------------------------------------------------------
// Resource conflicts still apply to held AND confirmed bookings
// ---------------------------------------------------------------------------

test("resources: held and confirmed bookings both occupy the truck, so conflicts are still enforced", () => {
  assert.ok(LIVE_STATUSES.includes("held"));
  assert.ok(LIVE_STATUSES.includes("confirmed"));
  const window = { startsAt: new Date("2026-11-10T00:00:00Z"), endsAt: new Date("2026-11-10T03:00:00Z") };
  const busy = [{ vehicleId: "truck-1", startsAt: new Date("2026-11-10T01:00:00Z"), endsAt: new Date("2026-11-10T04:00:00Z") }];
  assert.equal(pickFreeVehicle(window, ["truck-1"], busy, []), null);
  assert.equal(pickFreeVehicle(window, ["truck-1", "truck-2"], busy, []), "truck-2");
});

// ---------------------------------------------------------------------------
// The dormant Stripe webhook can never touch a no-payment booking
// ---------------------------------------------------------------------------

const noPaymentBooking = { id: "b-new", bookingStatus: "held", currentCheckoutSessionId: null, depositRequiredCents: 0 };
const anyPaidEvent = { sessionId: "cs_forged", sessionMetadataBookingId: "b-new", paymentStatus: "paid", amountTotalCents: 0, currency: "aud" };

test("webhook: a completed-session event for a no-payment booking (no Checkout session) is ignored", () => {
  const decision = decideCheckoutSessionCompleted(anyPaidEvent, noPaymentBooking);
  assert.equal(decision.action, "ignore_stale_session");
});

test("webhook: an expired-session event can never expire a no-payment booking", () => {
  const { shouldExpire } = decideCheckoutSessionExpired(anyPaidEvent, { ...noPaymentBooking, bookingStatus: "confirmed" });
  assert.equal(shouldExpire, false);
});

// ---------------------------------------------------------------------------
// Migration safety: additive, server-only, race-safe
// ---------------------------------------------------------------------------

test("migration 0011: adds not_required and a service-role-only confirmation RPC without destroying history", async () => {
  const sql = await read("supabase/migrations/0011_no_advance_payment.sql");
  assert.match(sql, /'not_required'/);
  assert.match(sql, /create or replace function confirm_booking_without_payment/);
  assert.match(sql, /and access_token = p_access_token\s+and booking_status = 'held'\s+and hold_expires_at is not null\s+and hold_expires_at > now\(\)/);
  assert.match(sql, /revoke execute on function confirm_booking_without_payment\(uuid, uuid, jsonb, integer\) from public, anon, authenticated;/);
  assert.match(sql, /grant execute on function confirm_booking_without_payment\(uuid, uuid, jsonb, integer\) to service_role;/);
  assert.match(sql, /security definer\s+set search_path = public/);
  assert.doesNotMatch(sql, /drop\s+table|drop\s+column|truncate|delete\s+from/i);
  assert.doesNotMatch(sql, /insert into payments/i);
});

// ---------------------------------------------------------------------------
// Customer-facing copy: no advance-payment wording anywhere in the flow
// ---------------------------------------------------------------------------

const CUSTOMER_FACING = [
  "app/book/BookingWizard.tsx",
  "app/book/page.tsx",
  "app/booking/success/page.tsx",
  "app/booking/cancel/page.tsx",
  "app/components/Site.tsx",
  "app/components/GoogleAppointmentSchedule.tsx",
  "lib/site-data.ts",
  "lib/booking/pricing.ts",
];

const BANNED = [
  /\$100/,
  /Pay \$/i,
  /Pay & Confirm/i,
  /Review & Pay/i,
  /Pay Deposit/i,
  /Secure Booking/i,
  /secure your booking/i,
  /credited toward/i,
  /booking confirmation payment/i,
  /Stripe Checkout/i,
  /Payment successful/i,
  /Deposit received/i,
  /Redirecting to secure payment/i,
  /paid reservation/i,
];

test("copy: customer-facing booking UI contains no active advance-payment wording", async () => {
  for (const path of CUSTOMER_FACING) {
    const source = await read(path);
    // Strip comments so explanatory developer notes don't count as copy.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    for (const pattern of BANNED) {
      assert.doesNotMatch(code, pattern, `${path} still contains ${pattern}`);
    }
  }
});

test("copy: the wizard step is 'Review & Confirm' and the final button is 'Confirm Booking'", async () => {
  const wizard = await read("app/book/BookingWizard.tsx");
  assert.match(wizard, /label: "Review & Confirm"/);
  assert.match(wizard, /"Confirm Booking"/);
  assert.match(wizard, /\/api\/booking\/confirm/);
  assert.doesNotMatch(wizard, /\/api\/booking\/checkout|checkoutUrl/);
});

test("copy: booking intro, homepage and success page state no advance payment is required", async () => {
  assert.match(await read("app/book/page.tsx"), /No advance payment required\./);
  assert.match(await read("app/components/Site.tsx"), /No advance payment is required/);
  const success = await read("app/booking/success/page.tsx");
  assert.match(success, /Booking Confirmed/);
  assert.match(success, /Your booking has been received and confirmed\./);
});

test("stripe: the checkout route is retired and can never start a Checkout Session", async () => {
  const route = await read("app/api/booking/checkout/route.ts");
  assert.match(route, /410/);
  assert.doesNotMatch(route, /checkout\.sessions\.create|getStripe/);
});
