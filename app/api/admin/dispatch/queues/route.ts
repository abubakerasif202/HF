import "server-only";
import { NextResponse } from "next/server";
import { getAdminAuthState } from "../../../../../lib/server/supabase-ssr.ts";
import { getSupabaseAdmin } from "../../../../../lib/server/supabase.ts";
import { adelaideDay } from "../../../../../lib/admin/dates.ts";
import { resolveBookingContact } from "../../../../../lib/booking/contact.ts";
import { selectDispatchQueues, WORK_STATUSES } from "../../../../../lib/dispatch.ts";
import { addressLabel } from "../../../../../lib/booking-finder.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const privateHeaders = { "Cache-Control": "private, no-store, max-age=0" };
/** Beyond this, "awaiting assignment" is planning rather than dispatch. */
const ALLOCATION_HORIZON_DAYS = 60;

interface QueueRow {
  id: string;
  booking_number: string;
  booking_status: string;
  starts_at: string;
  ends_at: string | null;
  crew_id: string | null;
  vehicle_id: string | null;
  dispatch_additional_vehicle_ids: string[];
  dispatch_truck_count: number | null;
  pickup_address: unknown;
  destination_address: unknown;
  contact_name?: string | null;
  contact_email?: string | null;
  customers: { name: string | null } | Array<{ name: string | null }> | null;
}

/** Today / upcoming / awaiting crew-or-truck lists for Dispatch, owner-only. */
export async function GET() {
  const auth = await getAdminAuthState();
  if (auth.status !== "authorized") {
    const status = auth.status === "forbidden" ? 403 : 401;
    return NextResponse.json({ error: status === 403 ? "Forbidden" : "Not authorized" }, { status, headers: privateHeaders });
  }
  try {
    const now = new Date();
    const from = adelaideDay(0, now).start;
    const to = adelaideDay(ALLOCATION_HORIZON_DAYS, now).end;
    const admin = getSupabaseAdmin();
    const [bookings, crews, vehicles] = await Promise.all([
      admin.from("bookings")
        .select("id, booking_number, booking_status, starts_at, ends_at, crew_id, vehicle_id, dispatch_additional_vehicle_ids, dispatch_truck_count, pickup_address, destination_address, contact_name, contact_email, customers(name)")
        .in("booking_status", [...WORK_STATUSES, "completed"]).gte("starts_at", from).lt("starts_at", to).order("starts_at").limit(500),
      admin.from("crews").select("id, name"),
      admin.from("vehicles").select("id, name"),
    ]);
    if (bookings.error) throw bookings.error;
    if (crews.error) throw crews.error;
    if (vehicles.error) throw vehicles.error;

    const crewNames = new Map(((crews.data ?? []) as Array<{ id: string; name: string }>).map((c) => [c.id, c.name]));
    const truckNames = new Map(((vehicles.data ?? []) as Array<{ id: string; name: string }>).map((v) => [v.id, v.name]));
    const queues = selectDispatchQueues((bookings.data ?? []) as unknown as QueueRow[], now);
    const shape = (row: QueueRow) => {
      const customer = resolveBookingContact(row);
      const trucks = [...(row.vehicle_id ? [row.vehicle_id] : []), ...(row.dispatch_additional_vehicle_ids ?? [])];
      return {
        id: row.id, bookingNumber: row.booking_number, status: row.booking_status, startsAt: row.starts_at, endsAt: row.ends_at,
        customerName: customer?.name ?? null, pickup: addressLabel(row.pickup_address), destination: addressLabel(row.destination_address),
        crewName: row.crew_id ? (crewNames.get(row.crew_id) ?? "Crew") : null,
        truckNames: trucks.map((id) => truckNames.get(id) ?? "Truck"),
        trucksRequired: row.dispatch_truck_count,
        needsCrew: !row.crew_id,
        needsTruck: trucks.length < (row.dispatch_truck_count ?? 1),
      };
    };
    return NextResponse.json({
      todayYmd: queues.todayYmd,
      today: queues.today.map(shape),
      upcoming: queues.upcoming.map(shape),
      needsAllocation: queues.needsAllocation.map(shape),
    }, { headers: privateHeaders });
  } catch (error) {
    console.error("HF dispatch queues failed:", (error as { code?: unknown })?.code ?? "unknown");
    return NextResponse.json({ error: "Dispatch queues are unavailable." }, { status: 503, headers: privateHeaders });
  }
}
