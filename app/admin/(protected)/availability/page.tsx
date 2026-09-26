import { getSupabaseAdmin } from "../../../../lib/server/supabase.ts";
import { DeleteBlockedTimeButton } from "./DeleteBlockedTimeButton";
import { BlockTimeForm } from "./BlockTimeForm";
import { AdminCard, AdminEmptyState, AdminPageHeader, formatAdelaide } from "../../_components/ui";
import type { IconName } from "../../_components/Icon";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

interface BlockedRow {
  id: string;
  starts_at: string;
  ends_at: string;
  reason: string;
  vehicleId: string | null;
  crewId: string | null;
  vehicleName?: string;
  crewName?: string;
}

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

  const rows: BlockedRow[] = (blocked ?? []).map((b) => ({
    id: b.id,
    starts_at: b.starts_at,
    ends_at: b.ends_at,
    reason: b.reason,
    vehicleId: b.vehicle_id,
    crewId: b.crew_id,
    vehicleName: Array.isArray(b.vehicles) ? b.vehicles[0]?.name : (b.vehicles as { name: string } | null)?.name,
    crewName: Array.isArray(b.crews) ? b.crews[0]?.name : (b.crews as { name: string } | null)?.name,
  }));
  const groups: { title: string; icon: IconName; empty: string; items: BlockedRow[] }[] = [
    { title: "Entire business", icon: "ban", empty: "The business isn't closed for any period.", items: rows.filter((r) => !r.vehicleId && !r.crewId) },
    { title: "Vehicles", icon: "truck", empty: "No vehicles are blocked.", items: rows.filter((r) => r.vehicleId) },
    { title: "Crews", icon: "crew", empty: "No crews are blocked.", items: rows.filter((r) => !r.vehicleId && r.crewId) },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <AdminPageHeader
        title="Availability"
        description="Blocked times immediately remove slots customers can book online. Closing the entire business blocks every truck and crew."
        actions={<a href="#block-time" className="admin-btn admin-btn--primary">Block time</a>}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-5">
          {rows.length === 0 ? (
            <AdminCard>
              <AdminEmptyState
                icon="availability"
                title="No blocked times"
                description="Every active truck and crew is bookable during business hours."
              />
            </AdminCard>
          ) : (
            groups.map((group) => (
              <AdminCard key={group.title} icon={group.icon} title={group.title} description={`${group.items.length} blocked period${group.items.length === 1 ? "" : "s"}`} flush>
                {group.items.length === 0 ? (
                  <p className="admin-help px-5 py-4">{group.empty}</p>
                ) : (
                  <ul className="admin-list">
                    {group.items.map((b) => (
                      <li key={b.id} className="admin-list-item admin-blocked-item">
                        <div className="min-w-0">
                          <div className="admin-list-title">{b.vehicleId ? `Truck: ${b.vehicleName ?? "Unknown"}` : b.crewId ? `Crew: ${b.crewName ?? "Unknown"}` : "Entire business"}</div>
                          <div className="admin-list-meta">
                            <span className="font-semibold text-[var(--admin-text-secondary)]">{formatAdelaide(b.starts_at, { dateStyle: "medium" })}</span>
                            {" · "}
                            {formatAdelaide(b.starts_at, { timeStyle: "short" })} → {formatAdelaide(b.ends_at, { dateStyle: "medium", timeStyle: "short" })}
                          </div>
                          <div className="admin-list-meta">{b.reason}</div>
                        </div>
                        <DeleteBlockedTimeButton id={b.id} />
                      </li>
                    ))}
                  </ul>
                )}
              </AdminCard>
            ))
          )}
        </div>

        <AdminCard id="block-time" icon="plus" title="Block time" description="Close the business, or take one truck or crew out of service." className="scroll-mt-20 self-start">
          <BlockTimeForm vehicles={vehicles ?? []} crews={crews ?? []} />
        </AdminCard>
      </div>
    </div>
  );
}
