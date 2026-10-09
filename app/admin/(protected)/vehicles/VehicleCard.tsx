import { truckPackages, truckClassForVehicleType, formatTonnage } from "../../../../lib/site-data.ts";
import { KEEP_CURRENT_TYPE, UNCLASSIFIED_LABEL, UNCLASSIFIED_WARNING, VEHICLE_TYPE_OPTIONS } from "./vehicleTypes.ts";
import { AdminActiveBadge } from "../../_components/AdminStatusBadge";
import { Icon } from "../../_components/Icon";
import { VehicleToggle } from "./VehicleToggle";

export interface VehicleRow {
  id: string;
  name: string;
  vehicle_type: string | null;
  active: boolean;
}

interface VehicleCardProps {
  vehicle: VehicleRow;
  index: number;
  /** The existing update server action, passed in unchanged by the page. */
  updateAction: (formData: FormData) => void | Promise<void>;
}

export function VehicleCard({ vehicle: v, index, updateAction }: VehicleCardProps) {
  const truckClass = truckClassForVehicleType(v.vehicle_type);
  const truck = truckPackages.find((pkg) => pkg.truckClass === truckClass);
  const selectedType = truck ? truck.truckClass : v.vehicle_type ? KEEP_CURRENT_TYPE : "";

  return (
    <li className="a-veh-card a-reveal" data-active={v.active} data-unclassified={!truck} style={{ ["--i" as string]: index }}>
      <div className="a-veh-card-top">
        <div className="a-veh-plate" aria-hidden="true">
          <Icon name="truck" size={28} />
          <span className="a-veh-plate-class" data-none={!truck}>{truck ? truck.truckClass : "?"}</span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="a-veh-name">{v.name}</h3>
          <p className="a-veh-serves">{truck ? <>Serves {truck.name} bookings ({formatTonnage(truck.tonnage)})</> : "Not serving any truck option"}</p>
        </div>
      </div>

      {!truck && (
        <p className="a-veh-warning">
          <strong className="vehicle-class-warning">{UNCLASSIFIED_WARNING}</strong>
        </p>
      )}

      <div className="a-veh-meta">
        <AdminActiveBadge active={v.active} />
        <span className="a-ops-chip">{v.vehicle_type ? `Stored type: ${v.vehicle_type}` : "No type stored"}</span>
      </div>

      <div className="a-veh-foot">
        <VehicleToggle vehicleId={v.id} active={v.active} />
        <details className="vehicle-edit">
          <summary className="admin-btn admin-btn--secondary admin-btn--sm">
            <Icon name="settings" size={14} />
            Edit
          </summary>
        <form action={updateAction} className="vehicle-edit-form">
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
      </div>
    </li>
  );
}
