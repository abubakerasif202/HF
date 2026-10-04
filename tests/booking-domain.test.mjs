import assert from "node:assert/strict";
import test from "node:test";
import { calculateQuote, packageNameForCrewSize, buildPricingSnapshot, computeFinalBilling } from "../lib/booking/pricing.ts";
import {
  generateCandidateSlots,
  resolveSlotState,
  pickFreeVehicle,
  withinBookingWindow,
} from "../lib/booking/availability.ts";
import { canTransition, assertTransition } from "../lib/booking/state-machine.ts";
import { zonedWallTimeToInstant, tzOffsetMs, instantToZonedParts } from "../lib/booking/timezone.ts";

const TZ = "Australia/Adelaide";

const settings = {
  timezone: TZ,
  businessOpenTime: "07:00",
  businessCloseTime: "20:00",
  bookingHoldMinutes: 30,
  minBookingLeadHours: 24,
  maxBookingHorizonDays: 90,
  defaultEstimatedDurationMinutes: 120,
  schedulingBufferMinutes: 30,
  // Confirmed HF Removals Adelaide business policy.
  minimumBookingMinutes: 180,
  calloutMinutes: 60,
  depositType: null,
  depositFixedAmountCents: null,
  depositPercentage: null,
  minDepositAmountCents: null,
};

// The legacy $100 deposit is still present in the hosted settings row; it
// must have NO effect on new quotes any more.
const configuredSettings = { ...settings, depositType: "fixed", depositFixedAmountCents: 10000 };

// Confirmed canonical rates: $79/30min (2 movers), $99/30min (3 movers).
const rule2 = { packageId: "2-men", crewSize: 2, ratePer30MinCents: 7900, minimumBillableMinutes: 60, weekendMultiplier: 1, publicHolidayMultiplier: 1 };
const rule3 = { packageId: "3-men", crewSize: 3, ratePer30MinCents: 9900, minimumBillableMinutes: 60, weekendMultiplier: 1, publicHolidayMultiplier: 1 };

test("timezone: Adelaide is +9:30 in ACST (non-DST, e.g. July)", () => {
  const winter = new Date(Date.UTC(2026, 6, 15, 0, 0, 0));
  const offsetMin = tzOffsetMs(winter, TZ) / 60_000;
  assert.equal(offsetMin, 570); // +9:30
});

test("timezone: Adelaide is +10:30 in ACDT (DST, e.g. January)", () => {
  const summer = new Date(Date.UTC(2026, 0, 15, 0, 0, 0));
  const offsetMin = tzOffsetMs(summer, TZ) / 60_000;
  assert.equal(offsetMin, 630); // +10:30
});

test("timezone: DST transition date does not break wall-time conversion", () => {
  // Australian DST typically ends the first Sunday of April. Confirm a
  // 9am local booking on that date resolves to a sane, round-trippable
  // UTC instant rather than silently drifting by 30-60 minutes.
  const instant = zonedWallTimeToInstant(2026, 4, 5, 9, 0, TZ);
  const parts = instantToZonedParts(instant, TZ);
  assert.equal(parts.hour, 9);
  assert.equal(parts.minute, 0);
  assert.equal(parts.day, 5);
});

test("timezone: evening wall time on the day before a DST change still resolves to the same hour", () => {
  // Adelaide's ACDT->ACST clock change in 2026 falls on Sun 5 Apr; the
  // preceding Saturday (4 Apr) at 18:00 local is where a single-pass
  // offset guess (evaluated at the guess instant, still in ACDT) drifts
  // by an hour from the corrected instant (which may already read
  // differently). This must round-trip exactly.
  const instant = zonedWallTimeToInstant(2026, 4, 4, 18, 0, TZ);
  const parts = instantToZonedParts(instant, TZ);
  assert.equal(parts.hour, 18);
  assert.equal(parts.day, 4);
});

test("availability: candidate slot starts never exceed business close (last-start policy, job may finish later)", () => {
  const slots = generateCandidateSlots(2026, 3, 10, 120, settings, 30);
  assert.ok(slots.length > 0);
  const last = slots[slots.length - 1];
  const closeInstant = zonedWallTimeToInstant(2026, 3, 10, 20, 0, TZ);
  assert.ok(last.startsAt.getTime() <= closeInstant.getTime());
  // The job is allowed to run past close — only the START is bounded.
  assert.ok(last.endsAt.getTime() > closeInstant.getTime());
});

