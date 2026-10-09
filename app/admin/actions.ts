"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSupabaseForServerAction } from "../../lib/server/supabase-ssr.ts";
import { getSupabaseAdmin } from "../../lib/server/supabase.ts";
import { getStaffSession } from "../../lib/server/supabase-ssr.ts";
import { reconcileBookingCalendar } from "../../lib/server/google-calendar.ts";
import { isAdminEmail } from "../../lib/admin-access.ts";

const GENERIC_LOGIN_ERROR = "Invalid admin login credentials.";

export async function signInAction(formData: FormData): Promise<{ error?: string }> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Email and password are required." };
  if (!isAdminEmail(email)) return { error: GENERIC_LOGIN_ERROR };

  const supabase = await getSupabaseForServerAction();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: GENERIC_LOGIN_ERROR };

  const session = await getStaffSession();
  if (!session) {
    await supabase.auth.signOut();
    return { error: GENERIC_LOGIN_ERROR };
  }

  redirect("/admin/bookings");
}

export async function signOutAction(): Promise<void> {
  const supabase = await getSupabaseForServerAction();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

async function requireStaff() {
  const session = await getStaffSession();
  if (!session) throw new Error("Not authorized");
  return session;
}

export async function assignVehicleAction(bookingId: string, vehicleId: string): Promise<void> {
  const staff = await requireStaff();
  const { error } = await getSupabaseAdmin().from("bookings").update({ vehicle_id: vehicleId }).eq("id", bookingId);
  if (error) throw error;
  await getSupabaseAdmin().from("booking_events").insert({ booking_id: bookingId, event: "vehicle_assigned", actor: staff.userId, metadata: { vehicle_id: vehicleId } });
  await reconcileBookingCalendar(bookingId).catch(() => {});
  revalidatePath("/admin/bookings");
}

export async function assignCrewAction(bookingId: string, crewId: string): Promise<void> {
  const staff = await requireStaff();
  const { error } = await getSupabaseAdmin().from("bookings").update({ crew_id: crewId, booking_status: "assigned" }).eq("id", bookingId).eq("booking_status", "confirmed");
  if (error) throw error;
  await getSupabaseAdmin().from("booking_events").insert({ booking_id: bookingId, event: "crew_assigned", actor: staff.userId, metadata: { crew_id: crewId } });
  await reconcileBookingCalendar(bookingId).catch(() => {});
  revalidatePath("/admin/bookings");
}

export async function addInternalNoteAction(bookingId: string, note: string): Promise<void> {
  const staff = await requireStaff();
  if (!note.trim()) return;
  const { data: current } = await getSupabaseAdmin().from("bookings").select("internal_notes").eq("id", bookingId).single();
  const stamped = `[${new Date().toISOString()}] ${staff.email ?? staff.userId}: ${note.trim()}`;
  const combined = current?.internal_notes ? `${current.internal_notes}\n${stamped}` : stamped;
  const { error } = await getSupabaseAdmin().from("bookings").update({ internal_notes: combined }).eq("id", bookingId);
  if (error) throw error;
  revalidatePath("/admin/bookings");
}

export async function cancelBookingAction(bookingId: string): Promise<void> {
  const staff = await requireStaff();
  const { data: booking, error } = await getSupabaseAdmin()
    .from("bookings")
    .update({ booking_status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", bookingId)
    .in("booking_status", ["held", "pending_payment", "confirmed", "assigned"])
    .select("id")
    .maybeSingle();
  if (error) throw error;
  await getSupabaseAdmin().from("booking_events").insert({ booking_id: bookingId, event: "booking_cancelled", actor: staff.userId });
  // Removes the mirrored Google event (records a retryable failure if Google is down).
  if (booking) await reconcileBookingCalendar(bookingId).catch(() => {});
  revalidatePath("/admin/bookings");
}
