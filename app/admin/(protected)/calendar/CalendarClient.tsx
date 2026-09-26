"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { classifyBlockedTime } from "../../../../lib/booking/calendar-range.ts";
import { AdminPageHeader } from "../../_components/ui";
import { AdminStatusBadge, statusStyle } from "../../_components/AdminStatusBadge";
import { Icon } from "../../_components/Icon";

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

// Statuses the calendar can show (cancelled/expired/draft are excluded
// by the page query). Labels + tones come from the shared badge system;
// every event shows its status as text, never colour alone.
const FILTERABLE_STATUSES = ["held", "pending_payment", "confirmed", "assigned", "in_progress", "completed"];

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

  const rangeLabel = `${new Date(rangeStartIso).toLocaleDateString("en-AU", { timeZone: timezone, dateStyle: "medium" })} – ${new Date(new Date(rangeEndIso).getTime() - 1).toLocaleDateString("en-AU", { timeZone: timezone, dateStyle: "medium" })}`;

  return (
    <div className="mx-auto max-w-7xl">
      <AdminPageHeader
        title="Calendar"
        description="View upcoming jobs, crew allocation and blocked periods."
        actions={
          <div className="admin-segmented" role="group" aria-label="Calendar view">
            {(["day", "week", "month"] as const).map((v) => (
              <button key={v} type="button" aria-pressed={view === v} onClick={() => navigate(v, anchorDate)}>
                {v}
              </button>
            ))}
          </div>
        }
      />

      <div className="admin-card mb-5 grid gap-4 p-4">
        <div className="admin-cal-toolbar">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => shift(view === "month" ? -30 : view === "week" ? -7 : -1)} className="admin-btn admin-btn--secondary admin-btn--sm" aria-label={`Previous ${view}`}>
              <Icon name="arrowLeft" size={15} />
              Prev
            </button>
            <button type="button" onClick={() => navigate(view, new Date().toISOString().slice(0, 10))} className="admin-btn admin-btn--secondary admin-btn--sm">Today</button>
            <button type="button" onClick={() => shift(view === "month" ? 30 : view === "week" ? 7 : 1)} className="admin-btn admin-btn--secondary admin-btn--sm" aria-label={`Next ${view}`}>
              Next
              <Icon name="arrowRight" size={15} />
            </button>
          </div>
          <p className="admin-cal-range" aria-live="polite">{rangeLabel}</p>
        </div>

        <div className="admin-cal-filters">
          <select aria-label="Filter by vehicle" value={vehicleFilter} onChange={(e) => setVehicleFilter(e.target.value)} className="admin-input admin-input--compact">
            <option value="">All vehicles</option>
            {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
          <select aria-label="Filter by crew" value={crewFilter} onChange={(e) => setCrewFilter(e.target.value)} className="admin-input admin-input--compact">
            <option value="">All crews</option>
            {crews.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select aria-label="Filter by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="admin-input admin-input--compact">
            <option value="">All statuses</option>
            {FILTERABLE_STATUSES.map((value) => <option key={value} value={value}>{statusStyle("booking", value).label}</option>)}
          </select>
          <select aria-label="Filter by package" value={packageFilter} onChange={(e) => setPackageFilter(e.target.value)} className="admin-input admin-input--compact">
            <option value="">All packages</option>
            <option value="2">2 Men + Truck</option>
            <option value="3">3 Men + Truck</option>
          </select>
        </div>
      </div>

      <div className="admin-cal-grid" data-view={view}>
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
    <section className="admin-cal-day" data-today={isToday} aria-label={`${label}${isToday ? " (today)" : ""}`}>
      <p className="admin-cal-day-label">
        <span>{label}</span>
        {isToday && <span className="admin-cal-today-pill">Today</span>}
      </p>
      <div className="admin-cal-items">
        {blocked.map((b) => {
          const scope = classifyBlockedTime({ vehicleId: b.vehicleId, crewId: b.crewId });
          const scopeLabel = scope === "global" ? "Business closed" : scope === "vehicle" ? `Truck: ${b.vehicleName ?? "?"}` : `Crew: ${b.crewName ?? "?"}`;
          return (
            <Link key={b.id} href="/admin/availability" className="admin-cal-blocked" title={b.reason}>
              <strong>Blocked · {scopeLabel}</strong>
              <br />{fmtTime(b.startsAt, timezone)}–{fmtTime(b.endsAt, timezone)}
            </Link>
          );
        })}
        {bookings.map((b) => (
          <Link key={b.id} href={`/admin/bookings/${b.id}`} className="admin-cal-event" data-tone={statusStyle("booking", b.status).tone}>
            <span className="admin-cal-event-time">{fmtTime(b.startsAt, timezone)}</span>{" "}
            <span className="admin-cal-event-name">{b.customerName ?? "—"}</span>
            <span className="admin-cal-event-meta block">{packageLabel(b.crewSize)}</span>
            <span className="admin-cal-event-meta block">{b.vehicleName ?? "No truck"} · {b.crewName ?? "No crew"}</span>
            <AdminStatusBadge status={b.status} />
          </Link>
        ))}
        {bookings.length === 0 && blocked.length === 0 && <p className="admin-cal-empty">No jobs</p>}
      </div>
    </section>
  );
}