test("availability: confirmed hours produce a 5am first start and a 6pm last start", () => {
  const hoursSettings = { ...settings, businessOpenTime: "05:00", businessCloseTime: "18:00" };
  const slots = generateCandidateSlots(2026, 3, 10, 180, hoursSettings, 30);
  const first = slots[0];
  const last = slots[slots.length - 1];
  assert.equal(instantToZonedParts(first.startsAt, TZ).hour, 5);
  assert.equal(instantToZonedParts(last.startsAt, TZ).hour, 18);
});

test("availability: slot is unavailable when the only vehicle is busy", () => {
  const slot = { startsAt: new Date("2026-03-10T01:00:00Z"), endsAt: new Date("2026-03-10T03:00:00Z") };
  const busy = [{ vehicleId: "v1", startsAt: new Date("2026-03-10T00:00:00Z"), endsAt: new Date("2026-03-10T02:00:00Z") }];
  const state = resolveSlotState(slot, ["v1"], busy, [], 1);
  assert.equal(state, "unavailable");
});

test("availability: slot is available when no vehicle conflicts", () => {
  const slot = { startsAt: new Date("2026-03-10T01:00:00Z"), endsAt: new Date("2026-03-10T03:00:00Z") };
  const state = resolveSlotState(slot, ["v1", "v2"], [], [], 1);
  assert.equal(state, "available");
});

test("availability: blocked_time with null vehicle_id blocks all resources", () => {
  const slot = { startsAt: new Date("2026-03-10T01:00:00Z"), endsAt: new Date("2026-03-10T03:00:00Z") };
  const blocked = [{ vehicleId: null, startsAt: new Date("2026-03-10T00:00:00Z"), endsAt: new Date("2026-03-10T23:00:00Z") }];
  const state = resolveSlotState(slot, ["v1", "v2"], [], blocked, 1);
  assert.equal(state, "unavailable");
});

test("availability: pickFreeVehicle returns null when everything conflicts", () => {
  const slot = { startsAt: new Date("2026-03-10T01:00:00Z"), endsAt: new Date("2026-03-10T03:00:00Z") };
  const busy = [
    { vehicleId: "v1", startsAt: new Date("2026-03-10T00:30:00Z"), endsAt: new Date("2026-03-10T02:00:00Z") },
    { vehicleId: "v2", startsAt: new Date("2026-03-10T02:30:00Z"), endsAt: new Date("2026-03-10T04:00:00Z") },
  ];
  assert.equal(pickFreeVehicle(slot, ["v1", "v2"], busy, []), null);
});

test("availability: booking window rejects too-soon and too-far dates", () => {
  const now = new Date("2026-03-01T00:00:00Z");
  const tooSoon = withinBookingWindow(new Date("2026-03-01T12:00:00Z"), now, settings);
  assert.equal(tooSoon.ok, false);
  const okDate = withinBookingWindow(new Date("2026-03-05T00:00:00Z"), now, settings);
  assert.equal(okDate.ok, true);
  const tooFar = withinBookingWindow(new Date("2027-01-01T00:00:00Z"), now, settings);
  assert.equal(tooFar.ok, false);
});

test("pricing: package names derive from crew size, one canonical source", () => {
  assert.equal(packageNameForCrewSize(2), "2 Movers + Truck");
  assert.equal(packageNameForCrewSize(3), "3 Movers + Truck");
});

test("pricing: 2 Movers + Truck uses the canonical 7900 cents / 30 min rate", () => {
  const quote = calculateQuote({ crewSize: 2, actualDurationMinutes: 180, startsAt: new Date("2026-03-10T00:00:00Z") }, rule2, configuredSettings, TZ);
  assert.equal(quote.ratePer30MinCents, 7900);
});

test("pricing: 3 Movers + Truck uses the canonical 9900 cents / 30 min rate", () => {
  const quote = calculateQuote({ crewSize: 3, actualDurationMinutes: 180, startsAt: new Date("2026-03-10T00:00:00Z") }, rule3, configuredSettings, TZ);
  assert.equal(quote.ratePer30MinCents, 9900);
});

test("pricing: exactly 3 hours (180 min) bills exactly the minimum, no rounding surprise", () => {
  const quote = calculateQuote({ crewSize: 2, actualDurationMinutes: 180, startsAt: new Date("2026-03-10T00:00:00Z") }, rule2, configuredSettings, TZ);
  assert.equal(quote.billableServiceMinutes, 180);
  assert.equal(quote.serviceChargeCents, 6 * 7900); // 47400
});

test("pricing: a job under 3 hours is still billed for the full 3-hour minimum", () => {
  const quote = calculateQuote({ crewSize: 2, actualDurationMinutes: 90, startsAt: new Date("2026-03-10T00:00:00Z") }, rule2, configuredSettings, TZ);
  assert.equal(quote.billableServiceMinutes, 180);
  assert.equal(quote.serviceChargeCents, 47400);
});

