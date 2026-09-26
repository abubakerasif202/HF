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

    // Stripe Checkout's expires_at floor is 30 minutes; the hold must
    // never be shorter than the Checkout session it backs (see the
    // migration comment on business_settings.booking_hold_minutes).
    const bookingHoldMinutes = toIntOrThrow(formData.get("booking_hold_minutes"), "Hold duration", 30);
    const minBookingLeadHours = toIntOrThrow(formData.get("min_booking_lead_hours"), "Minimum lead time", 0);
    const maxBookingHorizonDays = toIntOrThrow(formData.get("max_booking_horizon_days"), "Maximum booking horizon", 1);
    const defaultEstimatedDurationMinutes = toIntOrThrow(formData.get("default_estimated_duration_minutes"), "Default duration", 30);
    const schedulingBufferMinutes = toIntOrThrow(formData.get("scheduling_buffer_minutes"), "Scheduling buffer", 0);
    const bookingNumberPrefix = String(formData.get("booking_number_prefix") ?? "").trim() || "HF";

    const depositEnabled = formData.get("deposit_enabled") === "on";
    const depositType = depositEnabled ? String(formData.get("deposit_type") ?? "") : null;
    let depositFixedAmountCents: number | null = null;
    let depositPercentage: number | null = null;
    let minDepositAmountCents: number | null = null;

    if (depositEnabled) {
      if (depositType !== "fixed" && depositType !== "percentage") {
        throw new Error("Choose a deposit type.");
      }
      if (depositType === "fixed") {
        const dollars = Number(formData.get("deposit_fixed_amount"));
        if (!Number.isFinite(dollars) || dollars <= 0) throw new Error("Fixed deposit must be a positive amount.");
        depositFixedAmountCents = Math.round(dollars * 100);
      } else {
        const pct = Number(formData.get("deposit_percentage"));
        if (!Number.isFinite(pct) || pct <= 0 || pct > 100) throw new Error("Deposit percentage must be between 0 and 100.");
        depositPercentage = pct;
      }
      const minDollars = formData.get("min_deposit_amount");
      if (minDollars && String(minDollars).trim() !== "") {
        const n = Number(minDollars);
        if (!Number.isFinite(n) || n < 0) throw new Error("Minimum deposit cannot be negative.");
        minDepositAmountCents = Math.round(n * 100);
      }
    }

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
        deposit_type: depositType,
        deposit_fixed_amount_cents: depositFixedAmountCents,
        deposit_percentage: depositPercentage,
        min_deposit_amount_cents: minDepositAmountCents,
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
