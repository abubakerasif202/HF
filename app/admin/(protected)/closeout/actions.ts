"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStaffSession } from "../../../../lib/server/supabase-ssr.ts";
import { getSupabaseAdmin } from "../../../../lib/server/supabase.ts";
import { CLOSEOUT_CANCEL_REASONS, MAX_ACTUAL_MINUTES, isCloseoutStatus, isPastEnd, stepsToInProgress } from "../../../../lib/admin/closeout.ts";
import { finalizeJobAction, transitionBookingStatusAction } from "../bookings/[id]/actions.ts";

async function requireStaff() {
  const session = await getStaffSession();
  if (!session) throw new Error("Not authorized");
  return session;
}

const bookingIdSchema = z.string().uuid();
const minutesSchema = z.number().int().min(1).max(MAX_ACTUAL_MINUTES);
const reasonSchema = z.enum(CLOSEOUT_CANCEL_REASONS);

/** Loads the booking and confirms it is genuinely a past, still-open job. Returns its current status. */
async function loadCloseableStatus(bookingId: string): Promise<string> {
  const { data: booking, error } = await getSupabaseAdmin().from("bookings").select("booking_status, ends_at").eq("id", bookingId).maybeSingle();
  if (error) throw error;
  if (!booking) throw new Error("Booking not found.");
  if (!isCloseoutStatus(booking.booking_status)) throw new Error(`This booking is "${booking.booking_status}" and no longer needs closing out.`);
  if (!isPastEnd(booking.ends_at)) throw new Error("This job has not finished yet, so it cannot be closed out.");
  return booking.booking_status;
}

function revalidateCloseout(bookingId: string) {
  revalidatePath("/admin/closeout");
  revalidatePath("/admin");
  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${bookingId}`);
}

/**
 * Finalise a past job from the closeout queue. A job still confirmed or
 * assigned is first moved forward through the normal state machine (each hop
 * writes its own booking_events row), then finalizeJobAction recomputes the
 * price server-side from the actual minutes and records `job_finalised`.
 * If a hop fails the booking stays at the last valid status and the error is returned.
 */
export async function finaliseCloseoutJobAction(bookingId: string, actualDurationMinutes: number): Promise<{ error?: string }> {
  await requireStaff();
  try {
    const id = bookingIdSchema.parse(bookingId);
    const minutes = minutesSchema.parse(actualDurationMinutes);
    const status = await loadCloseableStatus(id);
    if (!isCloseoutStatus(status)) throw new Error("This booking no longer needs closing out.");
    for (const next of stepsToInProgress(status)) {
      const step = await transitionBookingStatusAction(id, next);
      if (step.error) throw new Error(step.error);
    }
    const result = await finalizeJobAction(id, minutes);
    if (result.error) throw new Error(result.error);
    revalidateCloseout(id);
    return {};
  } catch (error) {
    if (error instanceof z.ZodError) return { error: "Enter the actual service time as a whole number of minutes (1-1440)." };
    return { error: (error as Error).message };
  }
}

/**
 * Close a past job that did not go ahead. Both outcomes use the existing
 * `cancelled` status (no new status values); the reason is stored on a
 * dedicated booking_events row so a no-show stays distinguishable.
 */
export async function cancelCloseoutJobAction(bookingId: string, reason: string): Promise<{ error?: string }> {
  const staff = await requireStaff();
  try {
    const id = bookingIdSchema.parse(bookingId);
    const why = reasonSchema.parse(reason);
    await loadCloseableStatus(id);
    const result = await transitionBookingStatusAction(id, "cancelled");
    if (result.error) throw new Error(result.error);
    revalidateCloseout(id);
    const { error } = await getSupabaseAdmin().from("booking_events").insert({
      booking_id: id,
      event: why === "no_show" ? "closeout_marked_no_show" : "closeout_marked_cancelled",
      actor: staff.userId,
      metadata: { reason: why, source: "closeout_queue" },
    });
    if (error) throw new Error("The booking was closed, but the audit note could not be saved.");
    return {};
  } catch (error) {
    if (error instanceof z.ZodError) return { error: "That request was not valid." };
    return { error: (error as Error).message };
  }
}
