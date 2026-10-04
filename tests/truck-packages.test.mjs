import assert from "node:assert/strict";
import test from "node:test";
import { buildPricingSnapshot, calculateQuote, computeFinalBilling, describePackage } from "../lib/booking/pricing.ts";
import { resolveRequestedPackage } from "../lib/booking/package-request.ts";
import { crewUpgradePackages, findMovingPackage, isBookablePackageId, legacyPackages, movingPackages, truckPackages, truckPricing } from "../lib/site-data.ts";

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
  minimumBookingMinutes: 180,
  calloutMinutes: 60,
  depositType: null,
  depositFixedAmountCents: null,
  depositPercentage: null,
  minDepositAmountCents: null,
};

const weekday = new Date("2026-03-10T01:00:00Z"); // Tuesday 11:30 Adelaide
const saturday = new Date("2026-03-14T01:00:00Z"); // Saturday 11:30 Adelaide

const ruleFor = (pkg, extra = {}) => ({
  packageId: pkg.id,
  crewSize: pkg.crewSize,
  ratePer30MinCents: pkg.ratePer30MinCents,
  minimumBillableMinutes: 60,
  weekendMultiplier: 1,
  publicHolidayMultiplier: 1,
  ...extra,
});

const byId = Object.fromEntries(truckPackages.map((item) => [item.id, item]));
const HR = byId["hr-16t-2men"];
const MR = byId["mr-12t-2men"];
const SMALL = byId["small-8t-2men"];

const quoteFor = (pkg, minutes = 180, startsAt = weekday, extra = {}) =>
  calculateQuote({ packageId: pkg.id, crewSize: pkg.crewSize, actualDurationMinutes: minutes, startsAt }, ruleFor(pkg, extra), settings, TZ);

test("package ids are unique even though every truck has crewSize 2", () => {
  const ids = [...movingPackages, ...legacyPackages].map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(truckPackages.map((item) => item.crewSize), [2, 2, 2]);
  assert.equal(new Set(truckPackages.map((item) => item.id)).size, 3);
});

test("truck rates are HR 7900, MR 7400, Small 6900 cents per 30 minutes", () => {
  assert.equal(HR.ratePer30MinCents, 7900);
  assert.equal(MR.ratePer30MinCents, 7400);
  assert.equal(SMALL.ratePer30MinCents, 6900);
  assert.equal(quoteFor(HR).ratePer30MinCents, 7900);
  assert.equal(quoteFor(MR).ratePer30MinCents, 7400);
  assert.equal(quoteFor(SMALL).ratePer30MinCents, 6900);
});

test("minimum job: 6 x rate service + 2 x rate call-out per truck", () => {
  assert.equal(quoteFor(HR).finalTotalCents, 63200);
  assert.equal(quoteFor(MR).finalTotalCents, 59200);
  assert.equal(quoteFor(SMALL).finalTotalCents, 55200);
  const quote = quoteFor(HR, 60);
  assert.equal(quote.billableServiceMinutes, 180);
  assert.equal(quote.serviceChargeCents, 6 * 7900);
  assert.equal(quote.calloutFeeCents, 2 * 7900);
});

test("a 4 hour job bills 8 units of service plus the 2-unit call-out", () => {
  assert.equal(quoteFor(HR, 240).finalTotalCents, 10 * 7900);
  assert.equal(quoteFor(MR, 240).finalTotalCents, 10 * 7400);
  assert.equal(quoteFor(SMALL, 240).finalTotalCents, 10 * 6900);
});

test("weekend multiplier still applies per package rule", () => {
  const quote = quoteFor(SMALL, 180, saturday, { weekendMultiplier: 1.5 });
  assert.equal(quote.multiplier, 1.5);
  assert.equal(quote.finalTotalCents, Math.round(55200 * 1.5));
  assert.equal(quoteFor(SMALL, 180, weekday, { weekendMultiplier: 1.5 }).multiplier, 1);
});

test("same crewSize with a different packageId yields a different total", () => {
  const totals = new Set([HR, MR, SMALL].map((pkg) => quoteFor(pkg).finalTotalCents));
  assert.equal(totals.size, 3);
  // Same crewSize, packageId picks the rule's rate; identity follows the id, not the crew size.
  const asHr = calculateQuote({ packageId: HR.id, crewSize: 2, actualDurationMinutes: 180, startsAt: weekday }, ruleFor(HR), settings, TZ);
  const asSmall = calculateQuote({ packageId: SMALL.id, crewSize: 2, actualDurationMinutes: 180, startsAt: weekday }, ruleFor(SMALL), settings, TZ);
  assert.notEqual(asHr.finalTotalCents, asSmall.finalTotalCents);
  assert.notEqual(asHr.packageId, asSmall.packageId);
});

test("quote carries package identity: packageId, truckClass, truckName, truckCapacity, crewSize", () => {
  const hr = quoteFor(HR);
  assert.equal(hr.packageId, "hr-16t-2men");
  assert.equal(hr.truckClass, "HR");
  assert.equal(hr.truckName, "HR Truck");
  assert.equal(hr.truckCapacity, "16 Ton");
  assert.equal(hr.crewSize, 2);
  const mr = quoteFor(MR);
  assert.deepEqual([mr.truckClass, mr.truckName, mr.truckCapacity], ["MR", "MR Truck", "12 Ton"]);
  const small = quoteFor(SMALL);
  assert.deepEqual([small.truckClass, small.truckName, small.truckCapacity], ["Small", "Small Truck", "8 Ton"]);
});

