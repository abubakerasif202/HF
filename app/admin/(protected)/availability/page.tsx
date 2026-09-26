import { getSupabaseAdmin } from "../../../../lib/server/supabase.ts";
import { createBlockedTimeAction } from "./actions.ts";
import { DeleteBlockedTimeButton } from "./DeleteBlockedTimeButton";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function AdminAvailabilityPage() {
  const supabase = getSupabaseAdmin();
  const [{ data: blocked }, { data: vehicles }, { data: crews }] = await Promise.all([
    supabase
      .from("blocked_times")
      .select("id, starts_at, ends_at, vehicle_id, crew_id, reason, vehicles(name), crews(name)")
      .order("starts_at", { ascending: true }),
    supabase.from("vehicles").select("id, name").eq("active", true),
    supabase.from("crews").select("id, name").eq("active", true),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold">Availability</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Blocked times immediately affect what customers can select on /book — a block with no vehicle or crew
        selected closes the entire business for that window.
      </p>

      <ul className="mt-6 divide-y rounded-xl border">
        {(blocked ?? []).map((b) => {
          const vehicleName = Array.isArray(b.vehicles) ? b.vehicles[0]?.name : (b.vehicles as { name: string } | null)?.name;
          const crewName = Array.isArray(b.crews) ? b.crews[0]?.name : (b.crews as { name: string } | null)?.name;
          const scope = vehicleName ? `Truck: ${vehicleName}` : crewName ? `Crew: ${crewName}` : "Entire business";
          return (
            <li key={b.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <div className="font-medium">{scope}</div>
                <div className="text-neutral-500">
                  {new Date(b.starts_at).toLocaleString("en-AU", { timeZone: "Australia/Adelaide" })} → {new Date(b.ends_at).toLocaleString("en-AU", { timeZone: "Australia/Adelaide" })}
                </div>
                <div className="text-neutral-400">{b.reason}</div>
              </div>
              <DeleteBlockedTimeButton id={b.id} />
            </li>
          );
        })}
        {(blocked ?? []).length === 0 && <li className="px-4 py-8 text-center text-neutral-400">No blocked times.</li>}
      </ul>

      <form action={createBlockedTimeAction} className="mt-8 space-y-3 rounded-xl border p-4">
        <h2 className="font-medium">Block time</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            Start
            <input type="datetime-local" name="starts_at" required className="mt-1 w-full rounded-lg border px-3 py-2" />
          </label>
          <label className="block text-sm">
            End
            <input type="datetime-local" name="ends_at" required className="mt-1 w-full rounded-lg border px-3 py-2" />
          </label>
        </div>
        <label className="block text-sm">
          Scope
          <select name="scope" className="mt-1 w-full rounded-lg border px-3 py-2">
            <option value="all">Entire business</option>
            <option value="vehicle">Specific vehicle</option>
            <option value="crew">Specific crew</option>
          </select>
        </label>
        <label className="block text-sm">
          Vehicle or crew (only used if scope above isn&apos;t &quot;Entire business&quot;)
          <select name="resource_id" className="mt-1 w-full rounded-lg border px-3 py-2">
            <option value="">—</option>
            <optgroup label="Vehicles">
              {(vehicles ?? []).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </optgroup>
            <optgroup label="Crews">
              {(crews ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </optgroup>
          </select>
        </label>
        <label className="block text-sm">
          Reason (internal only)
          <input name="reason" required placeholder="e.g. Truck maintenance" className="mt-1 w-full rounded-lg border px-3 py-2" />
        </label>
        <button type="submit" className="rounded-full bg-neutral-900 px-5 py-2 text-sm text-white">Block time</button>
      </form>
    </div>
  );
}
