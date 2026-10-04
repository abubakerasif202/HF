import { findMovingPackage, formatAud, formatTonnage } from "./site-data.ts";
import type { PricingSnapshot } from "./booking/types.ts";

export interface BookedPackageDisplay {
  /** e.g. "HR Truck — 16 Ton"; the frozen snapshot name for older snapshots; null when unknown. */
  packageLine: string | null;
  /** e.g. "2 Men"; only for package-keyed (post truck-package) snapshots, null for older ones. */
  crewLine: string | null;
  /** e.g. "$79 / 30 min", derived from the frozen ratePer30MinCents; only for package-keyed snapshots. */
  rateLine: string | null;
}

/**
 * Customer/staff-facing description of the package a booking was made for, taken
 * from its frozen pricing_snapshot (never from live pricing). Snapshots from before
 * the truck packages have no packageId; they keep their stored package name exactly
 * as booked and get no extra crew/rate lines, so their output is unchanged.
 */
export function describeBookedPackage(
  snapshot: Pick<PricingSnapshot, "package" | "packageId" | "truckClass" | "truckName" | "truckTonnage" | "crewSize" | "ratePer30MinCents"> | null | undefined,
  context: { packageId?: string | null; crewSize?: number | null } = {},
): BookedPackageDisplay {
  const snap = snapshot ?? {};
  const packageId = snap.packageId ?? context.packageId ?? null;
  const known = packageId ? findMovingPackage({ id: packageId }) : undefined;
  const isPackageKeyed = packageId !== null;

  const name = snap.package ?? known?.name ?? null;
  const tonnage = snap.truckTonnage ?? known?.tonnage ?? null;
  const isTruck = Boolean(snap.truckName || snap.truckClass || known?.truckClass);

  const packageLine = name && isTruck && tonnage ? `${snap.truckName ?? name} — ${formatTonnage(tonnage)}` : name;
  const crewSize = snap.crewSize ?? context.crewSize ?? null;

  return {
    packageLine,
    crewLine: isPackageKeyed && crewSize ? `${crewSize} Men` : null,
    rateLine: isPackageKeyed && snap.ratePer30MinCents ? `${formatAud(snap.ratePer30MinCents)} / 30 min` : null,
  };
}
