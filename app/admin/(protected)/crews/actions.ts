"use server";

import { revalidatePath } from "next/cache";
import { getStaffSession } from "../../../../lib/server/supabase-ssr.ts";
import { getSupabaseAdmin } from "../../../../lib/server/supabase.ts";

async function requireStaff() {
  const session = await getStaffSession();
  if (!session) throw new Error("Not authorized");
  return session;
}

export async function createCrewAction(formData: FormData): Promise<void> {
  await requireStaff();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Crew name is required.");
  const { error } = await getSupabaseAdmin().from("crews").insert({ name });
  if (error) throw error;
  revalidatePath("/admin/crews");
}

export async function setCrewActiveAction(crewId: string, active: boolean): Promise<void> {
  await requireStaff();
  const { error } = await getSupabaseAdmin().from("crews").update({ active }).eq("id", crewId);
  if (error) throw error;
  revalidatePath("/admin/crews");
}

export async function addCrewMemberAction(formData: FormData): Promise<void> {
  await requireStaff();
  const crewId = String(formData.get("crew_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim() || null;
  if (!name) throw new Error("Crew member name is required.");
  // Only name and role are collected — deliberately no employee data
  // beyond what operations need (no DOB, address, etc.).
  const { error } = await getSupabaseAdmin().from("crew_members").insert({ crew_id: crewId || null, name, role });
  if (error) throw error;
  revalidatePath("/admin/crews");
}

export async function setCrewMemberActiveAction(memberId: string, active: boolean): Promise<void> {
  await requireStaff();
  const { error } = await getSupabaseAdmin().from("crew_members").update({ active }).eq("id", memberId);
  if (error) throw error;
  revalidatePath("/admin/crews");
}
