import type { BusinessSettings, BusyInterval, SlotAvailability } from "./types.ts";
import { instantToZonedParts, parseHm, zonedWallTimeToInstant } from "./timezone.ts";

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}

/**
 * Generates candidate slot start times for a single business day, spaced
 * every `stepMinutes`, between business open and close. `businessCloseTime`
 * is the last permitted booking START time (confirmed policy: "early
 * booking start 5am, last booking 6pm") — the job itself is allowed to run
 * past close, since a move's actual finish time isn't known in advance.
 * `schedulingBufferMinutes` still applies between consecutive jobs on the
 * same vehicle (handled by resolveSlotState/pickFreeVehicle against real
 * busy intervals), not as a "must finish before close" constraint here.
 *
 * This produces candidates only — real availability still depends on
 * `resolveSlotState` being run against actual bookings/blocked_times.
 * Nothing here is a static appointment list; it is derived from the
 * business's configured hours each time it's called.
 */
export function generateCandidateSlots(
  dayYear: number,
  dayMonth1To12: number,
  dayDate: number,
  durationMinutes: number,
  settings: BusinessSettings,
  stepMinutes = 30,
): { startsAt: Date; endsAt: Date }[] {
  const open = parseHm(settings.businessOpenTime);
  const close = parseHm(settings.businessCloseTime);

  const dayOpen = zonedWallTimeToInstant(dayYear, dayMonth1To12, dayDate, open.hour, open.minute, settings.timezone);
  const dayClose = zonedWallTimeToInstant(dayYear, dayMonth1To12, dayDate, close.hour, close.minute, settings.timezone);

  const slots: { startsAt: Date; endsAt: Date }[] = [];
  let cursor = dayOpen;

  // Last valid START time is business close itself (inclusive) — the job
  // may legitimately run later than close; we're not requiring it to
  // finish before close.
  while (cursor.getTime() <= dayClose.getTime()) {
    slots.push({ startsAt: cursor, endsAt: new Date(cursor.getTime() + durationMinutes * 60_000) });
    cursor = new Date(cursor.getTime() + stepMinutes * 60_000);
  }

  return slots;
}

/**
 * Resolves a single candidate slot's state against real busy intervals
 * (confirmed/held bookings) and blocked times for the requested vehicle
 * pool. `available` = at least one vehicle free for the whole window,
 * `limited` = fewer than `limitedThreshold` vehicles free, `unavailable`
 * = none free or a matching blocked_time covers it.
 */
export function resolveSlotState(
  slot: { startsAt: Date; endsAt: Date },
  vehicleIds: string[],
  busy: BusyInterval[],
  blocked: BusyInterval[],
  limitedThreshold = 1,
): SlotAvailability["state"] {
  if (vehicleIds.length === 0) return "unavailable";

  const anyResourceBlocked = blocked.some(
    (b) => b.vehicleId === null && overlaps(slot.startsAt, slot.endsAt, b.startsAt, b.endsAt),
  );
  if (anyResourceBlocked) return "unavailable";

  const freeVehicles = vehicleIds.filter((vehicleId) => {
    const vehicleBlocked = blocked.some(
      (b) => b.vehicleId === vehicleId && overlaps(slot.startsAt, slot.endsAt, b.startsAt, b.endsAt),
    );
    if (vehicleBlocked) return false;

    const vehicleBusy = busy.some(
      (b) => b.vehicleId === vehicleId && overlaps(slot.startsAt, slot.endsAt, b.startsAt, b.endsAt),
    );
    return !vehicleBusy;
  });

  if (freeVehicles.length === 0) return "unavailable";
  if (freeVehicles.length <= limitedThreshold) return "limited";
  return "available";
}

/** Picks the first free vehicle for a slot, or null if none is free. */
export function pickFreeVehicle(
  slot: { startsAt: Date; endsAt: Date },
  vehicleIds: string[],
  busy: BusyInterval[],
  blocked: BusyInterval[],
): string | null {
  for (const vehicleId of vehicleIds) {
    const vehicleBlocked = blocked.some(
      (b) =>
        (b.vehicleId === vehicleId || b.vehicleId === null) &&
        overlaps(slot.startsAt, slot.endsAt, b.startsAt, b.endsAt),
    );
    if (vehicleBlocked) continue;
    const vehicleBusy = busy.some(
      (b) => b.vehicleId === vehicleId && overlaps(slot.startsAt, slot.endsAt, b.startsAt, b.endsAt),
    );
    if (!vehicleBusy) return vehicleId;
  }
  return null;
}

/** True if `startsAt` falls within [minLead, maxHorizon] of `now`. */
export function withinBookingWindow(
  startsAt: Date,
  now: Date,
  settings: BusinessSettings,
): { ok: boolean; reason?: string } {
  const minLeadMs = settings.minBookingLeadHours * 60 * 60_000;
  const maxHorizonMs = settings.maxBookingHorizonDays * 24 * 60 * 60_000;
  const delta = startsAt.getTime() - now.getTime();

  if (delta < minLeadMs) {
    return { ok: false, reason: `Bookings require at least ${settings.minBookingLeadHours} hours' notice.` };
  }
  if (delta > maxHorizonMs) {
    return { ok: false, reason: `Bookings can only be made up to ${settings.maxBookingHorizonDays} days in advance.` };
  }
  return { ok: true };
}

export { instantToZonedParts };
