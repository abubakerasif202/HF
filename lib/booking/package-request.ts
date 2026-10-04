import { findMovingPackage, isBookablePackageId } from "../site-data.ts";

export type PackageRequest = { packageId?: string | null; crewSize?: number | null };

export type ResolvedPackage =
  | { ok: true; packageId: string; crewSize: number; truckClass: string | null; name: string }
  | { ok: false; message: string };

/**
 * Turns whatever the browser sent into a trusted package identity. The package id is
 * authoritative: crew size and truck class are always derived from the canonical
 * table, never taken from the request. A request with only a crew size comes from a
 * client built before truck options existed and resolves to the legacy package.
 */
export function resolveRequestedPackage(request: PackageRequest): ResolvedPackage {
  if (request.packageId) {
    if (!isBookablePackageId(request.packageId)) return { ok: false, message: "That package isn't available for online booking." };
    const pkg = findMovingPackage({ id: request.packageId });
    if (!pkg) return { ok: false, message: "That package isn't available for online booking." };
    if (request.crewSize != null && request.crewSize !== pkg.crewSize) return { ok: false, message: "The crew size doesn't match the selected package." };
    return { ok: true, packageId: pkg.id, crewSize: pkg.crewSize, truckClass: pkg.truckClass, name: pkg.name };
  }
  if (request.crewSize == null) return { ok: false, message: "Please choose a truck." };
  const pkg = findMovingPackage({ crewSize: request.crewSize });
  if (!pkg) return { ok: false, message: "That package isn't available for online booking." };
  return { ok: true, packageId: pkg.id, crewSize: pkg.crewSize, truckClass: pkg.truckClass, name: pkg.name };
}
