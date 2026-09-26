import type { BusinessSettings, PricingRule, QuoteInput, QuoteResult } from "./types.ts";
import { instantToZonedParts } from "./timezone.ts";

/** Confirmed HF Removals Adelaide package names, derived from crew size —
 * the single canonical source (crewSize -> rate) never duplicates a name
 * string in the database. */
export function packageNameForCrewSize(crewSize: number): string {
  if (crewSize === 2) return "2 Men + Truck";
  if (crewSize === 3) return "3 Men + Truck";
  return `${crewSize} Men + Truck`;
}

/**
 * Server-authoritative price calculation for the confirmed HF Removals
 * Adelaide booking policy:
 *
 *   - Canonical rate: $79/30min (2 movers) or $99/30min (3 movers), i.e.
 *     7900 / 9900 cents — the ONLY rate figures stored; every other
 *     display (hourly, minimum, call-out) is derived from this.
 *   - Every job is billed for a 180-minute (3-hour) minimum, regardless
 *     of actual duration.
 *   - A 1-hour call-out (truck fuel + basic transport) is added to every
 *     job, billed at the SAME per-30-minute rate as the job — not a
 *     separate flat fee, so it never drifts from the canonical rate.
 *   - finalTotal = serviceCharge + calloutFee. The $100 booking
 *     confirmation is a fixed amount, always credited toward this total,
 *     never added on top.
 *
 * All money math is integer cents throughout; no floating-point.
 */
export function calculateQuote(
  input: QuoteInput,
  rule: PricingRule | undefined,
  settings: BusinessSettings,
  timeZone: string,
): QuoteResult {
  const caveats: string[] = [
    "3-hour minimum service + 1-hour call-out fee. The call-out covers truck fuel and basic transport charges. Additional service time is billed in 30-minute increments at your selected package rate. Your final price is calculated when the job is completed. The $100 booking confirmation payment is credited toward your final balance.",
  ];

  if (!rule) {
    return {
      packageName: packageNameForCrewSize(input.crewSize),
      ratePer30MinCents: 0,
      minimumBookingMinutes: settings.minimumBookingMinutes,
      calloutMinutes: settings.calloutMinutes,
      billableServiceMinutes: 0,
      serviceChargeCents: 0,
      calloutFeeCents: 0,
      finalTotalCents: 0,
      multiplier: 1,
      bookingConfirmationCents: 0,
      estimatedBalanceCents: 0,
      currency: "aud",
      isFullyConfigured: false,
      caveats: [`No pricing rule configured for a crew of ${input.crewSize}.`, ...caveats],
    };
  }

  // Integer-cent, 30-minute-unit arithmetic throughout — no floating point.
  const billableServiceMinutes = Math.max(
    Math.ceil(input.actualDurationMinutes / 30) * 30,
    settings.minimumBookingMinutes,
  );
  const serviceUnits = billableServiceMinutes / 30;
  const serviceChargeCentsBase = serviceUnits * rule.ratePer30MinCents;

  const calloutUnits = settings.calloutMinutes / 30;
  const calloutFeeCentsBase = calloutUnits * rule.ratePer30MinCents;

  const { weekday } = instantToZonedParts(input.startsAt, timeZone);
  const isWeekend = weekday === 0 || weekday === 6;
  const isPublicHoliday = input.isPublicHoliday ?? false;

  let multiplier = 1;
  if (isPublicHoliday && rule.publicHolidayMultiplier !== 1) {
    multiplier = rule.publicHolidayMultiplier;
  } else if (isWeekend && rule.weekendMultiplier !== 1) {
    multiplier = rule.weekendMultiplier;
  }

  const serviceChargeCents = Math.round(serviceChargeCentsBase * multiplier);
  const calloutFeeCents = Math.round(calloutFeeCentsBase * multiplier);
  const finalTotalCents = serviceChargeCents + calloutFeeCents;

  let bookingConfirmationCents = 0;
  let isFullyConfigured = true;

  if (settings.depositType === "fixed" && settings.depositFixedAmountCents) {
    bookingConfirmationCents = settings.depositFixedAmountCents;
  } else if (settings.depositType === "percentage" && settings.depositPercentage) {
    bookingConfirmationCents = Math.round((finalTotalCents * settings.depositPercentage) / 100);
  } else {
    isFullyConfigured = false;
    caveats.unshift("Booking confirmation payment is not configured yet — this booking cannot take a payment until an admin sets it.");
  }

  if (settings.minDepositAmountCents && bookingConfirmationCents < settings.minDepositAmountCents) {
    bookingConfirmationCents = settings.minDepositAmountCents;
  }

  return {
    packageName: packageNameForCrewSize(input.crewSize),
    ratePer30MinCents: rule.ratePer30MinCents,
    minimumBookingMinutes: settings.minimumBookingMinutes,
    calloutMinutes: settings.calloutMinutes,
    billableServiceMinutes,
    serviceChargeCents,
    calloutFeeCents,
    finalTotalCents,
    multiplier,
    bookingConfirmationCents,
    // Deliberately never negative: floor(0), never finalTotal + confirmation.
    estimatedBalanceCents: Math.max(finalTotalCents - bookingConfirmationCents, 0),
    currency: "aud",
    isFullyConfigured,
    caveats,
  };
}
