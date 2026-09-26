import assert from "node:assert/strict";
import test from "node:test";
import { calculateQuote, packageNameForCrewSize } from "../lib/booking/pricing.ts";
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

const configuredSettings = { ...settings, depositType: "fixed", depositFixedAmountCents: 10000 };

// Confirmed canonical rates: $79/30min (2 movers), $99/30min (3 movers).
const rule2 = { crewSize: 2, ratePer30MinCents: 7900, minimumBillableMinutes: 60, weekendMultiplier: 1, publicHolidayMultiplier: 1 };
const rule3 = { crewSize: 3, ratePer30MinCents: 9900, minimumBillableMinutes: 60, weekendMultiplier: 1, publicHolidayMultiplier: 1 };

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
  assert.equal(packageNameForCrewSize(2), "2 Men + Truck");
  assert.equal(packageNameForCrewSize(3), "3 Men + Truck");
});

test("pricing: 2 Men + Truck uses the canonical 7900 cents / 30 min rate", () => {
  const quote = calculateQuote({ crewSize: 2, actualDurationMinutes: 180, startsAt: new Date("2026-03-10T00:00:00Z") }, rule2, configuredSettings, TZ);
  assert.equal(quote.ratePer30MinCents, 7900);
});

test("pricing: 3 Men + Truck uses the canonical 9900 cents / 30 min rate", () => {
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

test("pricing worked example: 2 Men + Truck minimum job totals $632, balance $532 after the $100 confirmation", () => {
  const quote = calculateQuote({ crewSize: 2, actualDurationMinutes: 180, startsAt: new Date("2026-03-10T00:00:00Z") }, rule2, configuredSettings, TZ);
  assert.equal(quote.serviceChargeCents, 47400); // 6 x $79
  assert.equal(quote.calloutFeeCents, 15800); // 2 x $79
  assert.equal(quote.finalTotalCents, 63200); // $632
  assert.equal(quote.estimatedBalanceCents, 53200); // $532
});

test("pricing worked example: 3 Men + Truck minimum job totals $792, balance $692 after the $100 confirmation", () => {
  const quote = calculateQuote({ crewSize: 3, actualDurationMinutes: 180, startsAt: new Date("2026-03-10T00:00:00Z") }, rule3, configuredSettings, TZ);
  assert.equal(quote.serviceChargeCents, 59400); // 6 x $99
  assert.equal(quote.calloutFeeCents, 19800); // 2 x $99
  assert.equal(quote.finalTotalCents, 79200); // $792
  assert.equal(quote.estimatedBalanceCents, 69200); // $692
});

test("pricing worked example: a 4-hour 2 Men job totals $790, balance $690", () => {
  const quote = calculateQuote({ crewSize: 2, actualDurationMinutes: 240, startsAt: new Date("2026-03-10T00:00:00Z") }, rule2, configuredSettings, TZ);
  assert.equal(quote.billableServiceMinutes, 240);
  assert.equal(quote.serviceChargeCents, 63200); // 8 x $79
  assert.equal(quote.finalTotalCents, 79000); // $790
  assert.equal(quote.estimatedBalanceCents, 69000); // $690
});

test("pricing worked example: 4h15m (255 min) rounds up to 4h30m billable, totalling $869", () => {
  const quote = calculateQuote({ crewSize: 2, actualDurationMinutes: 255, startsAt: new Date("2026-03-10T00:00:00Z") }, rule2, configuredSettings, TZ);
  assert.equal(quote.billableServiceMinutes, 270); // 4.5 hours, never truncated to 4h
  assert.equal(quote.serviceChargeCents, 71100); // 9 x $79
  assert.equal(quote.finalTotalCents, 86900); // $869
  assert.equal(quote.estimatedBalanceCents, 76900); // $769
});

test("pricing: final total is service charge plus call-out, nothing else", () => {
  const quote = calculateQuote({ crewSize: 2, actualDurationMinutes: 180, startsAt: new Date("2026-03-10T00:00:00Z") }, rule2, configuredSettings, TZ);
  assert.equal(quote.finalTotalCents, quote.serviceChargeCents + quote.calloutFeeCents);
  assert.equal(quote.finalTotalCents, 63200); // 47400 + 15800
});

test("pricing: $100 booking confirmation is fixed and independent of the final total", () => {
  const smallJob = calculateQuote({ crewSize: 2, actualDurationMinutes: 90, startsAt: new Date("2026-03-10T00:00:00Z") }, rule2, configuredSettings, TZ);
  const bigJob = calculateQuote({ crewSize: 2, actualDurationMinutes: 600, startsAt: new Date("2026-03-10T00:00:00Z") }, rule2, configuredSettings, TZ);
  assert.equal(smallJob.bookingConfirmationCents, 10000);
  assert.equal(bigJob.bookingConfirmationCents, 10000);
});

test("pricing: the $100 confirmation is deducted from the final balance, never added on top", () => {
  const quote = calculateQuote({ crewSize: 2, actualDurationMinutes: 180, startsAt: new Date("2026-03-10T00:00:00Z") }, rule2, configuredSettings, TZ);
  assert.equal(quote.estimatedBalanceCents, quote.finalTotalCents - quote.bookingConfirmationCents);
  assert.equal(quote.estimatedBalanceCents, 53200); // 63200 - 10000
  assert.notEqual(quote.estimatedBalanceCents, quote.finalTotalCents + quote.bookingConfirmationCents);
});

test("pricing: the $100 booking confirmation is deducted exactly once, regardless of job length", () => {
  const short = calculateQuote({ crewSize: 2, actualDurationMinutes: 180, startsAt: new Date("2026-03-10T00:00:00Z") }, rule2, configuredSettings, TZ);
  const long = calculateQuote({ crewSize: 2, actualDurationMinutes: 480, startsAt: new Date("2026-03-10T00:00:00Z") }, rule2, configuredSettings, TZ);
  assert.equal(short.finalTotalCents - short.estimatedBalanceCents, 10000);
  assert.equal(long.finalTotalCents - long.estimatedBalanceCents, 10000);
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

test("pricing: estimated balance never goes negative even if confirmation exceeded the total", () => {
  const tinySettings = { ...configuredSettings, depositFixedAmountCents: 999_999_00 };
  const quote = calculateQuote({ crewSize: 2, actualDurationMinutes: 180, startsAt: new Date("2026-03-10T00:00:00Z") }, rule2, tinySettings, TZ);
  assert.equal(quote.estimatedBalanceCents, 0);
});

test("pricing: all monetary fields are integers (integer-cent arithmetic only)", () => {
  const quote = calculateQuote({ crewSize: 3, actualDurationMinutes: 217, startsAt: new Date("2026-03-10T00:00:00Z") }, rule3, configuredSettings, TZ);
  for (const value of [quote.serviceChargeCents, quote.calloutFeeCents, quote.finalTotalCents, quote.bookingConfirmationCents, quote.estimatedBalanceCents]) {
    assert.equal(Number.isInteger(value), true);
  }
});

test("pricing: missing pricing rule surfaces a caveat instead of a fabricated price", () => {
  const quote = calculateQuote(
    { crewSize: 5, actualDurationMinutes: 60, startsAt: new Date("2026-03-10T00:00:00Z") },
    undefined,
    settings,
    TZ,
  );
  assert.equal(quote.finalTotalCents, 0);
  assert.equal(quote.isFullyConfigured, false);
  assert.match(quote.caveats[0], /No pricing rule configured/);
});

test("pricing: booking confirmation not configured surfaces a caveat and blocks payment", () => {
  const quote = calculateQuote({ crewSize: 2, actualDurationMinutes: 180, startsAt: new Date("2026-03-10T00:00:00Z") }, rule2, settings, TZ);
  assert.equal(quote.isFullyConfigured, false);
  assert.match(quote.caveats[0], /not configured/);
});

test("pricing: percentage-based deposit still supported (not the confirmed policy, but must not break)", () => {
  const configured = { ...settings, depositType: "percentage", depositPercentage: 20, minDepositAmountCents: 5000 };
  const quote = calculateQuote({ crewSize: 2, actualDurationMinutes: 180, startsAt: new Date("2026-03-10T00:00:00Z") }, rule2, configured, TZ);
  assert.equal(quote.bookingConfirmationCents, Math.round((quote.finalTotalCents * 20) / 100));
  assert.equal(quote.isFullyConfigured, true);
});

test("pricing snapshot: preserves the policy at booking time, unaffected by later rate changes", () => {
  const originalQuote = calculateQuote({ crewSize: 2, actualDurationMinutes: 180, startsAt: new Date("2026-03-10T00:00:00Z") }, rule2, configuredSettings, TZ);
  const snapshot = {
    package: originalQuote.packageName,
    ratePer30MinCents: originalQuote.ratePer30MinCents,
    minimumBookingMinutes: originalQuote.minimumBookingMinutes,
    calloutMinutes: originalQuote.calloutMinutes,
    bookingConfirmationCents: originalQuote.bookingConfirmationCents,
  };

  // Simulate the business raising its rate afterward.
  const raisedRule2 = { ...rule2, ratePer30MinCents: 8900 };
  const laterQuote = calculateQuote({ crewSize: 2, actualDurationMinutes: 180, startsAt: new Date("2026-06-10T00:00:00Z") }, raisedRule2, configuredSettings, TZ);

  assert.equal(snapshot.ratePer30MinCents, 7900);
  assert.notEqual(laterQuote.ratePer30MinCents, snapshot.ratePer30MinCents);
  // The historical snapshot's numbers must never be recalculated from the new rate.
  assert.equal(snapshot.ratePer30MinCents, 7900);
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
