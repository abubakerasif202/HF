import type { BusinessSettings, FinalBilling, PaymentStatus, PricingRule, PricingSnapshot, QuoteInput, QuoteResult } from "./types.ts";
import { instantToZonedParts } from "./timezone.ts";
import { findMovingPackage } from "../site-data.ts";

/** Confirmed HF Removals Adelaide package names, derived from crew size via the
 * canonical package table in lib/site-data.ts — never duplicated as strings here
 * or in the database. */
export function packageNameForCrewSize(crewSize: number): string {
  return findMovingPackage({ crewSize })?.bookingName ?? `${crewSize} Men + Truck`;
}

/** Customer-facing pricing policy line, shown alongside every quote. */
export const PRICING_POLICY_NOTE =
  "No advance payment required. 3-hour minimum service + 1-hour call-out fee. The call-out covers truck fuel and basic transport charges. Additional service time is billed in 30-minute increments at your selected package rate. Your final price is calculated after your move is completed.";

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
 *   - finalTotal = serviceCharge + calloutFee.
 *   - No advance payment: nothing is collected before the move, so the
 *     balance is the whole total. The legacy deposit settings are
 *     deliberately never read here.
 *
 * All money math is integer cents throughout; no floating-point.
 */
export function calculateQuote(
  input: QuoteInput,
  rule: PricingRule | undefined,
  settings: BusinessSettings,
  timeZone: string,
): QuoteResult {
  const caveats: string[] = [PRICING_POLICY_NOTE];

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
      advancePaymentCents: 0,
      estimatedBalanceCents: 0,
      currency: "aud",
      isFullyConfigured: false,
      caveats: [`No pricing rule configured for a crew of ${input.crewSize}.`, ...caveats],
    };
  }

  // Integer-cent, 30-minute-unit arithmetic throughout — no floating point.
  const billableServiceMinutes = billableMinutes(input.actualDurationMinutes, settings.minimumBookingMinutes);
  const serviceChargeCentsBase = (billableServiceMinutes / 30) * rule.ratePer30MinCents;
  const calloutFeeCentsBase = (settings.calloutMinutes / 30) * rule.ratePer30MinCents;

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
    advancePaymentCents: 0,
    estimatedBalanceCents: finalTotalCents,
    currency: "aud",
    isFullyConfigured: true,
    caveats,
  };
}

/** max(actual rounded UP to a 30-minute unit, minimum). */
function billableMinutes(actualDurationMinutes: number, minimumBookingMinutes: number): number {
  return Math.max(Math.ceil(actualDurationMinutes / 30) * 30, minimumBookingMinutes);
}

/**
 * The policy frozen onto a booking when it is confirmed. Finalisation
 * reads only this snapshot, never live pricing_rules, so a later rate
 * change can't rewrite a booking's price.
 */
export function buildPricingSnapshot(quote: QuoteResult): PricingSnapshot {
  return {
    package: quote.packageName,
    ratePer30MinCents: quote.ratePer30MinCents,
    minimumBookingMinutes: quote.minimumBookingMinutes,
    calloutMinutes: quote.calloutMinutes,
    advancePaymentRequired: false,
    advancePaymentCents: 0,
  };
}

/**
 * Final job billing from the staff-entered ACTUAL duration, against the
 * booking's frozen pricing snapshot.
 *
 * `amountPaidCents` must be the money genuinely recorded against the
 * booking (bookings.deposit_paid_cents): 10000 for a historical booking
 * that paid the old $100 confirmation, 0 for every no-payment booking.
 * It is deducted exactly once — nothing here assumes a global "$100 was
 * paid" rule.
 */
export function computeFinalBilling(
  snapshot: PricingSnapshot,
  actualDurationMinutes: number,
  amountPaidCents: number,
  currentPaymentStatus: PaymentStatus,
): FinalBilling {
  if (!Number.isInteger(actualDurationMinutes) || actualDurationMinutes <= 0) {
    throw new Error("Actual duration must be a positive whole number of minutes.");
  }
  const ratePer30MinCents = snapshot.ratePer30MinCents;
  if (!ratePer30MinCents) {
    throw new Error("This booking has no pricing snapshot to finalise against.");
  }
  const minimumBookingMinutes = snapshot.minimumBookingMinutes ?? 180;
  const calloutMinutes = snapshot.calloutMinutes ?? 60;
  const paid = Math.max(amountPaidCents, 0);

  const billableDurationMinutes = billableMinutes(actualDurationMinutes, minimumBookingMinutes);
  const serviceChargeCents = (billableDurationMinutes / 30) * ratePer30MinCents;
  const calloutFeeCents = (calloutMinutes / 30) * ratePer30MinCents;
  const finalTotalCents = serviceChargeCents + calloutFeeCents;
  const balanceDueCents = Math.max(finalTotalCents - paid, 0);

  // Never claim money was received when it wasn't: a booking that paid
  // nothing up-front keeps its existing status (normally not_required).
  const paymentStatus: PaymentStatus = paid > 0 ? (balanceDueCents > 0 ? "deposit_paid" : "paid") : currentPaymentStatus;

  return { billableDurationMinutes, serviceChargeCents, calloutFeeCents, finalTotalCents, amountPaidCents: paid, balanceDueCents, paymentStatus };
}
