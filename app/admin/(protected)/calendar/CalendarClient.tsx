"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { movingPackages, legacyPackages } from "../../../../lib/site-data.ts";
import { AdminEmptyState, AdminPageHeader } from "../../_components/ui";
import { Icon } from "../../_components/Icon";
import {
  addDays,
  addMonths,
  buildDayData,
  listDays,
  minutesOfDay,
  rangeTitle,
  type BlockedTime,
  type Booking,
  type CalendarViewName,
  type Resource,
} from "./calendar-model";
import { AgendaView, MonthGrid, TimeGrid } from "./CalendarGrids";
import { CalendarFilters, CalendarLegend, CalendarToolbar, NO_FILTERS, type Filters } from "./CalendarToolbar";

// Every package a booking can carry, for the filter: bookable ones plus the retired legacy package.
const FILTER_PACKAGES = [...movingPackages, ...legacyPackages];
const NOW_TICK_MS = 60_000;

interface CalendarClientProps {
  view: CalendarViewName;
  year: number;
  month: number;
  day: number;
  timezone: string;
  todayKey: string;
  rangeStartIso: string;
  rangeEndIso: string;
  bookings: Booking[];
  blockedTimes: BlockedTime[];
  vehicles: Resource[];
  crews: Resource[];
}

function useNowMinutes(timezone: string): number | null {
  const [minutes, setMinutes] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setMinutes(minutesOfDay(new Date().toISOString(), timezone));
    tick();
    const timer = window.setInterval(tick, NOW_TICK_MS);
    return () => window.clearInterval(timer);
  }, [timezone]);
  return minutes;
}

function applyFilters(bookings: Booking[], filters: Filters): Booking[] {
  return bookings.filter(
    (b) =>
      (!filters.vehicle || b.vehicleId === filters.vehicle) &&
      (!filters.crew || b.crewId === filters.crew) &&
      (!filters.status || b.status === filters.status) &&
      (!filters.packageId || b.packageId === filters.packageId),
  );
}

/** With a truck or crew filter, show only the closures that affect it (plus whole-business closures). */
function applyBlockFilters(blocked: BlockedTime[], filters: Filters): BlockedTime[] {
  if (!filters.vehicle && !filters.crew) return blocked;
  return blocked.filter(
    (b) => (!b.vehicleId && !b.crewId) || (filters.vehicle && b.vehicleId === filters.vehicle) || (filters.crew && b.crewId === filters.crew),
  );
}

function countByStatus(bookings: Booking[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const b of bookings) counts[b.status] = (counts[b.status] ?? 0) + 1;
  return counts;
}

export function CalendarClient({ view, year, month, day, timezone, todayKey, rangeStartIso, rangeEndIso, bookings, blockedTimes, vehicles, crews }: CalendarClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const nowMinutes = useNowMinutes(timezone);

  const anchorDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const dayKeys = useMemo(() => listDays(rangeStartIso, rangeEndIso, timezone), [rangeStartIso, rangeEndIso, timezone]);

  const filteredBookings = useMemo(() => applyFilters(bookings, filters), [bookings, filters]);
  const visibleBlocks = useMemo(() => applyBlockFilters(blockedTimes, filters), [blockedTimes, filters]);
  const dayData = useMemo(() => buildDayData(dayKeys, filteredBookings, visibleBlocks, timezone), [dayKeys, filteredBookings, visibleBlocks, timezone]);
  // The legend counts ignore the status filter so every status stays visible while one is selected.
  const legendCounts = useMemo(() => countByStatus(applyFilters(bookings, { ...filters, status: "" })), [bookings, filters]);

  function navigate(nextView: string, nextDate: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", nextView);
    params.set("date", nextDate);
    router.push(`/admin/calendar?${params.toString()}`);
  }

  function step(direction: 1 | -1) {
    if (view === "month") return navigate(view, addMonths(anchorDate, direction));
    navigate(view, addDays(anchorDate, direction * (view === "week" ? 7 : 1)));
  }

  function switchView(next: CalendarViewName) {
    navigate(next, dayKeys.includes(todayKey) ? todayKey : anchorDate);
  }

  const needsAssignment = filteredBookings.filter((b) => b.status !== "completed" && (!b.vehicleId || !b.crewId)).length;
  const isEmpty = filteredBookings.length === 0 && visibleBlocks.length === 0;
  const filtersActive = Object.values(filters).some(Boolean);

  return (
    <div className="a-cal">
      <AdminPageHeader
        eyebrow="Schedule"
        title={<>Operations <em>calendar</em></>}
        description="View upcoming jobs, crew allocation and blocked periods."
      />

      <section className="a-cal-panel a-reveal" aria-label="Calendar controls">
        <CalendarToolbar view={view} title={rangeTitle(view, dayKeys, anchorDate)} onView={switchView} onPrev={() => step(-1)} onNext={() => step(1)} onToday={() => navigate(view, todayKey)} />
        <dl className="a-cal-stats">
          <div><dt>Jobs</dt><dd>{filteredBookings.length}</dd></div>
          <div><dt>Blocked periods</dt><dd>{visibleBlocks.length}</dd></div>
          <div data-alert={needsAssignment > 0}><dt>Need truck or crew</dt><dd>{needsAssignment}</dd></div>
        </dl>
        <CalendarLegend counts={legendCounts} active={filters.status} onPick={(status) => setFilters({ ...filters, status })} />
        <CalendarFilters filters={filters} onChange={setFilters} vehicles={vehicles} crews={crews} packages={FILTER_PACKAGES} />
      </section>

      <div className="a-cal-wrap a-reveal" style={{ ["--i" as string]: 1 }} data-view={view}>
        {isEmpty ? (
          <div className="admin-card">
            <AdminEmptyState
              icon="calendar"
              title={filtersActive ? "No jobs match these filters" : "Nothing scheduled in this period"}
              description={filtersActive ? "Try widening the filters to see the rest of the schedule." : "Confirmed and assigned jobs, plus any blocked time, will appear here. Use Next to look further ahead."}
              action={filtersActive ? (
                <button type="button" className="admin-btn admin-btn--secondary" onClick={() => setFilters(NO_FILTERS)}>
                  <Icon name="x" size={15} />
                  Clear filters
                </button>
              ) : undefined}
            />
          </div>
        ) : (
          <>
            <div className="a-cal-desktop" data-view={view}>
              {view === "month" ? (
                <MonthGrid days={dayData} timezone={timezone} todayKey={todayKey} onOpenDay={(key) => navigate("day", key)} />
              ) : (
                <TimeGrid days={dayData} timezone={timezone} todayKey={todayKey} nowMinutes={nowMinutes} onOpenDay={(key) => navigate("day", key)} />
              )}
            </div>
            <div className="a-cal-mobile" data-view={view}>
              <AgendaView days={dayData} timezone={timezone} todayKey={todayKey} hideEmpty={view === "month"} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
