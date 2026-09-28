"use server";

import { revalidatePath } from "next/cache";
import { getStaffSession } from "../../../../../lib/server/supabase-ssr.ts";
import { getSupabaseAdmin } from "../../../../../lib/server/supabase.ts";
import { canTransition } from "../../../../../lib/booking/state-machine.ts";
import { pickFreeVehicle } from "../../../../../lib/booking/availability.ts";
import { getActiveVehicleIds, getBusyIntervals, getBlockedIntervals } from "../../../../../lib/server/booking-repo.ts";
import { syncBookingToCalendar } from "../../../../../lib/server/google-calendar.ts";
import { computeFinalBilling } from "../../../../../lib/booking/pricing.ts";
import type { BookingStatus, PaymentStatus, PricingSnapshot } from "../../../../../lib/booking/types.ts";

async function requireStaff() {
  const session = await getStaffSession();
  if (!session) throw new Error("Not authorized");
  return session;
}

export async function transitionBookingStatusAction(bookingId: string, toStatus: BookingStatus): Promise<{ error?: string }> {
  const staff = await requireStaff();
  try {
    const { data: booking } = await getSupabaseAdmin().from("bookings").select("booking_status").eq("id", bookingId).single();
    if (!booking) throw new Error("Booking not found.");
    if (!canTransition(booking.booking_status as BookingStatus, toStatus)) {
      throw new Error(`Cannot move a booking from "${booking.booking_status}" to "${toStatus}".`);
    }
    // held/pending_payment -> confirmed is reserved for the customer's
    // own confirmation (POST /api/booking/confirm), which freezes the
    // pricing snapshot and sends the confirmation exactly once.
    if (toStatus === "confirmed") {
      throw new Error("Bookings are confirmed by the customer online, not from the admin.");
    }

    const patch: Record<string, unknown> = { booking_status: toStatus };
    if (toStatus === "cancelled") patch.cancelled_at = new Date().toISOString();

    const { error } = await getSupabaseAdmin().from("bookings").update(patch).eq("id", bookingId).eq("booking_status", booking.booking_status);
    if (error) throw error;

    await getSupabaseAdmin().from("booking_events").insert({
      booking_id: bookingId,
      event: `status_changed_to_${toStatus}`,
      actor: staff.userId,
      metadata: { from: booking.booking_status, to: toStatus },
    });
    revalidatePath(`/admin/bookings/${bookingId}`);
    revalidatePath("/admin/bookings");
    return {};
  } catch (error) {
    return { error: (error as Error).message };
  }
}

export async function rescheduleBookingAction(bookingId: string, newStartsAtIso: string): Promise<{ error?: string }> {
  await requireStaff();
  try {
    const { data: booking } = await getSupabaseAdmin().from("bookings").select("*").eq("id", bookingId).single();
    if (!booking) throw new Error("Booking not found.");

    const newStartsAt = new Date(newStartsAtIso);
    const newEndsAt = new Date(newStartsAt.getTime() + booking.estimated_duration_minutes * 60_000);

    const [vehicleIds, busy, blocked] = await Promise.all([
      getActiveVehicleIds(),
      getBusyIntervals(newStartsAt, newEndsAt),
      getBlockedIntervals(newStartsAt, newEndsAt),
    ]);
    // Exclude this booking's own current row from the busy set — otherwise
    // it would always conflict with itself when re-checking its own slot.
    const busyExcludingSelf = busy.filter((b) => !(b.vehicleId === booking.vehicle_id && b.startsAt.getTime() === new Date(booking.starts_at).getTime()));

    const vehicleId = pickFreeVehicle({ startsAt: newStartsAt, endsAt: newEndsAt }, vehicleIds, busyExcludingSelf, blocked) ?? booking.vehicle_id;
    if (!vehicleId) throw new Error("No vehicle is available for that new time.");

    const { error } = await getSupabaseAdmin()
      .from("bookings")
      .update({ starts_at: newStartsAt.toISOString(), ends_at: newEndsAt.toISOString(), vehicle_id: vehicleId })
      .eq("id", bookingId);
    if (error) {
      if (error.code === "23P01") throw new Error("That new time conflicts with another booking.");
      throw error;
    }

    await getSupabaseAdmin().from("booking_events").insert({
      booking_id: bookingId,
      event: "booking_rescheduled",
      actor: "staff",
      metadata: { from: booking.starts_at, to: newStartsAt.toISOString() },
    });

    const { data: updated } = await getSupabaseAdmin().from("bookings").select("*").eq("id", bookingId).single();
    if (updated) await syncBookingToCalendar(updated).catch(() => {});

    revalidatePath(`/admin/bookings/${bookingId}`);
    revalidatePath("/admin/bookings");
    return {};
  } catch (error) {
    return { error: (error as Error).message };
  }
}

