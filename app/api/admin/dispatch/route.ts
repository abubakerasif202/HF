import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminAuthState } from "../../../../lib/server/supabase-ssr.ts";
import { reconcileBookingCalendar } from "../../../../lib/server/google-calendar.ts";
import { getSupabaseAdmin } from "../../../../lib/server/supabase.ts";
import { getBusinessSettings } from "../../../../lib/server/booking-repo.ts";
import { findClashingBookings } from "../../../../lib/server/booking-conflicts.ts";
import { zonedWallTimeToInstant } from "../../../../lib/booking/timezone.ts";
import { effectiveDispatchTruckCount, findDispatchConflicts, suggestCrewAllocation, type CalendarReservation, type DispatchBooking } from "../../../../lib/dispatch.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const privateHeaders = { "Cache-Control": "private, no-store, max-age=0" };
const querySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  crewId: z.string().uuid().optional(),
  status: z.enum(["draft", "held", "pending_payment", "confirmed", "assigned", "in_progress", "completed", "cancelled", "expired"]).optional(),
  truckCount: z.coerce.number().int().min(1).max(4).optional(),
});
const patchSchema = z.object({
  bookingId: z.string().uuid(),
  crewId: z.string().uuid().nullable().optional(),
  vehicleId: z.string().uuid().nullable().optional(),
  additionalVehicleIds: z.array(z.string().uuid()).max(3).refine((ids) => new Set(ids).size === ids.length, "Truck assignments must be unique.").optional(),
  truckCount: z.number().int().min(1).max(4).nullable().optional(),
  travelMinutes: z.number().int().min(0).max(1440).nullable().optional(),
  overnight: z.boolean().nullable().optional(),
  truckLeftOnsite: z.boolean().nullable().optional(),
  pricingType: z.enum(["fixed", "hourly"]).nullable().optional(),
  fixedPriceCents: z.number().int().min(0).nullable().optional(),
  customerRequirements: z.array(z.string().trim().min(1).max(500)).max(30).optional(),
  checklist: z.array(z.object({ id: z.string().min(1).max(80), label: z.string().trim().min(1).max(200), done: z.boolean() }).strict()).max(80).optional(),
  customerNotes: z.string().max(3000).nullable().optional(),
  internalNotes: z.string().max(5000).nullable().optional(),
  startsAt: z.string().datetime({ offset: true }).optional(),
  endsAt: z.string().datetime({ offset: true }).optional(),
  durationMinutes: z.number().int().min(1).max(1440).optional(),
}).strict().refine((data) => Object.keys(data).some((key) => key !== "bookingId"), "Provide at least one field to update.")
  .refine((data) => (data.startsAt === undefined) === (data.endsAt === undefined), "Provide both startsAt and endsAt.");

