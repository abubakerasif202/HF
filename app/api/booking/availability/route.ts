import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withBookingSystemGuard, jsonError } from "../../../../lib/server/api-helpers.ts";
import { enforceRateLimit } from "../../../../lib/server/rate-limit.ts";
import { getBusinessSettings, getPricingRule, getActiveVehicles, getBusyIntervals, getBlockedIntervals } from "../../../../lib/server/booking-repo.ts";
import { compatibleVehicleIds } from "../../../../lib/booking/vehicles.ts";
import { resolveRequestedPackage } from "../../../../lib/booking/package-request.ts";
import { generateCandidateSlots, resolveSlotState, withinBookingWindow } from "../../../../lib/booking/availability.ts";
import { zonedWallTimeToInstant } from "../../../../lib/booking/timezone.ts";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  packageId: z.string().min(1).max(64).optional(),
  crewSize: z.coerce.number().int().min(1).max(10).optional(),
  durationMinutes: z.coerce.number().int().min(30).max(600).optional(),
});

/**
 * GET /api/booking/availability?date=2026-04-05&packageId=hr-16t-2men
 *
 * Returns real, server-computed availability for one calendar day — never
 * a static slot list. Each slot's state is derived live from
 * business_settings, active vehicles, current live bookings and
 * blocked_times.
 */
export async function GET(request: NextRequest) {
  return withBookingSystemGuard(async () => {
    const limited = await enforceRateLimit(request, "availability");
    if (limited) return limited;

    const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
    if (!parsed.success) {
      return jsonError(400, "Invalid query", { issues: parsed.error.issues });
    }
    const { date } = parsed.data;
    const requested = resolveRequestedPackage({ packageId: parsed.data.packageId, crewSize: parsed.data.crewSize ?? (parsed.data.packageId ? null : 2) });
    if (!requested.ok) return jsonError(400, requested.message);

    const settings = await getBusinessSettings();
    const durationMinutes = parsed.data.durationMinutes ?? settings.defaultEstimatedDurationMinutes;

    const [year, month, day] = date.split("-").map(Number);
    const dayStart = zonedWallTimeToInstant(year, month, day, 0, 0, settings.timezone);
    const dayEnd = zonedWallTimeToInstant(year, month, day, 23, 59, settings.timezone);

    const [fleet, busy, blocked] = await Promise.all([
      getActiveVehicles(),
      getBusyIntervals(dayStart, dayEnd),
      getBlockedIntervals(dayStart, dayEnd),
    ]);

    // Only vehicles that suit the chosen truck can take the job, so a Small Truck
    // booking is never offered (or assigned) an HR vehicle and vice versa.
    const vehicleIds = compatibleVehicleIds(requested.packageId, fleet);
    const candidates = generateCandidateSlots(year, month, day, durationMinutes, settings, 30);
    const now = new Date();

    const slots = candidates.map((slot) => {
      const window = withinBookingWindow(slot.startsAt, now, settings);
      const state = window.ok ? resolveSlotState(slot, vehicleIds, busy, blocked, 1) : "unavailable";
      return {
        startsAt: slot.startsAt.toISOString(),
        endsAt: slot.endsAt.toISOString(),
        state,
        reason: window.ok ? undefined : window.reason,
      };
    });

    const rule = await getPricingRule({ packageId: requested.packageId, crewSize: requested.crewSize });

    return NextResponse.json({
      date,
      timezone: settings.timezone,
      packageId: requested.packageId,
      crewSize: requested.crewSize,
      durationMinutes,
      pricingConfigured: Boolean(rule),
      hasCompatibleVehicle: vehicleIds.length > 0,
      slots,
    });
  });
}