/**
 * Finalises a job's real price from the ACTUAL duration staff enter here.
 * Deliberately takes only `actualDurationMinutes` as input — never a
 * client-computed monetary total — and recomputes every dollar figure
 * server-side (lib/booking/pricing.ts computeFinalBilling) from the
 * booking's own `pricing_snapshot` (the policy in effect when it was
 * booked), not from current pricing_rules/business_settings.
 *
 * The amount deducted is the money genuinely recorded against THIS
 * booking (deposit_paid_cents): $100 for a historical booking that paid
 * the old confirmation, $0 for every no-advance-payment booking — so the
 * final balance of a new booking equals its full final total.
 */
export async function finalizeJobAction(bookingId: string, actualDurationMinutes: number): Promise<{ error?: string }> {
  const staff = await requireStaff();
  try {
    const { data: booking } = await getSupabaseAdmin()
      .from("bookings")
      .select("booking_status, payment_status, pricing_snapshot, deposit_paid_cents")
      .eq("id", bookingId)
      .single();
    if (!booking) throw new Error("Booking not found.");
    if (!canTransition(booking.booking_status as BookingStatus, "completed")) {
      throw new Error(`Cannot finalise a booking from status "${booking.booking_status}". It must be "in_progress" first.`);
    }

    const bill = computeFinalBilling(
      (booking.pricing_snapshot ?? {}) as PricingSnapshot,
      actualDurationMinutes,
      booking.deposit_paid_cents ?? 0,
      booking.payment_status as PaymentStatus,
    );

    const { error } = await getSupabaseAdmin()
      .from("bookings")
      .update({
        booking_status: "completed",
        payment_status: bill.paymentStatus,
        actual_duration_minutes: actualDurationMinutes,
        billable_duration_minutes: bill.billableDurationMinutes,
        service_charge_cents: bill.serviceChargeCents,
        callout_fee_cents: bill.calloutFeeCents,
        final_total_cents: bill.finalTotalCents,
        subtotal_cents: bill.finalTotalCents,
        balance_due_cents: bill.balanceDueCents,
        finalised_at: new Date().toISOString(),
        finalised_by: staff.userId,
      })
      .eq("id", bookingId)
      .eq("booking_status", booking.booking_status);
    if (error) throw error;

    await getSupabaseAdmin().from("booking_events").insert({
      booking_id: bookingId,
      event: "job_finalised",
      actor: staff.userId,
      metadata: {
        actualDurationMinutes,
        billableDurationMinutes: bill.billableDurationMinutes,
        finalTotalCents: bill.finalTotalCents,
        amountPaidBeforeJobCents: bill.amountPaidCents,
        balanceDueCents: bill.balanceDueCents,
      },
    });

    revalidatePath(`/admin/bookings/${bookingId}`);
    revalidatePath("/admin/bookings");
    return {};
  } catch (error) {
    return { error: (error as Error).message };
  }
}

export async function retryCalendarSyncAction(bookingId: string): Promise<void> {
  await requireStaff();
  const { data: booking } = await getSupabaseAdmin().from("bookings").select("*").eq("id", bookingId).single();
  if (booking) await syncBookingToCalendar(booking);
  revalidatePath(`/admin/bookings/${bookingId}`);
}
