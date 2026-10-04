"use server";

import { revalidatePath } from "next/cache";
import { getStaffSession } from "../../../../lib/server/supabase-ssr.ts";
import { getSupabaseAdmin } from "../../../../lib/server/supabase.ts";
import { parseVehicleTypeInput } from "./vehicleTypes.ts";

const MAX_NAME_LENGTH = 80;

async function requireStaff() {
  const session = await getStaffSession();
  if (!session) throw new Error("Not authorized");
  return session;
}

function parseName(formData: FormData): string {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Vehicle name is required.");
  if (name.length > MAX_NAME_LENGTH) throw new Error(`Vehicle name must be ${MAX_NAME_LENGTH} characters or fewer.`);
  return name;
}

export async function createVehicleAction(formData: FormData): Promise<void> {
  await requireStaff();
  const name = parseName(formData);
  // Truck-package bookings are matched to vehicles by this canonical value, so free text is not accepted.
  const type = parseVehicleTypeInput(String(formData.get("vehicle_type") ?? ""));
  if (!type.ok) throw new Error(type.message);

  const { error } = await getSupabaseAdmin().from("vehicles").insert({ name, vehicle_type: type.unchanged ? null : type.vehicleType });
  if (error) throw error;
  revalidatePath("/admin/vehicles");
}

/**
 * Edits a vehicle's name and type. Past bookings keep pointing at the same vehicle row
 * and their own pricing snapshot, so retyping a vehicle never rewrites history; it only
 * changes which truck options the vehicle can serve from now on.
 */
export async function updateVehicleAction(formData: FormData): Promise<void> {
  await requireStaff();
  const vehicleId = String(formData.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(vehicleId)) throw new Error("Invalid vehicle.");
  const name = parseName(formData);
  const type = parseVehicleTypeInput(String(formData.get("vehicle_type") ?? ""));
  if (!type.ok) throw new Error(type.message);

  const update: { name: string; vehicle_type?: string | null } = { name };
  if (!type.unchanged) update.vehicle_type = type.vehicleType;

  const { error } = await getSupabaseAdmin().from("vehicles").update(update).eq("id", vehicleId);
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
