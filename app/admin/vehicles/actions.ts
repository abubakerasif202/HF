"use server";

import { revalidatePath } from "next/cache";
import { getStaffSession } from "../../../lib/server/supabase-ssr.ts";
import { getSupabaseAdmin } from "../../../lib/server/supabase.ts";

async function requireStaff() {
  const session = await getStaffSession();
  if (!session) throw new Error("Not authorized");
  return session;
}

export async function createVehicleAction(formData: FormData): Promise<void> {
  await requireStaff();
  const name = String(formData.get("name") ?? "").trim();
  const vehicleType = String(formData.get("vehicle_type") ?? "").trim() || null;
  if (!name) throw new Error("Vehicle name is required.");

  const { error } = await getSupabaseAdmin().from("vehicles").insert({ name, vehicle_type: vehicleType });
  if (error) throw error;
  revalidatePath("/admin/vehicles");
}

export async function setVehicleActiveAction(vehicleId: string, active: boolean): Promise<void> {
  await requireStaff();
  // Deactivating removes a vehicle from future availability (getActiveVehicleIds
  // filters on active=true) without touching any past booking's vehicle_id —
  // history stays intact because bookings reference the vehicle row, not a
  // denormalized snapshot of its active flag.
  const { error } = await getSupabaseAdmin().from("vehicles").update({ active }).eq("id", vehicleId);
  if (error) throw error;
  revalidatePath("/admin/vehicles");
}
