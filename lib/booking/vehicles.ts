import { findMovingPackage, truckClassForVehicleType } from "../site-data.ts";

export interface FleetVehicle {
  id: string;
  vehicleType: string | null;
}

/**
 * Vehicle ids that can serve a package. A truck package (HR / MR / Small) only
 * matches vehicles whose type resolves to that truck class — a Small Truck booking
 * must never be handed a random active vehicle. Packages with no truck class (the
 * 3-mover crew upgrade and historical bookings) accept any active vehicle.
 */
export function compatibleVehicleIds(packageId: string | null | undefined, vehicles: readonly FleetVehicle[]): string[] {
  const truckClass = packageId ? findMovingPackage({ id: packageId })?.truckClass ?? null : null;
  if (!truckClass) return vehicles.map((vehicle) => vehicle.id);
  return vehicles.filter((vehicle) => truckClassForVehicleType(vehicle.vehicleType) === truckClass).map((vehicle) => vehicle.id);
}
