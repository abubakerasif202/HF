"use server";

import { revalidatePath } from "next/cache";
import { getStaffSession } from "../../../../lib/server/supabase-ssr.ts";
import { getSupabaseAdmin } from "../../../../lib/server/supabase.ts";
import { canTransition } from "../../../../lib/booking/state-machine.ts";
import { pickFreeVehicle } from "../../../../lib/booking/availability.ts";
import { getActiveVehicleIds, getBusyIntervals, getBlockedIntervals } from "../../../../lib/server/booking-repo.ts";
import { syncBookingToCalendar } from "../../../../lib/server/google-calendar.ts";
import type { BookingStatus } from "../../../../lib/booking/types.ts";

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

interface PricingSnapshot {
  package?: string;
  ratePer30MinCents?: number;
  minimumBookingMinutes?: number;
  calloutMinutes?: number;
  bookingConfirmationCents?: number;
}

/**
 * Finalises a job's real price from the ACTUAL duration staff enter here.
 * Deliberately takes only `actualDurationMinutes` as input — never a
 * client-computed monetary total — and recomputes every dollar figure
 * server-side from the booking's own `pricing_snapshot` (the policy that
 * was in effect when the booking was made), not from the current, possibly
 * since-changed, pricing_rules/business_settings. This is what makes
 * historical pricing immutable even after a rate change.
 */
export async function finalizeJobAction(bookingId: string, actualDurationMinutes: number): Promise<{ error?: string }> {
  const staff = await requireStaff();
  try {
    if (!Number.isFinite(actualDurationMinutes) || !Number.isInteger(actualDurationMinutes) || actualDurationMinutes <= 0) {
      throw new Error("Actual duration must be a positive whole number of minutes.");
    }

    const { data: booking } = await getSupabaseAdmin()
      .from("bookings")
      .select("booking_status, pricing_snapshot, deposit_paid_cents")
      .eq("id", bookingId)
      .single();
    if (!booking) throw new Error("Booking not found.");
    if (!canTransition(booking.booking_status as BookingStatus, "completed")) {
      throw new Error(`Cannot finalise a booking from status "${booking.booking_status}". It must be "in_progress" first.`);
    }

    const snapshot = (booking.pricing_snapshot ?? {}) as PricingSnapshot;
    const ratePer30MinCents = snapshot.ratePer30MinCents;
    const minimumBookingMinutes = snapshot.minimumBookingMinutes ?? 180;
    const calloutMinutes = snapshot.calloutMinutes ?? 60;
    if (!ratePer30MinCents) {
      throw new Error("This booking has no pricing snapshot to finalise against (was it ever paid?).");
    }

    // Integer-cent, 30-minute-unit arithmetic — mirrors lib/booking/pricing.ts
    // exactly, but against the FROZEN snapshot rather than live pricing_rules.
    const billableDurationMinutes = Math.max(Math.ceil(actualDurationMinutes / 30) * 30, minimumBookingMinutes);
    const serviceChargeCents = (billableDurationMinutes / 30) * ratePer30MinCents;
    const calloutFeeCents = (calloutMinutes / 30) * ratePer30MinCents;
    const finalTotalCents = serviceChargeCents + calloutFeeCents;
    const depositPaidCents = booking.deposit_paid_cents ?? 0;
    const balanceDueCents = Math.max(finalTotalCents - depositPaidCents, 0);
    const paymentStatus = balanceDueCents > 0 ? "deposit_paid" : "paid";

    const { error } = await getSupabaseAdmin()
      .from("bookings")
      .update({
        booking_status: "completed",
        payment_status: paymentStatus,
        actual_duration_minutes: actualDurationMinutes,
        billable_duration_minutes: billableDurationMinutes,
        service_charge_cents: serviceChargeCents,
        callout_fee_cents: calloutFeeCents,
        final_total_cents: finalTotalCents,
        subtotal_cents: finalTotalCents,
        balance_due_cents: balanceDueCents,
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
      metadata: { actualDurationMinutes, billableDurationMinutes, finalTotalCents, balanceDueCents },
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
