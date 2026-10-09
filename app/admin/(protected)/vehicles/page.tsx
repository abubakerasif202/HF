import { requireAdmin } from "../../../../lib/server/admin-dal.ts";
import { getSupabaseAdmin } from "../../../../lib/server/supabase.ts";
import { createVehicleAction, updateVehicleAction } from "./actions.ts";
import { truckPackages, truckClassForVehicleType, formatTonnage } from "../../../../lib/site-data.ts";
import { UNCLASSIFIED_LABEL, UNCLASSIFIED_WARNING, VEHICLE_TYPE_OPTIONS } from "./vehicleTypes.ts";
import { AdminAlert, AdminCard, AdminEmptyState, AdminPageHeader } from "../../_components/ui";
import { Icon } from "../../_components/Icon";
import { OpsStats } from "../_ops-config/OpsStats";
import { VehicleCard } from "./VehicleCard";
import "../../styles/ops-config.css";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function AdminVehiclesPage() {
  await requireAdmin();
  const { data: vehicles } = await getSupabaseAdmin().from("vehicles").select("id, name, vehicle_type, active").order("created_at", { ascending: true });
  const rows = vehicles ?? [];
  const activeCount = rows.filter((v) => v.active).length;
  const activeRows = rows.filter((v) => v.active);
  // Truck options with no active compatible vehicle cannot be booked online.
  const blockedTrucks = truckPackages.filter((pkg) => !activeRows.some((v) => truckClassForVehicleType(v.vehicle_type) === pkg.truckClass));
  const activeUnclassified = activeRows.filter((v) => !truckClassForVehicleType(v.vehicle_type));
  const coveredCount = truckPackages.length - blockedTrucks.length;

  return (
    <div className="a-ops-page mx-auto max-w-6xl">
      <AdminPageHeader
        eyebrow="Fleet"
        title={<>Your <em>fleet.</em></>}
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

      <OpsStats
        stats={[
          { label: "Fleet size", value: rows.length, hint: rows.length === 1 ? "vehicle registered" : "vehicles registered" },
          { label: "Active", value: activeCount, unit: `of ${rows.length}`, hint: "Counted for online availability" },
          { label: "Classes bookable", value: coveredCount, unit: `of ${truckPackages.length}`, hint: "HR, MR and Small", tone: blockedTrucks.length > 0 ? "warn" : undefined },
          { label: "Needs a class", value: activeUnclassified.length, hint: activeUnclassified.length === 0 ? "All active vehicles classified" : "Active but unclassified", tone: activeUnclassified.length > 0 ? "warn" : undefined },
        ]}
      />

      <h2 className="a-ops-section-title">Class coverage</h2>
      <div className="a-veh-coverage">
        {truckPackages.map((pkg) => {
          const count = activeRows.filter((v) => truckClassForVehicleType(v.vehicle_type) === pkg.truckClass).length;
          return (
            <div key={pkg.id} className="a-veh-class" data-ok={count > 0}>
              <span className="a-veh-class-code" aria-hidden="true">{pkg.truckClass}</span>
              <div>
                <p className="a-veh-class-name">{pkg.name} · {formatTonnage(pkg.tonnage)}</p>
                <p className="a-veh-class-meta">{count > 0 ? `${count} active ${count === 1 ? "vehicle" : "vehicles"} — bookable online` : "No active vehicle — unavailable online"}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="a-ops-layout">
        <section aria-labelledby="fleet-heading">
          <h2 id="fleet-heading" className="a-ops-section-title">Fleet · {activeCount} of {rows.length} active</h2>
          {rows.length === 0 ? (
            <AdminCard>
              <AdminEmptyState
                icon="truck"
                title="No vehicles yet"
                description="Add your first vehicle to start accepting online bookings."
                action={<a href="#add-vehicle" className="admin-btn admin-btn--primary">Add vehicle</a>}
              />
            </AdminCard>
          ) : (
            <ul className="a-veh-grid m-0 list-none p-0">
              {rows.map((v, index) => (
                <VehicleCard key={v.id} vehicle={v} index={index} updateAction={updateVehicleAction} />
              ))}
            </ul>
          )}
        </section>

        <div className="a-ops-aside">
          <AdminCard id="add-vehicle" icon="plus" title="Add a vehicle" description="Pick its class so it can take that truck's bookings." className="scroll-mt-20">
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
    </div>
  );
}
