"use server";

import { revalidatePath } from "next/cache";
import { getStaffSession } from "../../../lib/server/supabase-ssr.ts";
import { getSupabaseAdmin } from "../../../lib/server/supabase.ts";

async function requireStaff() {
  const session = await getStaffSession();
  if (!session) throw new Error("Not authorized");
  return session;
}

/**
 * Upserts one crew-size pricing rule. Existing bookings are never
 * affected by this: confirmed bookings freeze their price in
 * `pricing_snapshot` at confirmation time (see lib/booking/pricing.ts),
 * so changing a rate here only changes future quotes.
 */
export async function upsertPricingRuleAction(formData: FormData): Promise<{ error?: string }> {
  await requireStaff();
  try {
    const crewSize = Number(formData.get("crew_size"));
    const ratePer30Min = Number(formData.get("rate_per_30_min"));
    const minimumBillableMinutes = Number(formData.get("minimum_billable_minutes"));
    const callOutFee = Number(formData.get("call_out_fee"));
    const weekendMultiplier = Number(formData.get("weekend_multiplier"));
    const publicHolidayMultiplier = Number(formData.get("public_holiday_multiplier"));

    if (!Number.isInteger(crewSize) || crewSize <= 0) throw new Error("Crew size must be a positive whole number.");
    if (!Number.isFinite(ratePer30Min) || ratePer30Min <= 0) throw new Error("Rate per 30 minutes must be a positive amount.");
    if (!Number.isInteger(minimumBillableMinutes) || minimumBillableMinutes <= 0) throw new Error("Minimum billable minutes must be a positive whole number.");
    if (!Number.isFinite(callOutFee) || callOutFee < 0) throw new Error("Call-out fee cannot be negative.");
    if (!Number.isFinite(weekendMultiplier) || weekendMultiplier < 1) throw new Error("Weekend multiplier must be >= 1.");
    if (!Number.isFinite(publicHolidayMultiplier) || publicHolidayMultiplier < 1) throw new Error("Public holiday multiplier must be >= 1.");

    const { error } = await getSupabaseAdmin().from("pricing_rules").upsert(
      {
        crew_size: crewSize,
        rate_per_30_min_cents: Math.round(ratePer30Min * 100),
        minimum_billable_minutes: minimumBillableMinutes,
        call_out_fee_cents: Math.round(callOutFee * 100),
        weekend_multiplier: weekendMultiplier,
        public_holiday_multiplier: publicHolidayMultiplier,
        active: true,
      },
      { onConflict: "crew_size" },
    );
    if (error) throw error;
    revalidatePath("/admin/pricing");
    return {};
  } catch (error) {
    return { error: (error as Error).message };
  }
}

export async function setPricingRuleActiveAction(ruleId: string, active: boolean): Promise<void> {
  await requireStaff();
  const { error } = await getSupabaseAdmin().from("pricing_rules").update({ active }).eq("id", ruleId);
  if (error) throw error;
  revalidatePath("/admin/pricing");
}
