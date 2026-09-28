import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withBookingSystemGuard, jsonError } from "../../../../lib/server/api-helpers.ts";
import { enforceRateLimit } from "../../../../lib/server/rate-limit.ts";
import { getBusinessSettings, getPricingRule, getActiveVehicleIds, getBusyIntervals, getBlockedIntervals } from "../../../../lib/server/booking-repo.ts";
import { generateCandidateSlots, resolveSlotState, withinBookingWindow } from "../../../../lib/booking/availability.ts";
import { zonedWallTimeToInstant } from "../../../../lib/booking/timezone.ts";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  crewSize: z.coerce.number().int().min(1).max(10).default(2),
  durationMinutes: z.coerce.number().int().min(30).max(600).optional(),
});

/**
 * GET /api/booking/availability?date=2026-04-05&crewSize=2
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
    const { date, crewSize } = parsed.data;

    const settings = await getBusinessSettings();
    const durationMinutes = parsed.data.durationMinutes ?? settings.defaultEstimatedDurationMinutes;

    const [year, month, day] = date.split("-").map(Number);
    const dayStart = zonedWallTimeToInstant(year, month, day, 0, 0, settings.timezone);
    const dayEnd = zonedWallTimeToInstant(year, month, day, 23, 59, settings.timezone);

    const [vehicleIds, busy, blocked] = await Promise.all([
      getActiveVehicleIds(),
      getBusyIntervals(dayStart, dayEnd),
      getBlockedIntervals(dayStart, dayEnd),
    ]);

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

    const rule = await getPricingRule(crewSize);

    return NextResponse.json({
      date,
      timezone: settings.timezone,
      crewSize,
      durationMinutes,
      pricingConfigured: Boolean(rule),
      slots,
    });
  });
}
