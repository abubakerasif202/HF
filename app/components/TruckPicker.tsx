"use client";

import { crewUpgradePricing, findMovingPackage, truckPricing, type MovingPackageId } from "../../lib/site-data";

/**
 * Accessible truck picker for the quote form and booking wizard: a real radio group
 * (fieldset + legend, native radios) styled as selectable cards. The three trucks are
 * the main choice; the 3-mover crew upgrade is a smaller option in the same group.
 */
export function TruckPicker({
  name,
  value,
  onChange,
  required = false,
  legend = "Choose Your Truck",
  idPrefix,
  includeCrewUpgrade = true,
  unavailableIds = [],
}: {
  name: string;
  value: MovingPackageId | null;
  onChange: (id: MovingPackageId) => void;
  required?: boolean;
  legend?: string;
  idPrefix: string;
  includeCrewUpgrade?: boolean;
  /** Package ids with no compatible active vehicle: shown, but not selectable. */
  unavailableIds?: readonly string[];
}) {
  const rows = includeCrewUpgrade ? [...truckPricing, ...crewUpgradePricing] : truckPricing;
  return (
    <fieldset className="truck-picker">
      <legend className="field-label">
        {legend} {required && <b aria-hidden="true">*</b>}
      </legend>
      <div className="truck-picker-options">
        {rows.map((row) => {
          const isUpgrade = row.truckClass === null;
          const inputId = `${idPrefix}-${row.id}`;
          const unavailable = unavailableIds.includes(row.id);
          return (
            <label className={`truck-pick ${isUpgrade ? "truck-pick-upgrade" : ""} ${value === row.id ? "is-checked" : ""} ${unavailable ? "is-unavailable" : ""}`} htmlFor={inputId} key={row.id}>
              <input
                id={inputId}
                className="truck-pick-input"
                type="radio"
                name={name}
                value={row.id}
                checked={value === row.id}
                required={required}
                disabled={unavailable}
                onChange={() => onChange(row.id as MovingPackageId)}
              />
              <span className="truck-pick-body">
                <span className="truck-pick-name">{row.name}</span>
                <span className="truck-pick-spec">{row.capacity ? `${row.capacity} · ` : ""}{row.crewLabel}</span>
                <span className="truck-pick-price">
                  <span className="truck-pick-amount">{row.halfHour}</span>
                  <span className="truck-pick-unit">/ 30 min</span>
                </span>
                <span className="truck-pick-hourly">{row.hourly}/hr</span>
                {unavailable && <span className="truck-pick-unavailable">Unavailable online</span>}
              </span>
              <span className="truck-pick-check" aria-hidden="true" />
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * Structured copy of the chosen package for the submitted lead. Every value comes
 * from the canonical package table, so the lead never depends on a visible label.
 */
export function TruckHiddenFields({ packageId }: { packageId: MovingPackageId | null }) {
  const pkg = packageId ? findMovingPackage({ id: packageId }) : undefined;
  const row = [...truckPricing, ...crewUpgradePricing].find((item) => item.id === packageId);
  if (!pkg || !row) return null;
  return (
    <>
      {/* truck_package_id itself is submitted by the selected radio in TruckPicker. */}
      <input type="hidden" name="truck_name" value={pkg.name} />
      <input type="hidden" name="truck_class" value={pkg.truckClass ?? "Assigned to suit load"} />
      <input type="hidden" name="truck_capacity" value={row.capacity ?? "Assigned to suit load"} />
      <input type="hidden" name="crew_size" value={String(pkg.crewSize)} />
      <input type="hidden" name="rate_per_30_min" value={`${row.halfHour} / 30 min`} />
      <input type="hidden" name="rate_per_30_min_cents" value={String(pkg.ratePer30MinCents)} />
      <input type="hidden" name="moving_package" value={`${pkg.name}${row.capacity ? ` — ${row.capacity}` : ""} — ${row.crewLabel} — ${row.halfHour} / 30 min`} />
    </>
  );
}
