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

export type PaymentStatus = "pending" | "deposit_paid" | "paid" | "failed" | "refunded" | "partially_refunded";

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
  /** Always the fixed $100 booking-confirmation amount — never derived
   * from finalTotalCents, and never charged twice. */
  bookingConfirmationCents: number;
  /** finalTotalCents - bookingConfirmationCents, floored at 0. This is an
   * ESTIMATE at booking time (actual duration isn't known yet) and a
   * REAL figure once staff finalise the job (see finalizeJob logic). */
  estimatedBalanceCents: number;
  currency: "aud";
  /** True only when every input needed to produce a real quote is configured. */
  isFullyConfigured: boolean;
  /** Human-readable reasons a figure is an estimate rather than final. */
  caveats: string[];
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