test("3-men crew upgrade quotes with no truck class", () => {
  const crew = crewUpgradePackages[0];
  const quote = quoteFor(crew);
  assert.equal(quote.packageId, "3-men");
  assert.equal(quote.truckClass, null);
  assert.equal(quote.truckName, null);
  assert.equal(quote.truckCapacity, null);
  assert.equal(quote.crewSize, 3);
  assert.equal(quote.finalTotalCents, 8 * 9900);
});

test("buildPricingSnapshot freezes the package identity", () => {
  const snapshot = buildPricingSnapshot(quoteFor(MR));
  assert.deepEqual(snapshot, {
    package: "MR Truck",
    packageId: "mr-12t-2men",
    truckClass: "MR",
    truckName: "MR Truck",
    truckTonnage: 12,
    crewSize: 2,
    ratePer30MinCents: 7400,
    minimumBookingMinutes: 180,
    calloutMinutes: 60,
    advancePaymentRequired: false,
    advancePaymentCents: 0,
  });
});

test("a later rate change does not alter final billing for an old snapshot", () => {
  const snapshot = buildPricingSnapshot(quoteFor(HR));
  const later = quoteFor(HR, 180, weekday, { ratePer30MinCents: 9900 });
  assert.notEqual(later.ratePer30MinCents, snapshot.ratePer30MinCents);
  const bill = computeFinalBilling(snapshot, 180, 0, "not_required");
  assert.equal(bill.finalTotalCents, 63200);
  assert.equal(bill.balanceDueCents, 63200);
  assert.equal(bill.paymentStatus, "not_required");
});

test("each truck snapshot finalises against its own frozen rate and overrun time", () => {
  for (const [pkg, expected] of [[HR, 10 * 7900], [MR, 10 * 7400], [SMALL, 10 * 6900]]) {
    const bill = computeFinalBilling(buildPricingSnapshot(quoteFor(pkg)), 240, 0, "not_required");
    assert.equal(bill.finalTotalCents, expected);
  }
});

test("a historical snapshot with only package name and rate still finalises", () => {
  const historical = { package: "2 Movers + Truck", ratePer30MinCents: 7900 };
  const bill = computeFinalBilling(historical, 180, 0, "not_required");
  assert.equal(bill.finalTotalCents, 63200);
  assert.equal(bill.calloutFeeCents, 2 * 7900);
  assert.equal(bill.billableDurationMinutes, 180);
});

test("a historical booking with no packageId resolves via crewSize to the legacy 2-men package", () => {
  const info = describePackage({ crewSize: 2 });
  assert.equal(info.packageName, "2 Movers + Truck");
  assert.equal(info.packageId, "2-men");
  assert.equal(info.truckClass, null);
  assert.equal(info.truckCapacity, null);
  assert.equal(describePackage({ crewSize: 3 }).packageId, "3-men");
  assert.equal(describePackage({ packageId: HR.id, crewSize: 2 }).truckCapacity, "16 Ton");
  // A legacy quote (no packageId) still prices from the supplied rule.
  const quote = calculateQuote({ crewSize: 2, actualDurationMinutes: 180, startsAt: weekday }, ruleFor(legacyPackages[0]), settings, TZ);
  assert.equal(quote.packageId, "2-men");
  assert.equal(quote.finalTotalCents, 63200);
});

test("resolveRequestedPackage accepts a valid truck id and derives crew size and class from the table", () => {
  const resolved = resolveRequestedPackage({ packageId: SMALL.id });
  assert.deepEqual(resolved, { ok: true, packageId: SMALL.id, crewSize: 2, truckClass: "Small", name: "Small Truck" });
  assert.equal(resolveRequestedPackage({ packageId: HR.id, crewSize: 2 }).ok, true);
});

test("resolveRequestedPackage rejects unknown and non-bookable ids", () => {
  assert.equal(resolveRequestedPackage({ packageId: "xl-20t-2men" }).ok, false);
  assert.equal(isBookablePackageId("2-men"), false);
  assert.equal(resolveRequestedPackage({ packageId: "2-men" }).ok, false);
  assert.equal(resolveRequestedPackage({ packageId: "2-men", crewSize: 2 }).ok, false);
  assert.equal(findMovingPackage({ id: "2-men" })?.id, "2-men");
});

test("resolveRequestedPackage handles crewSize-only requests from older clients", () => {
  const three = resolveRequestedPackage({ crewSize: 3 });
  assert.equal(three.ok, true);
  assert.equal(three.packageId, "3-men");
  const two = resolveRequestedPackage({ crewSize: 2 });
  assert.equal(two.ok, true);
  assert.equal(two.packageId, "2-men");
  assert.equal(resolveRequestedPackage({ crewSize: 7 }).ok, false);
});

test("resolveRequestedPackage rejects a crewSize that mismatches the package and missing input", () => {
  const mismatch = resolveRequestedPackage({ packageId: HR.id, crewSize: 3 });
  assert.equal(mismatch.ok, false);
  assert.match(mismatch.message, /crew size/i);
  assert.equal(resolveRequestedPackage({ packageId: "3-men", crewSize: 2 }).ok, false);
  assert.equal(resolveRequestedPackage({}).ok, false);
  assert.equal(resolveRequestedPackage({ packageId: null, crewSize: null }).ok, false);
});

test("truckPricing display rows derive half-hour and hourly figures from the rates", () => {
  const rows = Object.fromEntries(truckPricing.map((row) => [row.id, row]));
  assert.equal(truckPricing.length, 3);
  assert.deepEqual([rows[HR.id].halfHour, rows[HR.id].hourly], ["$79", "$158"]);
  assert.deepEqual([rows[MR.id].halfHour, rows[MR.id].hourly], ["$74", "$148"]);
  assert.deepEqual([rows[SMALL.id].halfHour, rows[SMALL.id].hourly], ["$69", "$138"]);
});
