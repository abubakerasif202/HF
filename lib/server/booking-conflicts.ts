import "server-only";
import { getSupabaseAdmin } from "./supabase.ts";
import { resolveBookingContact } from "../booking/contact.ts";
import { conflictLabel, findDispatchConflicts, LIVE_STATUSES, type ConflictCertainty, type DispatchBooking } from "../dispatch.ts";

export interface BookingConflictView {
  kind: "crew" | "truck" | "calendar";
  certainty: ConflictCertainty;
  label: string;
  other: { id: string; bookingNumber: string | null; customerName: string | null; startsAt: string | null; endsAt: string | null; summary: string | null; isBooking: boolean };
}

interface ConflictSubject {
  id: string;
  booking_status: string;
  starts_at: string;
  ends_at: string | null;
  estimated_duration_minutes: number | null;
  crew_id: string | null;
  vehicle_id: string | null;
  dispatch_additional_vehicle_ids: string[] | null;
}

const toDispatch = (b: ConflictSubject): DispatchBooking => ({
  id: b.id, startsAt: b.starts_at, endsAt: b.ends_at, durationMinutes: b.estimated_duration_minutes ?? 0, status: b.booking_status,
  crewId: b.crew_id, vehicleIds: [...(b.vehicle_id ? [b.vehicle_id] : []), ...(b.dispatch_additional_vehicle_ids ?? [])],
});

/**
 * Jobs and calendar events that clash with this booking's own time window
 * (not just its start day, so overnight work is covered). Conflicts that rely
 * on a missing finish time are returned as "possible".
 */
export async function loadBookingConflicts(subject: ConflictSubject): Promise<BookingConflictView[]> {
  if (!LIVE_STATUSES.has(subject.booking_status)) return [];
  const admin = getSupabaseAdmin();
  const windowStart = subject.starts_at;
  const windowEnd = subject.ends_at ?? new Date(Date.parse(subject.starts_at) + Math.max(0, subject.estimated_duration_minutes ?? 0) * 60_000).toISOString();

  const [others, timed, openEnded] = await Promise.all([
    admin.from("bookings")
      .select("id, booking_number, booking_status, starts_at, ends_at, estimated_duration_minutes, crew_id, vehicle_id, dispatch_additional_vehicle_ids, contact_name, contact_email, customers(name)")
      .in("booking_status", [...LIVE_STATUSES]).neq("id", subject.id).lt("starts_at", windowEnd).gt("ends_at", windowStart),
    admin.from("google_calendar_imports").select("id, summary, starts_at, ends_at, event_status")
      .in("event_status", ["confirmed", "tentative"]).lt("starts_at", windowEnd).gt("ends_at", windowStart),
    admin.from("google_calendar_imports").select("id, summary, starts_at, ends_at, event_status")
      .in("event_status", ["confirmed", "tentative"]).is("ends_at", null).gte("starts_at", windowStart).lt("starts_at", windowEnd),
  ]);
  if (others.error) throw others.error;
  if (timed.error) throw timed.error;
  if (openEnded.error) throw openEnded.error;

  type OtherRow = ConflictSubject & { booking_number: string; contact_name?: string | null; contact_email?: string | null; customers: { name?: string | null } | Array<{ name?: string | null }> | null };
  const otherRows = (others.data ?? []) as unknown as OtherRow[];
  const events = [...(timed.data ?? []), ...(openEnded.data ?? [])] as Array<{ id: string; summary: string | null; starts_at: string | null; ends_at: string | null; event_status: string }>;
  const conflicts = findDispatchConflicts(
    [toDispatch(subject), ...otherRows.map(toDispatch)],
    events.map((e) => ({ id: e.id, startsAt: e.starts_at, endsAt: e.ends_at, status: e.event_status })),
  ).filter((c) => c.bookingId === subject.id);

  return conflicts.map((conflict): BookingConflictView => {
    const row = otherRows.find((r) => r.id === conflict.otherId);
    const event = events.find((e) => e.id === conflict.otherId);
    const customer = row ? resolveBookingContact(row) : null;
    return {
      kind: conflict.kind, certainty: conflict.certainty, label: conflictLabel(conflict),
      other: {
        id: conflict.otherId, isBooking: Boolean(row), bookingNumber: row?.booking_number ?? null, customerName: customer?.name ?? null,
        startsAt: row?.starts_at ?? event?.starts_at ?? null, endsAt: row?.ends_at ?? event?.ends_at ?? null, summary: event?.summary ?? null,
      },
    };
  });
}

/**
 * After the database refuses an assignment (exclusion constraint), name the
 * booking(s) it clashes with so staff can open them. Best effort: callers
 * must not depend on it succeeding.
 */
export async function findClashingBookings(input: {
  bookingId: string; startsAt: string; endsAt: string; crewId: string | null; vehicleIds: string[];
}): Promise<Array<{ id: string; bookingNumber: string; kind: "crew" | "truck" }>> {
  const { data, error } = await getSupabaseAdmin().from("bookings")
    .select("id, booking_number, crew_id, vehicle_id, dispatch_additional_vehicle_ids")
    .in("booking_status", [...LIVE_STATUSES]).neq("id", input.bookingId).lt("starts_at", input.endsAt).gt("ends_at", input.startsAt);
  if (error) throw error;
  const clashes: Array<{ id: string; bookingNumber: string; kind: "crew" | "truck" }> = [];
  for (const row of (data ?? []) as Array<{ id: string; booking_number: string; crew_id: string | null; vehicle_id: string | null; dispatch_additional_vehicle_ids: string[] | null }>) {
    if (input.crewId && row.crew_id === input.crewId) clashes.push({ id: row.id, bookingNumber: row.booking_number, kind: "crew" });
    const trucks = [...(row.vehicle_id ? [row.vehicle_id] : []), ...(row.dispatch_additional_vehicle_ids ?? [])];
    if (trucks.some((truck) => input.vehicleIds.includes(truck))) clashes.push({ id: row.id, bookingNumber: row.booking_number, kind: "truck" });
  }
  return clashes;
}
