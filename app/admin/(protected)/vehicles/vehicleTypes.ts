import { truckPackages, formatTonnage, type TruckClass } from "../../../../lib/site-data.ts";

/** Canonical vehicles.vehicle_type values the admin may store: the truck classes, or empty. */
export const VEHICLE_TYPE_VALUES: readonly string[] = truckPackages.map((item) => item.truckClass);

export const VEHICLE_TYPE_OPTIONS: ReadonlyArray<{ value: TruckClass; label: string }> = truckPackages.map((item) => ({
  value: item.truckClass,
  label: `${item.truckClass} — ${formatTonnage(item.tonnage)}`,
}));

export const UNCLASSIFIED_LABEL = "Other / Unclassified";

/** Sentinel used by the edit form for "leave the stored type exactly as it is". */
export const KEEP_CURRENT_TYPE = "__keep__";

export const UNCLASSIFIED_WARNING = "Vehicle class required for online truck-specific booking.";

/** True for "" (unclassified) or one of the canonical truck class strings. */
export function isAllowedVehicleType(value: string): boolean {
  return value === "" || VEHICLE_TYPE_VALUES.includes(value);
}

export type VehicleTypeInput = { ok: true; vehicleType: string | null; unchanged: boolean } | { ok: false; message: string };

/**
 * Validates the type chosen in the add/edit form. A free-text legacy value (for example
 * "Pantech") is never mapped to a class: it is either kept as-is on request or replaced
 * by an explicit class / unclassified.
 */
export function parseVehicleTypeInput(raw: string): VehicleTypeInput {
  const value = raw.trim();
  if (value === KEEP_CURRENT_TYPE) return { ok: true, vehicleType: null, unchanged: true };
  if (!isAllowedVehicleType(value)) return { ok: false, message: "Vehicle type must be HR, MR, Small or Other / Unclassified." };
  return { ok: true, vehicleType: value || null, unchanged: false };
}
