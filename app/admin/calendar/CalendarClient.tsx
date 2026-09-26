"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { classifyBlockedTime } from "../../../lib/booking/calendar-range.ts";

interface Booking {
  id: string;
  bookingNumber: string;
  startsAt: string;
  endsAt: string;
  status: string;
  crewSize: number;
  vehicleId: string | null;
  crewId: string | null;
  vehicleName?: string;
  crewName?: string;
  customerName?: string;
}

interface BlockedTime {
  id: string;
  startsAt: string;
  endsAt: string;
  vehicleId: string | null;
  crewId: string | null;
  reason: string;
  vehicleName?: string;
  crewName?: string;
}

interface Resource {
  id: string;
  name: string;
}

const STATUS_LABELS: Record<string, string> = {
  held: "Held",
  pending_payment: "Pending payment",
  confirmed: "Confirmed",
  assigned: "Assigned",
  in_progress: "In progress",
  completed: "Completed",
};

// Never rely on colour alone: every status also gets its own text label
// and a distinct border style, not just a background colour.
const STATUS_STYLES: Record<string, string> = {
  held: "bg-amber-50 border-amber-300 text-amber-800",
  pending_payment: "bg-amber-50 border-amber-400 border-dashed text-amber-800",
  confirmed: "bg-green-50 border-green-400 text-green-800",
  assigned: "bg-blue-50 border-blue-400 text-blue-800",
  in_progress: "bg-blue-100 border-blue-500 text-blue-900",
  completed: "bg-neutral-100 border-neutral-400 text-neutral-600",
};

function packageLabel(crewSize: number): string {
  return crewSize === 3 ? "3 Men + Truck" : crewSize === 2 ? "2 Men + Truck" : `${crewSize} Men + Truck`;
}

function fmtTime(iso: string, timezone: string): string {
  return new Date(iso).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", timeZone: timezone });
}

function dayKey(iso: string, timezone: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: timezone });
}

