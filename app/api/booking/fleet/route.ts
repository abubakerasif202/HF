import { NextRequest, NextResponse } from "next/server";
import { withBookingSystemGuard } from "../../../../lib/server/api-helpers.ts";
import { enforceRateLimit } from "../../../../lib/server/rate-limit.ts";
import { getActiveVehicles } from "../../../../lib/server/booking-repo.ts";
import { compatibleVehicleIds } from "../../../../lib/booking/vehicles.ts";
import { movingPackages } from "../../../../lib/site-data.ts";

export const dynamic = "force-dynamic";

/**
 * GET /api/booking/fleet
 *
 * Which bookable packages currently have at least one compatible active vehicle.
 * Returns package ids only: no vehicle names, ids or configuration details.
 */
export async function GET(request: NextRequest) {
  return withBookingSystemGuard(async () => {
    const limited = await enforceRateLimit(request, "availability");
    if (limited) return limited;

    const fleet = await getActiveVehicles();
    const unavailablePackageIds = movingPackages.filter((pkg) => compatibleVehicleIds(pkg.id, fleet).length === 0).map((pkg) => pkg.id);
    return NextResponse.json({ unavailablePackageIds });
  });
}