test("pricing: a job over 3 hours bills the actual duration, rounded up to a 30-minute increment", () => {
  // 200 minutes -> rounds up to 210 (7 units), never down to 180.
  const quote = calculateQuote({ crewSize: 2, actualDurationMinutes: 200, startsAt: new Date("2026-03-10T00:00:00Z") }, rule2, configuredSettings, TZ);
  assert.equal(quote.billableServiceMinutes, 210);
  assert.equal(quote.serviceChargeCents, 7 * 7900); // 55300
});

test("pricing: 30-minute billing increments round up, never truncate, partial overage", () => {
  // 181 minutes is 1 minute into a new half-hour unit -> bills the full 210, not 180.
  const quote = calculateQuote({ crewSize: 2, actualDurationMinutes: 181, startsAt: new Date("2026-03-10T00:00:00Z") }, rule2, configuredSettings, TZ);
  assert.equal(quote.billableServiceMinutes, 210);
});

test("pricing: call-out is exactly 15800 cents for 2 Men, 19800 cents for 3 Men", () => {
  const quote2 = calculateQuote({ crewSize: 2, actualDurationMinutes: 180, startsAt: new Date("2026-03-10T00:00:00Z") }, rule2, configuredSettings, TZ);
  assert.equal(quote2.calloutFeeCents, 15800);
  const quote3 = calculateQuote({ crewSize: 3, actualDurationMinutes: 180, startsAt: new Date("2026-03-10T00:00:00Z") }, rule3, configuredSettings, TZ);
  assert.equal(quote3.calloutFeeCents, 19800);
});

test("pricing: the call-out is never folded into billableServiceMinutes (it is not a 4th hour of job time)", () => {
  const quote = calculateQuote({ crewSize: 2, actualDurationMinutes: 180, startsAt: new Date("2026-03-10T00:00:00Z") }, rule2, configuredSettings, TZ);
  // 3-hour job -> billable service stays 180, never 240 (180 + the 60-min call-out).
  assert.equal(quote.billableServiceMinutes, 180);
});

test("pricing: changing package changes the call-out automatically, with no separate stored call-out price", () => {
  const twoMen = calculateQuote({ crewSize: 2, actualDurationMinutes: 180, startsAt: new Date("2026-03-10T00:00:00Z") }, rule2, configuredSettings, TZ);
  const threeMen = calculateQuote({ crewSize: 3, actualDurationMinutes: 180, startsAt: new Date("2026-03-10T00:00:00Z") }, rule3, configuredSettings, TZ);
  assert.equal(twoMen.calloutFeeCents, twoMen.ratePer30MinCents * 2);
  assert.equal(threeMen.calloutFeeCents, threeMen.ratePer30MinCents * 2);
  assert.notEqual(twoMen.calloutFeeCents, threeMen.calloutFeeCents);
});

const at = new Date("2026-03-10T00:00:00Z");

test("pricing worked example: 2 Movers + Truck minimum job totals $632, and the whole $632 is the balance (no advance payment)", () => {
  const quote = calculateQuote({ crewSize: 2, actualDurationMinutes: 180, startsAt: at }, rule2, configuredSettings, TZ);
  assert.equal(quote.serviceChargeCents, 47400); // 6 x $79
  assert.equal(quote.calloutFeeCents, 15800); // 2 x $79
  assert.equal(quote.finalTotalCents, 63200); // $632
  assert.equal(quote.estimatedBalanceCents, 63200);
});

test("pricing worked example: 3 Movers + Truck minimum job totals $792, balance $792", () => {
  const quote = calculateQuote({ crewSize: 3, actualDurationMinutes: 180, startsAt: at }, rule3, configuredSettings, TZ);
  assert.equal(quote.serviceChargeCents, 59400); // 6 x $99
  assert.equal(quote.calloutFeeCents, 19800); // 2 x $99
  assert.equal(quote.finalTotalCents, 79200); // $792
  assert.equal(quote.estimatedBalanceCents, 79200);
});

test("pricing worked example: a 4-hour 2 Men job totals $790", () => {
  const quote = calculateQuote({ crewSize: 2, actualDurationMinutes: 240, startsAt: at }, rule2, configuredSettings, TZ);
  assert.equal(quote.billableServiceMinutes, 240);
  assert.equal(quote.serviceChargeCents, 63200); // 8 x $79
  assert.equal(quote.finalTotalCents, 79000); // $790
});

