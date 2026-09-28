"use server";

import { revalidatePath } from "next/cache";
import { getStaffSession } from "../../../../lib/server/supabase-ssr.ts";
import { getSupabaseAdmin } from "../../../../lib/server/supabase.ts";

async function requireStaff() {
  const session = await getStaffSession();
  if (!session) throw new Error("Not authorized");
  return session;
}

function toIntOrThrow(value: FormDataEntryValue | null, field: string, min: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < min) {
    throw new Error(`${field} must be a whole number >= ${min}.`);
  }
  return n;
}

export async function updateBusinessSettingsAction(formData: FormData): Promise<{ error?: string }> {
  await requireStaff();

  try {
    const businessOpenTime = String(formData.get("business_open_time") ?? "");
    const businessCloseTime = String(formData.get("business_close_time") ?? "");
    if (!/^\d{2}:\d{2}$/.test(businessOpenTime) || !/^\d{2}:\d{2}$/.test(businessCloseTime)) {
      throw new Error("Business hours must be in HH:MM format.");
    }
    if (businessCloseTime <= businessOpenTime) {
      throw new Error("Closing time must be after opening time.");
    }

    // The DB check constraint floors the hold at 30 minutes (originally
    // for Stripe Checkout, which is no longer used). Kept as-is: the
    // customer still needs time to review and confirm.
    const bookingHoldMinutes = toIntOrThrow(formData.get("booking_hold_minutes"), "Hold duration", 30);
    const minBookingLeadHours = toIntOrThrow(formData.get("min_booking_lead_hours"), "Minimum lead time", 0);
    const maxBookingHorizonDays = toIntOrThrow(formData.get("max_booking_horizon_days"), "Maximum booking horizon", 1);
    const defaultEstimatedDurationMinutes = toIntOrThrow(formData.get("default_estimated_duration_minutes"), "Default duration", 30);
    const schedulingBufferMinutes = toIntOrThrow(formData.get("scheduling_buffer_minutes"), "Scheduling buffer", 0);
    const bookingNumberPrefix = String(formData.get("booking_number_prefix") ?? "").trim() || "HF";

    // Deposit settings are no longer edited here: online bookings take no
    // advance payment. The legacy deposit_* columns are deliberately left
    // out of this update so saving settings never rewrites them.

    const businessAdminEmail = String(formData.get("booking_admin_email") ?? "").trim() || null;
    if (businessAdminEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(businessAdminEmail)) {
      throw new Error("Admin email looks invalid.");
    }

    const { error } = await getSupabaseAdmin()
      .from("business_settings")
      .update({
        business_open_time: businessOpenTime,
        business_close_time: businessCloseTime,
        booking_hold_minutes: bookingHoldMinutes,
        min_booking_lead_hours: minBookingLeadHours,
        max_booking_horizon_days: maxBookingHorizonDays,
        default_estimated_duration_minutes: defaultEstimatedDurationMinutes,
        scheduling_buffer_minutes: schedulingBufferMinutes,
        booking_number_prefix: bookingNumberPrefix,
        booking_admin_email: businessAdminEmail,
      })
      .eq("id", true);
    if (error) throw error;

    revalidatePath("/admin/settings");
    return {};
  } catch (error) {
    return { error: (error as Error).message };
  }
}
