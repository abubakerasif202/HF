import { requireAdmin } from "../../../../lib/server/admin-dal.ts";
import { getSupabaseAdmin } from "../../../../lib/server/supabase.ts";
import { BlockTimeForm } from "./BlockTimeForm";
import { BlockTimeline, ResourceGroup } from "./AvailabilityParts";
import { blockState, resourceStatus, type BlockedRow } from "./availability-model";
import { AdminCard, AdminPageHeader, MetricCard, formatAdelaide } from "../../_components/ui";
import { Icon } from "../../_components/Icon";
import "../../styles/availability.css";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function AdminAvailabilityPage() {
  await requireAdmin();
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

  const nowMs = new Date().getTime();
  const truckList = vehicles ?? [];
  const crewList = crews ?? [];
  const statuses = [
    ...truckList.map((v) => resourceStatus(rows, "vehicle", v.id, nowMs).state),
    ...crewList.map((c) => resourceStatus(rows, "crew", c.id, nowMs).state),
  ];
  const blockedNow = statuses.filter((state) => state === "blocked-now").length;
  const availableNow = statuses.length - blockedNow;
  const upcoming = rows.filter((row) => blockState(row, nowMs) === "upcoming").length;
  const closure = rows.find((row) => !row.vehicleId && !row.crewId && blockState(row, nowMs) === "active");

  return (
    <div className="a-av">
      <AdminPageHeader
        eyebrow="Fleet & crews"
        title={<>Who is <em>available</em></>}
        description="Blocked times immediately remove slots customers can book online. Closing the entire business blocks every truck and crew."
        actions={<a href="#block-time" className="admin-btn admin-btn--primary"><Icon name="plus" size={16} />Block time</a>}
      />

      {closure && (
        <div className="a-av-closure a-reveal" role="status">
          <Icon name="ban" size={20} />
          <div>
            <strong>The business is closed to online bookings until {formatAdelaide(closure.ends_at, { dateStyle: "medium", timeStyle: "short" })}.</strong>
            <span>{closure.reason}</span>
          </div>
        </div>
      )}

      <div className="a-metric-grid">
        <MetricCard icon="check" label="Available now" value={availableNow} hint="Active trucks and crews with no block in effect" variant="feature" span={4} style={{ ["--i" as string]: 0 }} />
        <MetricCard icon="ban" label="Blocked now" value={blockedNow} hint={blockedNow === 0 ? "Nothing is out of service" : "Trucks or crews currently out of service"} variant={blockedNow > 0 ? "gold" : "porcelain"} span={4} style={{ ["--i" as string]: 1 }} />
        <MetricCard icon="clock" label="Upcoming blocks" value={upcoming} hint="Scheduled closures still to start" variant="porcelain" span={4} wide style={{ ["--i" as string]: 2 }} />
      </div>

      <div className="a-av-layout">
        <div className="a-av-main">
          <AdminCard icon="availability" title="Resources" description="Where each truck and crew stands right now, from blocked times only.">
            <div className="a-av-groups">
              <ResourceGroup kind="vehicle" title="Trucks" resources={truckList} rows={rows} nowMs={nowMs} />
              <ResourceGroup kind="crew" title="Crews" resources={crewList} rows={rows} nowMs={nowMs} />
            </div>
          </AdminCard>

          <AdminCard icon="calendar" title="Blocked times" description="Every closure, soonest first.">
            <BlockTimeline rows={rows} nowMs={nowMs} />
          </AdminCard>
        </div>

        <AdminCard id="block-time" icon="plus" title="Block time" description="Close the business, or take one truck or crew out of service." className="a-av-formcard">
          <BlockTimeForm vehicles={vehicles ?? []} crews={crews ?? []} />
        </AdminCard>
      </div>
    </div>
  );
}
