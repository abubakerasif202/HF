"use server";

import { revalidatePath } from "next/cache";
import { getStaffSession } from "../../../lib/server/supabase-ssr.ts";
import { getSupabaseAdmin } from "../../../lib/server/supabase.ts";

async function requireStaff() {
  const session = await getStaffSession();
  if (!session) throw new Error("Not authorized");
  return session;
}

export async function createBlockedTimeAction(formData: FormData): Promise<void> {
  const staff = await requireStaff();
  const startsAt = String(formData.get("starts_at") ?? "");
  const endsAt = String(formData.get("ends_at") ?? "");
  const scope = String(formData.get("scope") ?? "all"); // "all" | "vehicle" | "crew"
  const resourceId = String(formData.get("resource_id") ?? "") || null;
  const reason = String(formData.get("reason") ?? "").trim();

  if (!startsAt || !endsAt) throw new Error("Start and end are required.");
  if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) throw new Error("End must be after start.");
  if (!reason) throw new Error("A reason is required (shown to other staff, never to customers).");
  if (scope !== "all" && !resourceId) throw new Error("Select which vehicle or crew to block.");

  const { error } = await getSupabaseAdmin().from("blocked_times").insert({
    starts_at: new Date(startsAt).toISOString(),
    ends_at: new Date(endsAt).toISOString(),
    vehicle_id: scope === "vehicle" ? resourceId : null,
    crew_id: scope === "crew" ? resourceId : null,
    reason,
    created_by: staff.userId,
  });
  if (error) throw error;
  revalidatePath("/admin/availability");
}

export async function deleteBlockedTimeAction(blockedTimeId: string): Promise<void> {
  await requireStaff();
  const { error } = await getSupabaseAdmin().from("blocked_times").delete().eq("id", blockedTimeId);
  if (error) throw error;
  revalidatePath("/admin/availability");
}