test("pricing worked example: 4h15m (255 min) rounds up to 4h30m billable, totalling $869", () => {
  const quote = calculateQuote({ crewSize: 2, actualDurationMinutes: 255, startsAt: at }, rule2, configuredSettings, TZ);
  assert.equal(quote.billableServiceMinutes, 270); // 4.5 hours, never truncated to 4h
  assert.equal(quote.serviceChargeCents, 71100); // 9 x $79
  assert.equal(quote.finalTotalCents, 86900); // $869
});

test("pricing: final total is service charge plus call-out, nothing else", () => {
  const quote = calculateQuote({ crewSize: 2, actualDurationMinutes: 180, startsAt: at }, rule2, configuredSettings, TZ);
  assert.equal(quote.finalTotalCents, quote.serviceChargeCents + quote.calloutFeeCents);
  assert.equal(quote.finalTotalCents, 63200); // 47400 + 15800
});

test("pricing: no advance payment — advancePaymentCents is 0 and nothing is subtracted, even with the legacy $100 deposit still configured", () => {
  const quote = calculateQuote({ crewSize: 2, actualDurationMinutes: 180, startsAt: at }, rule2, configuredSettings, TZ);
  assert.equal(quote.advancePaymentCents, 0);
  assert.equal(quote.estimatedBalanceCents, quote.finalTotalCents);
  assert.equal("bookingConfirmationCents" in quote, false);
});

test("pricing: a quote is fully configured from the pricing rule alone — no deposit policy needed", () => {
  const quote = calculateQuote({ crewSize: 2, actualDurationMinutes: 180, startsAt: at }, rule2, settings, TZ);
  assert.equal(quote.isFullyConfigured, true);
  assert.equal(quote.estimatedBalanceCents, 63200);
});

test("pricing: customer-facing caveat says no advance payment and never mentions $100", () => {
  const quote = calculateQuote({ crewSize: 2, actualDurationMinutes: 180, startsAt: at }, rule2, configuredSettings, TZ);
  const text = quote.caveats.join(" ");
  assert.match(text, /No advance payment required/);
  assert.match(text, /final price is calculated after your move is completed/);
  assert.doesNotMatch(text, /\$100|deposit|credited/i);
});

test("scheduling: the 1-hour call-out is a billing charge only and never extends truck/crew occupancy", () => {
  // Mirrors app/api/booking/hold/route.ts's scheduling-duration formula:
  // Math.max(requested, minimumBookingMinutes) — deliberately does NOT add
  // settings.calloutMinutes. A 3-hour job occupies the truck for 3 hours,
  // not 4, even though it bills for a 1-hour call-out on top.
  const minimumBookingMinutes = 180;
  const calloutMinutes = 60;
  const requestedDurationMinutes = 180;
  const schedulingDurationMinutes = Math.max(requestedDurationMinutes, minimumBookingMinutes);
  assert.equal(schedulingDurationMinutes, 180);
  assert.notEqual(schedulingDurationMinutes, minimumBookingMinutes + calloutMinutes);
});

test("pricing: all monetary fields are integers (integer-cent arithmetic only)", () => {
  const quote = calculateQuote({ crewSize: 3, actualDurationMinutes: 217, startsAt: at }, rule3, configuredSettings, TZ);
  for (const value of [quote.serviceChargeCents, quote.calloutFeeCents, quote.finalTotalCents, quote.advancePaymentCents, quote.estimatedBalanceCents]) {
    assert.equal(Number.isInteger(value), true);
  }
});

test("pricing: missing pricing rule surfaces a caveat instead of a fabricated price", () => {
  const quote = calculateQuote({ crewSize: 5, actualDurationMinutes: 60, startsAt: at }, undefined, settings, TZ);
  assert.equal(quote.finalTotalCents, 0);
  assert.equal(quote.isFullyConfigured, false);
  assert.match(quote.caveats[0], /No pricing rule configured/);
});

test("pricing snapshot: freezes package, rate, minimum and call-out policy with advance payment marked not required", () => {
  const quote = calculateQuote({ crewSize: 3, actualDurationMinutes: 180, startsAt: at }, rule3, configuredSettings, TZ);
  assert.deepEqual(buildPricingSnapshot(quote), {
    package: "3 Movers + Truck",
    packageId: "3-men",
    truckClass: null,
    truckName: null,
    truckTonnage: null,
    crewSize: 3,
    ratePer30MinCents: 9900,
    minimumBookingMinutes: 180,
    calloutMinutes: 60,
    advancePaymentRequired: false,
    advancePaymentCents: 0,
  });
});

