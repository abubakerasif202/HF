// Pure domain types for the booking system. No Next.js or Supabase imports
// here on purpose — this module (and its siblings in lib/booking/) must be
// unit-testable with plain `node --test` and reusable from API routes,
// server actions and cron handlers alike.

export type BookingStatus =
  | "draft"
  | "held"
  | "pending_payment"
  | "confirmed"
  | "assigned"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "expired";

/** `not_required` = no advance payment was required or collected (every
 * booking made after the advance payment was retired). `deposit_paid` /
 * `paid` only ever describe money that was genuinely received. */
export type PaymentStatus = "pending" | "not_required" | "deposit_paid" | "paid" | "failed" | "refunded" | "partially_refunded";

export interface PricingRule {
  crewSize: number;
  ratePer30MinCents: number;
  /** Deprecated in favour of BusinessSettings.minimumBookingMinutes, which
   * is the single confirmed business-wide 3-hour minimum. Kept only so
   * existing DB rows / historical pricing_snapshot reads don't break. */
  minimumBillableMinutes: number;
  weekendMultiplier: number;
  publicHolidayMultiplier: number;
}

export interface BusinessSettings {
  timezone: string;
  businessOpenTime: string; // "HH:MM"
  businessCloseTime: string; // "HH:MM"
  bookingHoldMinutes: number;
  minBookingLeadHours: number;
  maxBookingHorizonDays: number;
  defaultEstimatedDurationMinutes: number;
  schedulingBufferMinutes: number;
  /** Confirmed business rule: every job is billed for at least this long
   * (180 minutes / 3 hours), regardless of how long it actually took. */
  minimumBookingMinutes: number;
  /** Confirmed business rule: a flat 1-hour call-out is added to every
   * job's price (truck fuel + basic transport), billed at the same
   * per-30-minute rate as the job itself — never a separate flat fee. */
  calloutMinutes: number;
  /** Legacy deposit configuration. No longer read when pricing new
   * bookings — no advance payment is required. Kept only so historical
   * settings rows still map cleanly. */
  depositType: "fixed" | "percentage" | null;
  depositFixedAmountCents: number | null;
  depositPercentage: number | null;
  minDepositAmountCents: number | null;
}

export interface QuoteInput {
  crewSize: number;
  /** The actual/estimated job duration BEFORE the 3-hour minimum is
   * applied. Never includes the call-out — call-out is a pricing
   * add-on, not job time. */
  actualDurationMinutes: number;
  startsAt: Date;
  isPublicHoliday?: boolean;
}

export interface QuoteResult {
  packageName: string;
  ratePer30MinCents: number;
  minimumBookingMinutes: number;
  calloutMinutes: number;
  /** max(actualDurationMinutes, minimumBookingMinutes), rounded up to a 30-minute unit. */
  billableServiceMinutes: number;
  serviceChargeCents: number;
  calloutFeeCents: number;
  /** serviceChargeCents + calloutFeeCents, after any weekend/holiday multiplier. */
  finalTotalCents: number;
  multiplier: number;
  /** Amount payable before the move. Always 0: no advance payment is
   * required for online bookings. */
  advancePaymentCents: 0;
  /** Equal to finalTotalCents — nothing is paid up-front, so the whole
   * (estimated) total is the balance. An ESTIMATE at booking time; the
   * real figure is computed when staff finalise the job. */
  estimatedBalanceCents: number;
  currency: "aud";
  /** True only when every input needed to produce a real quote is configured. */
  isFullyConfigured: boolean;
  /** Human-readable reasons a figure is an estimate rather than final. */
  caveats: string[];
}

/** Frozen at confirmation time so later rate/policy changes never alter
 * a booking's price. Historical (Stripe-era) snapshots carry
 * `bookingConfirmationCents`; new ones carry `advancePaymentCents: 0`. */
export interface PricingSnapshot {
  package?: string;
  ratePer30MinCents?: number;
  minimumBookingMinutes?: number;
  calloutMinutes?: number;
  advancePaymentRequired?: boolean;
  advancePaymentCents?: number;
  /** Legacy: the $100 confirmation amount on historical bookings. */
  bookingConfirmationCents?: number;
}

export interface FinalBilling {
  billableDurationMinutes: number;
  serviceChargeCents: number;
  calloutFeeCents: number;
  finalTotalCents: number;
  /** Money genuinely received before the job (0 for no-payment bookings). */
  amountPaidCents: number;
  balanceDueCents: number;
  paymentStatus: PaymentStatus;
}

export interface BusyInterval {
  vehicleId: string | null;
  startsAt: Date;
  endsAt: Date;
}

export interface SlotAvailability {
  startsAt: Date;
  endsAt: Date;
  state: "available" | "limited" | "unavailable";
}
