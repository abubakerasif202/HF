import { getSupabaseAdmin } from "../../../../lib/server/supabase.ts";
import { createVehicleAction } from "./actions.ts";
import { VehicleToggle } from "./VehicleToggle";
import { AdminCard, AdminEmptyState, AdminPageHeader } from "../../_components/ui";
import { AdminActiveBadge } from "../../_components/AdminStatusBadge";
import { Icon } from "../../_components/Icon";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function AdminVehiclesPage() {
  const { data: vehicles } = await getSupabaseAdmin().from("vehicles").select("id, name, vehicle_type, active").order("created_at", { ascending: true });
  const rows = vehicles ?? [];
  const activeCount = rows.filter((v) => v.active).length;

  return (
    <div className="mx-auto max-w-5xl">
      <AdminPageHeader
        title="Vehicles"
        description="Customer availability is calculated against active vehicles. With no active vehicle, online booking shows no times."
        actions={
          <a href="#add-vehicle" className="admin-btn admin-btn--primary">
            <Icon name="plus" size={16} />
            Add vehicle
          </a>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <AdminCard icon="truck" title="Fleet" description={`${activeCount} of ${rows.length} active`} flush>
          {rows.length === 0 ? (
            <AdminEmptyState
              icon="truck"
              title="No vehicles yet"
              description="Add your first vehicle to start accepting online bookings."
              action={<a href="#add-vehicle" className="admin-btn admin-btn--primary">Add vehicle</a>}
            />
          ) : (
            <ul className="admin-list">
              {rows.map((v) => (
                <li key={v.id} className="admin-list-item">
                  <div className="min-w-0">
                    <div className="admin-list-title">{v.name}</div>
                    <div className="admin-list-meta">{v.vehicle_type || "Type not set"}</div>
                  </div>
                  <div className="admin-list-actions">
                    <AdminActiveBadge active={v.active} />
                    <VehicleToggle vehicleId={v.id} active={v.active} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </AdminCard>

        <AdminCard id="add-vehicle" icon="plus" title="Add a vehicle" className="scroll-mt-20 self-start">
          <form action={createVehicleAction} className="grid gap-4">
            <label className="admin-field">
              <span className="admin-label">Vehicle name</span>
              <input name="name" required placeholder="e.g. Truck 1" className="admin-input" />
            </label>
            <label className="admin-field">
              <span className="admin-label">Type <span className="font-medium text-[var(--admin-text-muted)]">(optional)</span></span>
              <input name="vehicle_type" placeholder="e.g. 4-tonne pantech" className="admin-input" />
            </label>
            <div>
              <button type="submit" className="admin-btn admin-btn--primary">Add vehicle</button>
            </div>
          </form>
        </AdminCard>
      </div>
    </div>
  );
}