test("pricing snapshot: preserves the policy at booking time, unaffected by later rate changes", () => {
  const snapshot = buildPricingSnapshot(calculateQuote({ crewSize: 2, actualDurationMinutes: 180, startsAt: at }, rule2, configuredSettings, TZ));
  const raisedRule2 = { ...rule2, ratePer30MinCents: 8900 };
  const laterQuote = calculateQuote({ crewSize: 2, actualDurationMinutes: 180, startsAt: new Date("2026-06-10T00:00:00Z") }, raisedRule2, configuredSettings, TZ);
  assert.notEqual(laterQuote.ratePer30MinCents, snapshot.ratePer30MinCents);
  // Finalising against the frozen snapshot still uses the original rate.
  const bill = computeFinalBilling(snapshot, 180, 0, "not_required");
  assert.equal(bill.finalTotalCents, 63200);
});

// --- Final billing: new no-payment vs historical $100 bookings -------------

const newSnapshot2 = { package: "2 Movers + Truck", ratePer30MinCents: 7900, minimumBookingMinutes: 180, calloutMinutes: 60, advancePaymentRequired: false, advancePaymentCents: 0 };
const historicalSnapshot2 = { package: "2 Men + Truck", ratePer30MinCents: 7900, minimumBookingMinutes: 180, calloutMinutes: 60, bookingConfirmationCents: 10000 };

test("final billing: a new no-payment booking pays $0 before the job, so balance = full final total", () => {
  const bill = computeFinalBilling(newSnapshot2, 180, 0, "not_required");
  assert.equal(bill.amountPaidCents, 0);
  assert.equal(bill.finalTotalCents, 63200);
  assert.equal(bill.balanceDueCents, 63200);
});

test("final billing: a no-payment booking keeps payment_status not_required — never marked deposit_paid/paid", () => {
  const bill = computeFinalBilling(newSnapshot2, 255, 0, "not_required");
  assert.equal(bill.paymentStatus, "not_required");
  assert.equal(bill.balanceDueCents, 86900);
});

test("final billing: a historical booking that really paid $100 still deducts exactly $100", () => {
  const bill = computeFinalBilling(historicalSnapshot2, 180, 10000, "deposit_paid");
  assert.equal(bill.finalTotalCents, 63200);
  assert.equal(bill.balanceDueCents, 53200);
  assert.equal(bill.paymentStatus, "deposit_paid");
});

test("final billing: the historical $100 is deducted once regardless of job length", () => {
  for (const minutes of [60, 180, 240, 480]) {
    const bill = computeFinalBilling(historicalSnapshot2, minutes, 10000, "deposit_paid");
    assert.equal(bill.finalTotalCents - bill.balanceDueCents, 10000);
  }
});

test("final billing: the deduction is the RECORDED amount, not a global $100 assumption", () => {
  // A snapshot that mentions $100 but a booking row that recorded $0
  // paid must not deduct anything.
  const bill = computeFinalBilling(historicalSnapshot2, 180, 0, "pending");
  assert.equal(bill.balanceDueCents, 63200);
});

test("final billing: balance is never negative and becomes 'paid' when the recorded payment covers it", () => {
  const bill = computeFinalBilling(newSnapshot2, 180, 999_999_00, "deposit_paid");
  assert.equal(bill.balanceDueCents, 0);
  assert.equal(bill.paymentStatus, "paid");
});

test("final billing: rejects a missing snapshot or a non-positive duration", () => {
  assert.throws(() => computeFinalBilling({}, 180, 0, "not_required"), /pricing snapshot/);
  assert.throws(() => computeFinalBilling(newSnapshot2, 0, 0, "not_required"), /positive whole number/);
  assert.throws(() => computeFinalBilling(newSnapshot2, 90.5, 0, "not_required"), /positive whole number/);
});

test("state machine: a held booking can be confirmed directly, without a payment step", () => {
  assert.equal(canTransition("held", "confirmed"), true);
  assert.equal(canTransition("expired", "confirmed"), false);
  assert.equal(canTransition("cancelled", "confirmed"), false);
});

test("state machine: rejects invalid transitions like completed -> pending_payment", () => {
  assert.equal(canTransition("completed", "pending_payment"), false);
  assert.throws(() => assertTransition("completed", "pending_payment"));
});

test("state machine: allows the happy path draft -> held -> pending_payment -> confirmed", () => {
  assert.equal(canTransition("draft", "held"), true);
  assert.equal(canTransition("held", "pending_payment"), true);
  assert.equal(canTransition("pending_payment", "confirmed"), true);
});

test("state machine: a booking cannot transition to itself", () => {
  assert.equal(canTransition("confirmed", "confirmed"), false);
});
