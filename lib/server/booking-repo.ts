import "server-only";
import { getSupabaseAdmin } from "./supabase.ts";
import type { BusinessSettings, BusyInterval, PricingRule, PricingSnapshot } from "../booking/types.ts";
import type { ConfirmRpcResult } from "../booking/confirmation.ts";
import { LIVE_STATUSES } from "../booking/state-machine.ts";

type Address = { formattedAddress?: string; addressLine?: string; suburb?: string } | null;

/** The bookings columns the confirmation flow reads (from to_jsonb(bookings)). */
export interface ConfirmedBookingRow {
  id: string;
  booking_number: string;
  access_token: string;
  booking_status: string;
  customer_id: string | null;
  starts_at: string;
  ends_at: string;
  pickup_address: Address;
  destination_address: Address;
  google_calendar_event_id: string | null;
  deposit_paid_cents: number;
  subtotal_cents: number;
  balance_due_cents: number;
  pricing_snapshot: PricingSnapshot | null;
}

export async function getBusinessSettings(): Promise<BusinessSettings> {
  const { data, error } = await getSupabaseAdmin().from("business_settings").select("*").eq("id", true).single();
  if (error) throw error;
  return {
    timezone: data.timezone,
    businessOpenTime: data.business_open_time.slice(0, 5),
    businessCloseTime: data.business_close_time.slice(0, 5),
    bookingHoldMinutes: data.booking_hold_minutes,
    minBookingLeadHours: data.min_booking_lead_hours,
    maxBookingHorizonDays: data.max_booking_horizon_days,
    defaultEstimatedDurationMinutes: data.default_estimated_duration_minutes,
    schedulingBufferMinutes: data.scheduling_buffer_minutes,
    minimumBookingMinutes: data.minimum_booking_minutes,
    calloutMinutes: data.callout_minutes,
    depositType: data.deposit_type,
    depositFixedAmountCents: data.deposit_fixed_amount_cents,
    depositPercentage: data.deposit_percentage,
    minDepositAmountCents: data.min_deposit_amount_cents,
  };
}

export async function getPricingRule(crewSize: number): Promise<PricingRule | undefined> {
  const { data, error } = await getSupabaseAdmin()
    .from("pricing_rules")
    .select("*")
    .eq("crew_size", crewSize)
    .eq("active", true)
    .maybeSingle();
  if (error) throw error;
  if (!data) return undefined;
  return {
    crewSize: data.crew_size,
    ratePer30MinCents: data.rate_per_30_min_cents,
    minimumBillableMinutes: data.minimum_billable_minutes,
    weekendMultiplier: Number(data.weekend_multiplier),
    publicHolidayMultiplier: Number(data.public_holiday_multiplier),
  };
}

export async function getActiveVehicleIds(): Promise<string[]> {
  const { data, error } = await getSupabaseAdmin().from("vehicles").select("id").eq("active", true);
  if (error) throw error;
  return (data ?? []).map((row) => row.id as string);
}

export async function getBusyIntervals(rangeStart: Date, rangeEnd: Date): Promise<BusyInterval[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("bookings")
    .select("vehicle_id, starts_at, ends_at")
    .in("booking_status", LIVE_STATUSES)
    .lt("starts_at", rangeEnd.toISOString())
    .gt("ends_at", rangeStart.toISOString());
  if (error) throw error;
  return (data ?? []).map((row) => ({
    vehicleId: row.vehicle_id,
    startsAt: new Date(row.starts_at),
    endsAt: new Date(row.ends_at),
  }));
}

export async function getBlockedIntervals(rangeStart: Date, rangeEnd: Date): Promise<BusyInterval[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("blocked_times")
    .select("vehicle_id, crew_id, starts_at, ends_at")
    .lt("starts_at", rangeEnd.toISOString())
    .gt("ends_at", rangeStart.toISOString());
  if (error) throw error;
  return (data ?? [])
    // A row is a *global* block (applies to every vehicle) only when
    // BOTH vehicle_id and crew_id are null. A crew-only block
    // (crew_id set, vehicle_id null) affects crew assignment, not
    // vehicle/slot availability, and must not be treated as closing the
    // whole business — that was a bug: this query used to select only
    // vehicle_id, so a crew-only row's null vehicle_id looked identical
    // to a true global block.
    .filter((row) => !(row.vehicle_id === null && row.crew_id !== null))
    .map((row) => ({
      vehicleId: row.vehicle_id,
      startsAt: new Date(row.starts_at),
      endsAt: new Date(row.ends_at),
    }));
}