export function CalendarClient({
  view,
  year,
  month,
  day,
  timezone,
  rangeStartIso,
  rangeEndIso,
  bookings,
  blockedTimes,
  vehicles,
  crews,
}: {
  view: "day" | "week" | "month";
  year: number;
  month: number;
  day: number;
  timezone: string;
  rangeStartIso: string;
  rangeEndIso: string;
  bookings: Booking[];
  blockedTimes: BlockedTime[];
  vehicles: Resource[];
  crews: Resource[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [vehicleFilter, setVehicleFilter] = useState("");
  const [crewFilter, setCrewFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [packageFilter, setPackageFilter] = useState("");

  const anchorDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  function navigate(nextView: string, nextDate: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", nextView);
    params.set("date", nextDate);
    router.push(`/admin/calendar?${params.toString()}`);
  }

  function shift(days: number) {
    const base = new Date(Date.UTC(year, month - 1, day));
    base.setUTCDate(base.getUTCDate() + days);
    navigate(view, base.toISOString().slice(0, 10));
  }

  const filteredBookings = useMemo(
    () =>
      bookings.filter(
        (b) =>
          (!vehicleFilter || b.vehicleId === vehicleFilter) &&
          (!crewFilter || b.crewId === crewFilter) &&
          (!statusFilter || b.status === statusFilter) &&
          (!packageFilter || String(b.crewSize) === packageFilter),
      ),
    [bookings, vehicleFilter, crewFilter, statusFilter, packageFilter],
  );

  const days: string[] = [];
  {
    const cursor = new Date(rangeStartIso);
    const rangeEnd = new Date(rangeEndIso);
    while (cursor < rangeEnd) {
      days.push(cursor.toLocaleDateString("en-CA", { timeZone: timezone }));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  const bookingsByDay = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const b of filteredBookings) {
      const key = dayKey(b.startsAt, timezone);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(b);
    }
    return map;
  }, [filteredBookings, timezone]);

  const blockedByDay = useMemo(() => {
    const map = new Map<string, BlockedTime[]>();
    for (const blocked of blockedTimes) {
      const key = dayKey(blocked.startsAt, timezone);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(blocked);
    }
    return map;
  }, [blockedTimes, timezone]);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Calendar</h1>
        <div className="flex flex-wrap gap-2">
          {(["day", "week", "month"] as const).map((v) => (
            <button
              key={v}
              onClick={() => navigate(v, anchorDate)}
              className={`rounded-full px-4 py-1.5 text-sm capitalize ${view === v ? "bg-neutral-900 text-white" : "border"}`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => shift(view === "month" ? -30 : view === "week" ? -7 : -1)} className="rounded-full border px-3 py-1 text-sm">← Prev</button>
          <button onClick={() => navigate(view, new Date().toISOString().slice(0, 10))} className="rounded-full border px-3 py-1 text-sm">Today</button>
          <button onClick={() => shift(view === "month" ? 30 : view === "week" ? 7 : 1)} className="rounded-full border px-3 py-1 text-sm">Next →</button>
        </div>
        <p className="text-sm text-neutral-500">
          {new Date(rangeStartIso).toLocaleDateString("en-AU", { timeZone: timezone, dateStyle: "medium" })} –{" "}
          {new Date(new Date(rangeEndIso).getTime() - 1).toLocaleDateString("en-AU", { timeZone: timezone, dateStyle: "medium" })}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        <select value={vehicleFilter} onChange={(e) => setVehicleFilter(e.target.value)} className="rounded-lg border px-3 py-1.5">
          <option value="">All vehicles</option>
          {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
        <select value={crewFilter} onChange={(e) => setCrewFilter(e.target.value)} className="rounded-lg border px-3 py-1.5">
          <option value="">All crews</option>
          {crews.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border px-3 py-1.5">
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select value={packageFilter} onChange={(e) => setPackageFilter(e.target.value)} className="rounded-lg border px-3 py-1.5">
          <option value="">All packages</option>
          <option value="2">2 Men + Truck</option>
          <option value="3">3 Men + Truck</option>
        </select>
      </div>

      <div className={`mt-6 grid gap-3 ${view === "day" ? "grid-cols-1" : "grid-cols-1 md:grid-cols-7"}`}>
        {days.map((dateKey) => (
          <DayColumn
            key={dateKey}
            dateKey={dateKey}
            timezone={timezone}
            bookings={(bookingsByDay.get(dateKey) ?? []).sort((a, b) => a.startsAt.localeCompare(b.startsAt))}
            blocked={blockedByDay.get(dateKey) ?? []}
          />
        ))}
      </div>
    </div>
  );
}

function DayColumn({ dateKey, timezone, bookings, blocked }: { dateKey: string; timezone: string; bookings: Booking[]; blocked: BlockedTime[] }) {
  const label = new Date(`${dateKey}T12:00:00Z`).toLocaleDateString("en-AU", { timeZone: timezone, weekday: "short", day: "numeric", month: "short" });
  const isToday = dateKey === new Date().toLocaleDateString("en-CA", { timeZone: timezone });

  return (
    <div className={`rounded-xl border p-2 ${isToday ? "border-neutral-900" : ""}`}>
      <p className="mb-2 text-xs font-medium text-neutral-500">{label}{isToday ? " · Today" : ""}</p>
      <div className="space-y-1.5">
        {blocked.map((b) => {
          const scope = classifyBlockedTime({ vehicleId: b.vehicleId, crewId: b.crewId });
          const scopeLabel = scope === "global" ? "Business closed" : scope === "vehicle" ? `Truck: ${b.vehicleName ?? "?"}` : `Crew: ${b.crewName ?? "?"}`;
          return (
            <Link
              key={b.id}
              href="/admin/availability"
              className="block rounded-lg border border-dashed border-neutral-400 bg-neutral-50 px-2 py-1 text-xs text-neutral-600"
              title={b.reason}
            >
              <span className="font-medium">{scopeLabel}</span>
              <br />{fmtTime(b.startsAt, timezone)}–{fmtTime(b.endsAt, timezone)}
            </Link>
          );
        })}
        {bookings.map((b) => (
          <Link
            key={b.id}
            href={`/admin/bookings/${b.id}`}
            className={`block rounded-lg border px-2 py-1 text-xs ${STATUS_STYLES[b.status] ?? "border-neutral-300"}`}
          >
            <span className="font-medium">{fmtTime(b.startsAt, timezone)}</span> {b.customerName ?? "—"}
            <br />{packageLabel(b.crewSize)}
            <br />{b.vehicleName ?? "No truck"} · {b.crewName ?? "No crew"}
            <br /><span className="font-medium">{STATUS_LABELS[b.status] ?? b.status}</span>
          </Link>
        ))}
        {bookings.length === 0 && blocked.length === 0 && <p className="text-xs text-neutral-300">—</p>}
      </div>
    </div>
  );
}
