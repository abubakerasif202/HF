import { getSupabaseAdmin } from "../../../lib/server/supabase.ts";
import { createVehicleAction } from "./actions.ts";
import { VehicleToggle } from "./VehicleToggle";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function AdminVehiclesPage() {
  const { data: vehicles } = await getSupabaseAdmin().from("vehicles").select("id, name, vehicle_type, active").order("created_at", { ascending: true });

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold">Vehicles</h1>
      <p className="mt-1 text-sm text-neutral-500">Active vehicles are what customer availability is calculated against — an empty list means /book always reports no availability.</p>

      <ul className="mt-6 divide-y rounded-xl border">
        {(vehicles ?? []).map((v) => (
          <li key={v.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <div className="font-medium">{v.name}</div>
              {v.vehicle_type && <div className="text-xs text-neutral-400">{v.vehicle_type}</div>}
            </div>
            <VehicleToggle vehicleId={v.id} active={v.active} />
          </li>
        ))}
        {(vehicles ?? []).length === 0 && <li className="px-4 py-8 text-center text-neutral-400">No vehicles yet — add one below.</li>}
      </ul>

      <form action={createVehicleAction} className="mt-8 space-y-3 rounded-xl border p-4">
        <h2 className="font-medium">Add a vehicle</h2>
        <input name="name" required placeholder="e.g. Truck 1" className="w-full rounded-lg border px-3 py-2" />
        <input name="vehicle_type" placeholder="Type (optional, e.g. 4-tonne pantech)" className="w-full rounded-lg border px-3 py-2" />
        <button type="submit" className="rounded-full bg-neutral-900 px-5 py-2 text-sm text-white">Add vehicle</button>
      </form>
    </div>
  );
}
