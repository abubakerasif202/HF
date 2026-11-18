import { adelaideDay } from "./admin/dates.ts";

export interface DispatchBooking {
  id: string;
  startsAt: string;
  /** Missing finish times are possible in imported/legacy data; conflicts involving one are "possible". */
  endsAt: string | null;
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

export type ConflictCertainty = "definite" | "possible";

export interface DispatchConflict {
  bookingId: string;
  otherId: string;
  kind: "crew" | "truck" | "calendar";
  /** "possible" when either side has no finish time, so the overlap is inferred. */
  certainty: ConflictCertainty;
}

export const LIVE_STATUSES = new Set(["held", "pending_payment", "confirmed", "assigned", "in_progress"]);

interface Window {
  startsAt: string;
  endsAt: string | null;
  durationMinutes?: number | null;
}

/**
 * Overlap test that never silently drops a job with no finish time. A missing
 * end is estimated from the recorded duration (or treated as a point in time
 * when even that is unknown) and any resulting overlap is flagged "possible".
 */
export function overlapCertainty(a: Window, b: Window): ConflictCertainty | null {
  const aStart = Date.parse(a.startsAt);
  const bStart = Date.parse(b.startsAt);
  if (!Number.isFinite(aStart) || !Number.isFinite(bStart)) return null;
  const aReal = a.endsAt ? Date.parse(a.endsAt) : Number.NaN;
  const bReal = b.endsAt ? Date.parse(b.endsAt) : Number.NaN;
  const aKnown = Number.isFinite(aReal);
  const bKnown = Number.isFinite(bReal);
  const aEnd = aKnown ? aReal : aStart + Math.max(0, a.durationMinutes ?? 0) * 60_000;
  const bEnd = bKnown ? bReal : bStart + Math.max(0, b.durationMinutes ?? 0) * 60_000;
  const certainty: ConflictCertainty = aKnown && bKnown ? "definite" : "possible";
  if (aEnd <= aStart) {
    // A job whose end is unknown but which starts while the other is running.
    return bStart <= aStart && (aStart < bEnd || (bEnd <= bStart && aStart === bStart)) ? "possible" : null;
  }
  if (bEnd <= bStart) {
    return aStart <= bStart && bStart < aEnd ? "possible" : null;
  }
  return aStart < bEnd && bStart < aEnd ? certainty : null;
}

function overlaps(a: Window, b: Window): boolean {
  return overlapCertainty(a, b) !== null;
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
      if (!other) continue;
      const certainty = overlapCertainty(current, other);
      if (!certainty) continue;
      if (current.crewId && current.crewId === other.crewId) {
        conflicts.push({ bookingId: current.id, otherId: other.id, kind: "crew", certainty });
      }
      if (current.vehicleIds.some((vehicleId) => other.vehicleIds.includes(vehicleId))) {
        conflicts.push({ bookingId: current.id, otherId: other.id, kind: "truck", certainty });
      }
    }
    for (const reservation of reservations) {
      if (reservation.status === "cancelled" || !reservation.startsAt) continue;
      const certainty = overlapCertainty(current, { startsAt: reservation.startsAt, endsAt: reservation.endsAt });
      if (certainty) conflicts.push({ bookingId: current.id, otherId: reservation.id, kind: "calendar", certainty });
    }
  }
  return conflicts;
}

export const conflictKindLabel = (kind: DispatchConflict["kind"]): string =>
  kind === "calendar" ? "Calendar overlap" : kind === "truck" ? "Truck double-booked" : "Crew double-booked";

/** "Possible truck double-booked" style label used wherever a conflict is shown. */
export function conflictLabel(conflict: Pick<DispatchConflict, "kind" | "certainty">): string {
  const base = conflictKindLabel(conflict.kind);
  return conflict.certainty === "possible" ? `Possible: ${base.charAt(0).toLowerCase()}${base.slice(1)}` : base;
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
        !reservations.some((reservation) => reservation.status !== "cancelled" && reservation.startsAt && overlaps(booking, { startsAt: reservation.startsAt, endsAt: reservation.endsAt })),
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

/** Statuses for work HF is actually going to run (held = a customer still mid-wizard, so excluded). */
export const WORK_STATUSES: readonly string[] = ["pending_payment", "confirmed", "assigned", "in_progress"];

export interface QueueBooking extends DispatchTruckAssignment {
  id: string;
  booking_status: string;
  starts_at: string;
}

export interface DispatchQueues<T> {
  /** Adelaide calendar date the queues were computed for. */
  todayYmd: string;
  today: T[];
  upcoming: T[];
  needsAllocation: T[];
}

/**
 * Splits bookings into the three lists staff work from. "Today" and "upcoming"
 * follow Australia/Adelaide calendar days (so a 23/25-hour DST day is handled
 * by the zone, never by adding 24h); the allocation queue is every job from
 * today onward that still lacks a crew or some of its trucks.
 */
export function selectDispatchQueues<T extends QueueBooking>(rows: readonly T[], now: Date = new Date(), upcomingDays = 14): DispatchQueues<T> {
  const today = adelaideDay(0, now);
  const horizon = adelaideDay(upcomingDays + 1, now);
  const byStart = (a: T, b: T) => a.starts_at.localeCompare(b.starts_at) || a.id.localeCompare(b.id);
  const startMs = (row: T) => Date.parse(row.starts_at);
  const todayStart = Date.parse(today.start);
  const todayEnd = Date.parse(today.end);
  const horizonEnd = Date.parse(horizon.start);

  const isWork = (row: T) => WORK_STATUSES.includes(row.booking_status);
  return {
    todayYmd: today.ymd,
    today: rows.filter((row) => (isWork(row) || row.booking_status === "completed") && startMs(row) >= todayStart && startMs(row) < todayEnd).sort(byStart),
    upcoming: rows.filter((row) => isWork(row) && startMs(row) >= todayEnd && startMs(row) < horizonEnd).sort(byStart),
    needsAllocation: rows.filter((row) => isWork(row) && startMs(row) >= todayStart && needsDispatchAllocation(row)).sort(byStart),
  };
}
