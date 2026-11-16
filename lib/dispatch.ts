export interface DispatchBooking {
  id: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  status: string;
  crewId: string | null;
  vehicleIds: string[];
}

export interface CalendarReservation {
  id: string;
  startsAt: string | null;
  endsAt: string | null;
  status: string;
}

export interface DispatchCrew {
  id: string;
  name: string;
}

export interface DispatchConflict {
  bookingId: string;
  otherId: string;
  kind: "crew" | "truck" | "calendar";
}

const LIVE_STATUSES = new Set(["held", "pending_payment", "confirmed", "assigned", "in_progress"]);

function overlaps(a: { startsAt: string; endsAt: string }, b: { startsAt: string; endsAt: string }): boolean {
  const aStart = Date.parse(a.startsAt);
  const aEnd = Date.parse(a.endsAt);
  const bStart = Date.parse(b.startsAt);
  const bEnd = Date.parse(b.endsAt);
  return [aStart, aEnd, bStart, bEnd].every(Number.isFinite) && aStart < bEnd && bStart < aEnd;
}

export function findDispatchConflicts(
  bookings: DispatchBooking[],
  reservations: CalendarReservation[],
): DispatchConflict[] {
  const live = bookings.filter((booking) => LIVE_STATUSES.has(booking.status));
  const conflicts: DispatchConflict[] = [];

  for (let i = 0; i < live.length; i += 1) {
    const current = live[i];
    if (!current) continue;
    for (let j = i + 1; j < live.length; j += 1) {
      const other = live[j];
      if (!other || !overlaps(current, other)) continue;
      if (current.crewId && current.crewId === other.crewId) {
        conflicts.push({ bookingId: current.id, otherId: other.id, kind: "crew" });
      }
      if (current.vehicleIds.some((vehicleId) => other.vehicleIds.includes(vehicleId))) {
        conflicts.push({ bookingId: current.id, otherId: other.id, kind: "truck" });
      }
    }
    for (const reservation of reservations) {
      if (reservation.status === "cancelled" || !reservation.startsAt || !reservation.endsAt) continue;
      if (overlaps(current, { startsAt: reservation.startsAt, endsAt: reservation.endsAt })) {
        conflicts.push({ bookingId: current.id, otherId: reservation.id, kind: "calendar" });
      }
    }
  }
  return conflicts;
}

export function suggestCrewAllocation(
  bookings: DispatchBooking[],
  crews: DispatchCrew[],
  reservations: CalendarReservation[],
): Array<{ bookingId: string; crewId: string | null; reason: "balanced" | "conflict" | "no_crew" }> {
  const orderedCrews = [...crews].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const load = new Map(orderedCrews.map((crew) => [crew.id, 0]));
  const assigned = bookings.filter((booking) => LIVE_STATUSES.has(booking.status) && booking.crewId);
  for (const booking of assigned) {
    const current = booking.crewId ? load.get(booking.crewId) : undefined;
    if (current !== undefined) load.set(booking.crewId as string, current + Math.max(0, booking.durationMinutes));
  }

  const occupancy = [...assigned];
  const result: Array<{ bookingId: string; crewId: string | null; reason: "balanced" | "conflict" | "no_crew" }> = [];
  const unassigned = bookings
    .filter((booking) => LIVE_STATUSES.has(booking.status) && !booking.crewId)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id));

  for (const booking of unassigned) {
    if (!orderedCrews.length) {
      result.push({ bookingId: booking.id, crewId: null, reason: "no_crew" });
      continue;
    }
    const candidate = orderedCrews
      .filter((crew) =>
        !occupancy.some((other) => other.crewId === crew.id && overlaps(booking, other)) &&
        !reservations.some((reservation) => reservation.status !== "cancelled" && reservation.startsAt && reservation.endsAt && overlaps(booking, { startsAt: reservation.startsAt, endsAt: reservation.endsAt })),
      )
      .sort((a, b) => (load.get(a.id) ?? 0) - (load.get(b.id) ?? 0) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id))[0];
    if (!candidate) {
      result.push({ bookingId: booking.id, crewId: null, reason: "conflict" });
      continue;
    }
    occupancy.push({ ...booking, crewId: candidate.id });
    load.set(candidate.id, (load.get(candidate.id) ?? 0) + Math.max(0, booking.durationMinutes));
    result.push({ bookingId: booking.id, crewId: candidate.id, reason: "balanced" });
  }
  return result;
}

interface DispatchTruckAssignment {
  crew_id: string | null;
  vehicle_id: string | null;
  dispatch_additional_vehicle_ids: string[];
  dispatch_truck_count: number | null;
}

export function effectiveDispatchTruckCount(booking: DispatchTruckAssignment): number | null {
  const assigned = Number(Boolean(booking.vehicle_id)) + booking.dispatch_additional_vehicle_ids.length;
  return booking.dispatch_truck_count ?? (assigned || null);
}

export function needsDispatchAllocation(booking: DispatchTruckAssignment): boolean {
  const assigned = Number(Boolean(booking.vehicle_id)) + booking.dispatch_additional_vehicle_ids.length;
  return !booking.crew_id || assigned < (effectiveDispatchTruckCount(booking) ?? 1);
}