export async function GET(request: NextRequest) {
  if (new URL(request.url).origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400, headers: privateHeaders });
  }
  const auth = await getAdminAuthState();
  if (auth.status !== "authorized") {
    const status = auth.status === "forbidden" ? 403 : 401;
    return NextResponse.json({ error: status === 403 ? "Forbidden" : "Not authorized" }, { status, headers: privateHeaders });
  }

  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid dispatch filters." }, { status: 400, headers: privateHeaders });

  try {
    const { date, crewId, status, truckCount } = parsed.data;
    const dateParts = date.split("-").map(Number);
    const [year, month, day] = dateParts;
    if (!year || !month || !day || new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) !== date) {
      return NextResponse.json({ error: "Invalid dispatch date." }, { status: 400, headers: privateHeaders });
    }
    const nextDate = new Date(Date.parse(`${date}T00:00:00.000Z`) + 24 * 60 * 60_000).toISOString().slice(0, 10);
    const settings = await getBusinessSettings();
    const dayStart = zonedWallTimeToInstant(year, month, day, 0, 0, settings.timezone);
    const nextDay = zonedWallTimeToInstant(year, month, day + 1, 0, 0, settings.timezone);
    const [bookingsResult, crewsResult, importsResult, vehiclesResult] = await Promise.all([
      getSupabaseAdmin().from("bookings")
        .select("id, booking_number, booking_status, starts_at, ends_at, estimated_duration_minutes, crew_size, crew_id, vehicle_id, dispatch_additional_vehicle_ids, dispatch_truck_count, dispatch_travel_minutes, dispatch_overnight, dispatch_truck_left_onsite, dispatch_pricing_type, dispatch_fixed_price_cents, dispatch_customer_requirements, dispatch_checklist, calendar_sync_status, calendar_sync_error, google_calendar_event_id, customer_notes, internal_notes, pickup_address, destination_address, customers(name, phone)")
        .lt("starts_at", nextDay.toISOString()).gt("ends_at", dayStart.toISOString()).order("starts_at"),
      getSupabaseAdmin().from("crews").select("id, name").eq("active", true).order("name"),
      getSupabaseAdmin().from("google_calendar_imports")
        .select("id, summary, starts_at, ends_at, all_day_start, all_day_end, event_status")
        .in("event_status", ["confirmed", "tentative"])
        .or(`and(starts_at.lt.${nextDay.toISOString()},ends_at.gt.${dayStart.toISOString()}),and(all_day_start.lt.${nextDate},all_day_end.gt.${date})`),
      getSupabaseAdmin().from("vehicles").select("id, name, vehicle_type").eq("active", true).order("name"),
    ]);
    if (vehiclesResult.error) throw vehiclesResult.error;
    if (bookingsResult.error) throw bookingsResult.error;
    if (crewsResult.error) throw crewsResult.error;
    if (importsResult.error) throw importsResult.error;

    const calendarReservations: CalendarReservation[] = (importsResult.data ?? []).map((event) => {
      const startsAt = event.starts_at ?? (event.all_day_start
        ? zonedWallTimeToInstant(...event.all_day_start.split("-").map(Number) as [number, number, number], 0, 0, settings.timezone).toISOString()
        : null);
      const endsAt = event.ends_at ?? (event.all_day_end
        ? zonedWallTimeToInstant(...event.all_day_end.split("-").map(Number) as [number, number, number], 0, 0, settings.timezone).toISOString()
        : null);
      return { id: event.id, summary: event.summary, startsAt, endsAt, status: event.event_status };
    });
    // Every job on the day (before the staff filters) so a conflict can always name the other booking.
    const bookingIndex = Object.fromEntries((bookingsResult.data ?? []).map((booking) => {
      const customer = Array.isArray(booking.customers) ? booking.customers[0] : booking.customers;
      return [booking.id, { bookingNumber: booking.booking_number, customerName: customer?.name ?? null, startsAt: booking.starts_at, endsAt: booking.ends_at }];
    }));
    const allBookings: DispatchBooking[] = (bookingsResult.data ?? []).map((booking) => ({
      id: booking.id,
      startsAt: booking.starts_at,
      endsAt: booking.ends_at,
      durationMinutes: booking.estimated_duration_minutes,
      status: booking.booking_status,
      crewId: booking.crew_id,
      vehicleIds: [...(booking.vehicle_id ? [booking.vehicle_id] : []), ...(booking.dispatch_additional_vehicle_ids ?? [])],
    }));
    const conflicts = findDispatchConflicts(allBookings, calendarReservations);
    const suggestions = suggestCrewAllocation(allBookings, crewsResult.data ?? [], calendarReservations);
    const bookings = (bookingsResult.data ?? []).filter((booking) =>
      (!crewId || booking.crew_id === crewId) &&
      (!status || booking.booking_status === status) &&
      (!truckCount || effectiveDispatchTruckCount(booking) === truckCount),
    );

    const visibleIds = new Set(bookings.map((booking) => booking.id));
    return NextResponse.json({ date, timezone: settings.timezone, bookings, bookingIndex, calendarReservations, conflicts: conflicts.filter((item) => visibleIds.has(item.bookingId) || visibleIds.has(item.otherId)), suggestions: suggestions.filter((item) => visibleIds.has(item.bookingId)), crews: crewsResult.data ?? [], vehicles: vehiclesResult.data ?? [] }, { headers: privateHeaders });
  } catch (error) {
    console.error("HF daily dispatch query failed:", (error as { code?: unknown })?.code ?? "unknown");
    return NextResponse.json({ error: "Daily dispatch is unavailable." }, { status: 503, headers: privateHeaders });
  }
}