export async function findOrCreateCustomer(input: { name: string; email: string; phone?: string }): Promise<string> {
  const client = getSupabaseAdmin();
  // Exact match on a lowercased email, not `.ilike`, which treats a
  // customer-supplied `_`/`%` in the local part as SQL wildcards and can
  // match unrelated addresses.
  const normalizedEmail = input.email.trim().toLowerCase();
  const { data: existing } = await client
    .from("customers")
    .select("id")
    .eq("email", normalizedEmail)
    .maybeSingle();
  if (existing) return existing.id as string;

  const { data, error } = await client
    .from("customers")
    .insert({ name: input.name, email: normalizedEmail, phone: input.phone })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function generateBookingNumber(): Promise<string> {
  const { data, error } = await getSupabaseAdmin().rpc("next_booking_number");
  if (error) throw error;
  return data as string;
}

export interface CreateHoldInput {
  bookingNumber: string;
  customerId: string;
  serviceId: string;
  startsAt: Date;
  endsAt: Date;
  estimatedDurationMinutes: number;
  crewSize: number;
  vehicleId: string;
  pickupAddress: unknown;
  destinationAddress: unknown;
  moveDetails: unknown;
  customerNotes?: string;
  holdMinutes: number;
}

export class SlotUnavailableError extends Error {
  constructor() {
    super("slot_unavailable");
  }
}

export async function createBookingHold(input: CreateHoldInput) {
  const { data, error } = await getSupabaseAdmin().rpc("create_booking_hold", {
    p_booking_number: input.bookingNumber,
    p_customer_id: input.customerId,
    p_service_id: input.serviceId,
    p_starts_at: input.startsAt.toISOString(),
    p_ends_at: input.endsAt.toISOString(),
    p_estimated_duration_minutes: input.estimatedDurationMinutes,
    p_crew_size: input.crewSize,
    p_vehicle_id: input.vehicleId,
    p_pickup_address: input.pickupAddress,
    p_destination_address: input.destinationAddress,
    p_move_details: input.moveDetails,
    p_customer_notes: input.customerNotes ?? null,
    p_hold_minutes: input.holdMinutes,
  });
  if (error) {
    if (error.code === "23P01" || /slot_unavailable/.test(error.message)) {
      throw new SlotUnavailableError();
    }
    throw error;
  }
  return data;
}

export async function getBookingById(id: string) {
  const { data, error } = await getSupabaseAdmin().from("bookings").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getBookingByAccessToken(token: string) {
  const { data, error } = await getSupabaseAdmin().from("bookings").select("*, customers(name, email)").eq("access_token", token).maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Confirms a held booking WITHOUT any payment via the service-role-only
 * `confirm_booking_without_payment` RPC (migration 0011), which checks
 * the access token, `held` state and hold expiry atomically. The pricing
 * snapshot/subtotal are computed server-side by the caller — never taken
 * from the browser.
 */
export async function confirmBookingWithoutPayment(input: {
  bookingId: string;
  accessToken: string;
  pricingSnapshot: PricingSnapshot;
  subtotalCents: number;
}): Promise<ConfirmRpcResult<ConfirmedBookingRow>> {
  const { data, error } = await getSupabaseAdmin().rpc("confirm_booking_without_payment", {
    p_booking_id: input.bookingId,
    p_access_token: input.accessToken,
    p_pricing_snapshot: input.pricingSnapshot,
    p_subtotal_cents: input.subtotalCents,
  });
  if (error) throw error;
  return data as ConfirmRpcResult<ConfirmedBookingRow>;
}

/**
 * Idempotency guard, split into a pre-check and a post-mark so a webhook
 * handler that fails partway through (and returns 500 so Stripe retries)
 * does NOT get permanently skipped on retry. Only mark an event processed
 * once its side effects have actually completed.
 */
export async function hasProcessedStripeEvent(eventId: string): Promise<boolean> {
  const { data, error } = await getSupabaseAdmin().from("stripe_events").select("id").eq("id", eventId).maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function markStripeEventProcessed(eventId: string, type: string): Promise<void> {
  const { error } = await getSupabaseAdmin().from("stripe_events").insert({ id: eventId, type });
  if (error && error.code !== "23505") throw error; // ignore unique_violation races, treat as already marked
}

export async function confirmBookingPayment(bookingId: string, depositPaidCents: number) {
  const { data, error } = await getSupabaseAdmin().rpc("confirm_booking_payment", {
    p_booking_id: bookingId,
    p_deposit_paid_cents: depositPaidCents,
  });
  if (error) throw error;
  return data;
}

export async function recordPayment(input: {
  bookingId: string;
  checkoutSessionId: string;
  paymentIntentId: string | null;
  amountCents: number;
  currency: string;
  status: "paid" | "pending" | "failed";
}) {
  const { error } = await getSupabaseAdmin().from("payments").upsert(
    {
      booking_id: input.bookingId,
      stripe_checkout_session_id: input.checkoutSessionId,
      stripe_payment_intent_id: input.paymentIntentId,
      amount_cents: input.amountCents,
      currency: input.currency,
      payment_type: "deposit",
      payment_status: input.status,
    },
    { onConflict: "stripe_checkout_session_id" },
  );
  if (error) throw error;
}
