import { getSupabaseAdmin } from "../../../../lib/server/supabase.ts";
import { createVehicleAction, updateVehicleAction } from "./actions.ts";
import { VehicleToggle } from "./VehicleToggle";
import { truckPackages, truckClassForVehicleType, formatTonnage } from "../../../../lib/site-data.ts";
import { KEEP_CURRENT_TYPE, UNCLASSIFIED_LABEL, UNCLASSIFIED_WARNING, VEHICLE_TYPE_OPTIONS } from "./vehicleTypes.ts";
import { AdminAlert, AdminCard, AdminEmptyState, AdminPageHeader } from "../../_components/ui";
import { AdminActiveBadge } from "../../_components/AdminStatusBadge";
import { Icon } from "../../_components/Icon";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function AdminVehiclesPage() {
  const { data: vehicles } = await getSupabaseAdmin().from("vehicles").select("id, name, vehicle_type, active").order("created_at", { ascending: true });
  const rows = vehicles ?? [];
  const activeCount = rows.filter((v) => v.active).length;
  const activeRows = rows.filter((v) => v.active);
  // Truck options with no active compatible vehicle cannot be booked online.
  const blockedTrucks = truckPackages.filter((pkg) => !activeRows.some((v) => truckClassForVehicleType(v.vehicle_type) === pkg.truckClass));
  const activeUnclassified = activeRows.filter((v) => !truckClassForVehicleType(v.vehicle_type));

  return (
    <div className="mx-auto max-w-5xl">
      <AdminPageHeader
        title="Vehicles"
        description="Customer availability is calculated against active vehicles. Each truck option (HR, MR, Small) is only booked onto a vehicle of that class."
        actions={
          <a href="#add-vehicle" className="admin-btn admin-btn--primary">
            <Icon name="plus" size={16} />
            Add vehicle
          </a>
        }
      />

      <div className="mb-5 grid gap-3">
        {activeUnclassified.length > 0 && (
          <AdminAlert tone="error">
            <strong>{UNCLASSIFIED_WARNING}</strong> {activeUnclassified.map((v) => v.name).join(", ")} {activeUnclassified.length === 1 ? "has" : "have"} no HR, MR or Small class. Use Edit on the vehicle to set its real class.
          </AdminAlert>
        )}
        {blockedTrucks.length > 0 ? (
          <AdminAlert tone="error">
            Online booking is unavailable for: {blockedTrucks.map((pkg) => `${pkg.name} (${formatTonnage(pkg.tonnage)})`).join(", ")}. There is no active vehicle of {blockedTrucks.length === 1 ? "that class" : "those classes"}.
          </AdminAlert>
        ) : (
          <AdminAlert tone="success">Every truck option (HR, MR, Small) has at least one active vehicle.</AdminAlert>
        )}
      </div>

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
              {rows.map((v) => {
                const truckClass = truckClassForVehicleType(v.vehicle_type);
                const truck = truckPackages.find((pkg) => pkg.truckClass === truckClass);
                const selectedType = truck ? truck.truckClass : v.vehicle_type ? KEEP_CURRENT_TYPE : "";
                return (
                  <li key={v.id} className="admin-list-item">
                    <div className="min-w-0">
                      <div className="admin-list-title">{v.name}</div>
                      <div className="admin-list-meta">{v.vehicle_type ? `Stored type: ${v.vehicle_type}` : "No type stored"}</div>
                      <div className="admin-list-meta">
                        {truck ? (
                          <>Serves: {truck.name} ({formatTonnage(truck.tonnage)})</>
                        ) : (
                          <strong className="vehicle-class-warning">{UNCLASSIFIED_WARNING}</strong>
                        )}
                      </div>
                    </div>
                    <div className="admin-list-actions">
                      <AdminActiveBadge active={v.active} />
                      <VehicleToggle vehicleId={v.id} active={v.active} />
                    </div>
                    <details className="vehicle-edit">
                      <summary className="admin-btn admin-btn--secondary admin-btn--sm">Edit</summary>
                      <form action={updateVehicleAction} className="vehicle-edit-form">
                        <input type="hidden" name="id" value={v.id} />
                        <label className="admin-field">
                          <span className="admin-label">Vehicle name</span>
                          <input name="name" required maxLength={80} defaultValue={v.name} className="admin-input" />
                        </label>
                        <label className="admin-field">
                          <span className="admin-label">Vehicle type</span>
                          <select name="vehicle_type" defaultValue={selectedType} className="admin-input">
                            {VEHICLE_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                            {selectedType === KEEP_CURRENT_TYPE && <option value={KEEP_CURRENT_TYPE}>Keep current: {v.vehicle_type} (unclassified)</option>}
                            <option value="">{UNCLASSIFIED_LABEL}</option>
                          </select>
                        </label>
                        <div>
                          <button type="submit" className="admin-btn admin-btn--primary admin-btn--sm">Save changes</button>
                        </div>
                      </form>
                    </details>
                  </li>
                );
              })}
            </ul>
          )}
        </AdminCard>

        <AdminCard id="add-vehicle" icon="plus" title="Add a vehicle" className="scroll-mt-20 self-start">
          <form action={createVehicleAction} className="grid gap-4">
            <label className="admin-field">
              <span className="admin-label">Vehicle name</span>
              <input name="name" required maxLength={80} placeholder="e.g. Truck 1" className="admin-input" />
            </label>
            <label className="admin-field">
              <span className="admin-label">Vehicle type</span>
              <select name="vehicle_type" defaultValue="" className="admin-input">
                {VEHICLE_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                <option value="">{UNCLASSIFIED_LABEL}</option>
              </select>
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