/** Owner-only dispatch edits. Core booking price and booking status remain untouched. */
export async function PATCH(request: NextRequest) {
  const auth = await getAdminAuthState();
  if (auth.status !== "authorized") {
    const status = auth.status === "forbidden" ? 403 : 401;
    return NextResponse.json({ error: status === 403 ? "Forbidden" : "Not authorized" }, { status, headers: privateHeaders });
  }
  const origin = request.headers.get("origin");
  if (!origin || origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403, headers: privateHeaders });
  }

  try {
    const text = await request.text();
    if (text.length > 16_384) return NextResponse.json({ error: "Request too large" }, { status: 413, headers: privateHeaders });
    const parsed = patchSchema.safeParse(JSON.parse(text));
    if (!parsed.success) return NextResponse.json({ error: "Invalid dispatch update." }, { status: 400, headers: privateHeaders });
    const input = parsed.data;
    if (input.startsAt && input.endsAt && Date.parse(input.endsAt) <= Date.parse(input.startsAt)) {
      return NextResponse.json({ error: "End time must be after start time." }, { status: 400, headers: privateHeaders });
    }
    if (input.vehicleId && input.additionalVehicleIds?.includes(input.vehicleId)) {
      return NextResponse.json({ error: "The primary truck cannot also be an additional truck." }, { status: 400, headers: privateHeaders });
    }
    const admin = getSupabaseAdmin();
    const staffId = auth.session.userId;
    const patch: Record<string, unknown> = {};
    const map: Array<[keyof typeof input, string]> = [
      ["crewId", "crew_id"], ["vehicleId", "vehicle_id"], ["additionalVehicleIds", "dispatch_additional_vehicle_ids"],
      ["truckCount", "dispatch_truck_count"], ["travelMinutes", "dispatch_travel_minutes"], ["overnight", "dispatch_overnight"],
      ["truckLeftOnsite", "dispatch_truck_left_onsite"], ["pricingType", "dispatch_pricing_type"],
      ["fixedPriceCents", "dispatch_fixed_price_cents"], ["customerRequirements", "dispatch_customer_requirements"],
      ["checklist", "dispatch_checklist"], ["customerNotes", "customer_notes"], ["internalNotes", "internal_notes"],
      ["startsAt", "starts_at"], ["endsAt", "ends_at"], ["durationMinutes", "estimated_duration_minutes"],
    ];
    for (const [key, column] of map) {
      if (input[key] !== undefined) patch[column] = input[key] ?? null;
    }
    const { data: updated, error: updateError } = await admin.rpc("update_dispatch_booking", { p_booking_id: input.bookingId, p_patch: patch, p_actor: staffId });
    if (updateError) {
      if (updateError.code === "23P01") {
        // Name the booking it clashes with so staff can open it. Best effort only.
        let conflicts: Array<{ id: string; bookingNumber: string; kind: "crew" | "truck" }> = [];
        try {
          const { data: current } = await admin.from("bookings").select("starts_at, ends_at, crew_id, vehicle_id, dispatch_additional_vehicle_ids").eq("id", input.bookingId).maybeSingle();
          if (current) {
            conflicts = await findClashingBookings({
              bookingId: input.bookingId,
              startsAt: input.startsAt ?? current.starts_at,
              endsAt: input.endsAt ?? current.ends_at,
              crewId: input.crewId !== undefined ? input.crewId : current.crew_id,
              vehicleIds: [
                ...((input.vehicleId !== undefined ? input.vehicleId : current.vehicle_id) ? [(input.vehicleId !== undefined ? input.vehicleId : current.vehicle_id) as string] : []),
                ...(input.additionalVehicleIds ?? current.dispatch_additional_vehicle_ids ?? []),
              ],
            });
          }
        } catch {
          conflicts = [];
        }
        const named = conflicts.length ? ` Clashes with ${conflicts.map((item) => `${item.bookingNumber} (${item.kind})`).join(", ")}.` : "";
        return NextResponse.json({ error: `This crew or truck is already assigned during that time.${named}`, conflicts }, { status: 409, headers: privateHeaders });
      }
      if (updateError.code === "23503" || updateError.code === "23514") return NextResponse.json({ error: "One or more assignments are invalid." }, { status: 400, headers: privateHeaders });
      throw updateError;
    }

    if (!updated) return NextResponse.json({ error: "Booking not found." }, { status: 404, headers: privateHeaders });
    try {
      await reconcileBookingCalendar(input.bookingId);
    } catch (calendarError) {
      console.error("HF dispatch saved; Calendar reconciliation pending:", (calendarError as { code?: unknown })?.code ?? "unknown");
      return NextResponse.json({ updated: true, calendarSync: "pending", warning: "Dispatch saved. Google Calendar reconciliation is pending; retry sync from the booking detail." }, { headers: privateHeaders });
    }
    return NextResponse.json({ updated: true }, { headers: privateHeaders });
  } catch (error) {
    console.error("HF dispatch update failed:", (error as { code?: unknown })?.code ?? "unknown");
    return NextResponse.json({ error: "Dispatch update failed." }, { status: 503, headers: privateHeaders });
  }
}
