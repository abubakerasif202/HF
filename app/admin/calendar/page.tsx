import { getSupabaseAdmin } from "../../../lib/server/supabase.ts";
import { getBusinessSettings } from "../../../lib/server/booking-repo.ts";
import { getRangeForView, type CalendarView } from "../../../lib/booking/calendar-range.ts";
import { CalendarClient } from "./CalendarClient";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

function todayInTimeZone(timeZone: string): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(new Date())
    .reduce<Record<string, string>>((acc, p) => ({ ...acc, [p.type]: p.value }), {});
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) };
}

export default async function AdminCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string }>;
}) {
  const { view: rawView, date: rawDate } = await searchParams;
  const settings = await getBusinessSettings();
  const today = todayInTimeZone(settings.timezone);

  const view: CalendarView = rawView === "day" || rawView === "month" ? rawView : "week";
  let year = today.year;
  let month = today.month;
  let day = today.day;
  if (rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    const [y, m, d] = rawDate.split("-").map(Number);
    year = y;
    month = m;
    day = d;
  }

  const { start, end } = getRangeForView(view, year, month, day, settings.timezone);
  const supabase = getSupabaseAdmin();

  const [{ data: bookings }, { data: blockedTimes }, { data: vehicles }, { data: crews }] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, booking_number, starts_at, ends_at, booking_status, crew_size, vehicle_id, crew_id, vehicles(name), crews(name), customers(name)")
      .not("booking_status", "in", "(cancelled,expired,draft)")
      .lt("starts_at", end.toISOString())
      .gt("ends_at", start.toISOString())
      .order("starts_at", { ascending: true }),
    supabase
      .from("blocked_times")
      .select("id, starts_at, ends_at, vehicle_id, crew_id, reason, vehicles(name), crews(name)")
      .lt("starts_at", end.toISOString())
      .gt("ends_at", start.toISOString()),
    supabase.from("vehicles").select("id, name").eq("active", true),
    supabase.from("crews").select("id, name").eq("active", true),
  ]);

  const normalizedBookings = (bookings ?? []).map((b) => ({
    id: b.id,
    bookingNumber: b.booking_number,
    startsAt: b.starts_at,
    endsAt: b.ends_at,
    status: b.booking_status,
    crewSize: b.crew_size,
    vehicleId: b.vehicle_id,
    crewId: b.crew_id,
    vehicleName: Array.isArray(b.vehicles) ? b.vehicles[0]?.name : (b.vehicles as { name: string } | null)?.name,
    crewName: Array.isArray(b.crews) ? b.crews[0]?.name : (b.crews as { name: string } | null)?.name,
    customerName: Array.isArray(b.customers) ? b.customers[0]?.name : (b.customers as { name: string } | null)?.name,
  }));

  const normalizedBlocked = (blockedTimes ?? []).map((row) => ({
    id: row.id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    vehicleId: row.vehicle_id,
    crewId: row.crew_id,
    reason: row.reason,
    vehicleName: Array.isArray(row.vehicles) ? row.vehicles[0]?.name : (row.vehicles as { name: string } | null)?.name,
    crewName: Array.isArray(row.crews) ? row.crews[0]?.name : (row.crews as { name: string } | null)?.name,
  }));

  return (
    <CalendarClient
      view={view}
      year={year}
      month={month}
      day={day}
      timezone={settings.timezone}
      rangeStartIso={start.toISOString()}
      rangeEndIso={end.toISOString()}
      bookings={normalizedBookings}
      blockedTimes={normalizedBlocked}
      vehicles={vehicles ?? []}
      crews={crews ?? []}
    />
  );
}
