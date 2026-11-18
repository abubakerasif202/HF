"use client";

import { conflictLabel, effectiveDispatchTruckCount, needsDispatchAllocation, type ConflictCertainty } from "../../../../lib/dispatch.ts";
import { calendarSyncReason } from "../../../../lib/calendar-sync.ts";
import { DispatchEditor } from "./DispatchEditor";
import { DispatchQueues } from "./DispatchQueues";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AdminAlert, AdminCard, AdminEmptyState, MetricCard, PageHero } from "../../_components/ui";
import { AdminStatusBadge } from "../../_components/AdminStatusBadge";
import { Icon } from "../../_components/Icon";

interface Address {
  formattedAddress?: string | null;
  addressLine?: string | null;
  suburb?: string | null;
}

export interface DispatchBooking {
  id: string;
  booking_number: string;
  booking_status: string;
  starts_at: string;
  ends_at: string;
  estimated_duration_minutes: number;
  crew_size: number;
  crew_id: string | null;
  vehicle_id: string | null;
  dispatch_additional_vehicle_ids: string[];
  dispatch_truck_count: number | null;
  dispatch_travel_minutes: number | null;
  dispatch_overnight: boolean | null;
  dispatch_truck_left_onsite: boolean | null;
  dispatch_pricing_type: "fixed" | "hourly" | null;
  dispatch_fixed_price_cents: number | null;
  dispatch_customer_requirements: string[];
  dispatch_checklist: Array<{ id: string; label: string; done: boolean }>;
  calendar_sync_status?: string;
  calendar_sync_error?: string | null;
  google_calendar_event_id?: string | null;
  customer_notes: string | null;
  internal_notes: string | null;
  pickup_address: Address | null;
  destination_address: Address | null;
  customers: { name: string | null; phone: string | null } | null;
}

interface Crew {
  id: string;
  name: string;
}

interface CalendarReservation {
  id: string;
  summary: string | null;
  startsAt: string | null;
  endsAt: string | null;
  status: string;
}

interface DispatchData {
  date: string;
  timezone: string;
  bookings: DispatchBooking[];
  /** Every job on the day, unfiltered, so a conflict can always name the other booking. */
  bookingIndex?: Record<string, { bookingNumber: string; customerName: string | null; startsAt: string; endsAt: string | null }>;
  calendarReservations: CalendarReservation[];
  conflicts: Array<{ bookingId: string; otherId: string; kind: "crew" | "truck" | "calendar"; certainty?: ConflictCertainty }>;
  suggestions: Array<{ bookingId: string; crewId: string | null; reason: "balanced" | "conflict" | "no_crew" }>;
  crews: Crew[];
  vehicles: Array<{ id: string; name: string; vehicle_type: string }>;
}

interface Props {
  initialDate: string;
}

const STATUSES = ["draft", "held", "pending_payment", "confirmed", "assigned", "in_progress", "completed", "cancelled", "expired"] as const;

function formatTime(value: string | null, timezone: string): string {
  if (!value) return "Time not recorded";
  return new Intl.DateTimeFormat("en-AU", { timeZone: timezone, hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function formatWindow(startsAt: string | null, endsAt: string | null, timezone: string): string {
  if (!startsAt) return "Time not recorded";
  return endsAt ? `${formatTime(startsAt, timezone)} – ${formatTime(endsAt, timezone)}` : `${formatTime(startsAt, timezone)} (no finish time)`;
}

function formatAddress(value: Address | null): string {
  return value?.formattedAddress ?? ([value?.addressLine, value?.suburb].filter(Boolean).join(", ") || "Location not recorded");
}

function minutesLabel(minutes: number | null): string {
  if (minutes === null) return "Not recorded";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

export function DispatchClient({ initialDate }: Props) {
  const [date, setDate] = useState(initialDate);
  const [crewFilter, setCrewFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [truckFilter, setTruckFilter] = useState("");
  const [data, setData] = useState<DispatchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      const query = new URLSearchParams({ date });
      if (crewFilter) query.set("crewId", crewFilter);
      if (statusFilter) query.set("status", statusFilter);
      if (truckFilter) query.set("truckCount", truckFilter);
      try {
        const response = await fetch(`/api/admin/dispatch?${query}`, { cache: "no-store", signal: controller.signal });
        const result = await response.json() as DispatchData | { error?: string };
        if (!response.ok) throw new Error("error" in result ? result.error : "Dispatch data is unavailable.");
        setData(result as DispatchData);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === "AbortError") return;
        setError(loadError instanceof Error ? loadError.message : "Dispatch data is unavailable.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [date, crewFilter, statusFilter, truckFilter, refreshKey]);

  const bookingById = useMemo(() => new Map((data?.bookings ?? []).map((booking) => [booking.id, booking])), [data]);
  const crewById = useMemo(() => new Map((data?.crews ?? []).map((crew) => [crew.id, crew.name])), [data]);
  const conflictCount = data?.conflicts.length ?? 0;
  const unassignedCount = data?.bookings.filter(needsDispatchAllocation).length ?? 0;
  const trucksNeeded = data?.bookings.reduce((sum, booking) => sum + (effectiveDispatchTruckCount(booking) ?? 0), 0) ?? 0;

  async function syncCalendar() {
    setPending("calendar");
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/calendar/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      });
      const result = await response.json() as { imported?: number; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Google Calendar sync failed.");
      setNotice(`${result.imported ?? 0} calendar events checked for this day.`);
      refresh();
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Google Calendar sync failed.");
    } finally {
      setPending("");
    }
  }

  async function assignCrew(bookingId: string, crewId: string) {
    setPending(bookingId);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/dispatch", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, crewId }),
      });
      const result = await response.json() as { error?: string; warning?: string };
      if (!response.ok) throw new Error(result.error ?? "Crew assignment failed.");
      setNotice(result.warning ?? "Crew assignment saved.");
      refresh();
    } catch (assignError) {
      setError(assignError instanceof Error ? assignError.message : "Crew assignment failed.");
    } finally {
      setPending("");
    }
  }

  return (
    <div className="a-dispatch">
      <PageHero
        eyebrow="HF Removals · Daily operations"
        title={<>A smoother <em>move day.</em></>}
        lede="See both crews, spot overlaps and balance the day from one dispatch view."
        actions={(
          <>
            <Link href="/admin/dispatch/find" className="admin-btn admin-btn--primary a-dispatch-find-btn">
              <Icon name="search" size={16} />
              Find booking
            </Link>
            <button type="button" className="admin-btn admin-btn--secondary" onClick={() => void syncCalendar()} disabled={pending === "calendar"}>
              <Icon name="sync" size={16} />
              {pending === "calendar" ? "Syncing…" : "Sync Google Calendar"}
            </button>
          </>
        )}
        stats={[
          { value: data?.bookings.length ?? "—", label: "HF jobs" },
          { value: unassignedCount, label: "Need allocation" },
          { value: conflictCount, label: "Conflicts" },
        ]}
      />

      {error && <AdminAlert tone="error">{error}</AdminAlert>}
      {notice && <AdminAlert tone="success">{notice}</AdminAlert>}

      <div className="a-dispatch-metrics">
        <MetricCard icon="calendar" label="Scheduled" value={data?.bookings.length ?? "—"} hint="HF bookings on this date" variant="feature" />
        <MetricCard icon="crew" label="Unassigned" value={unassignedCount} hint="Crew or truck still needed" variant={unassignedCount ? "alert" : "porcelain"} />
        <MetricCard icon="alert" label="Overlap checks" value={conflictCount} hint="Crew, truck or Calendar overlap" variant={conflictCount ? "gold" : "porcelain"} />
        <MetricCard icon="truck" label="Truck load" value={trucksNeeded} hint="Required trucks across visible jobs" variant="porcelain" />
      </div>

      <DispatchQueues refreshKey={refreshKey} onOpenDay={setDate} />

      <AdminCard title="Dispatch filters" description="Choose a day and narrow the work list." icon="filter" className="a-dispatch-filter-card">
        <div className="a-dispatch-filters">
          <label className="admin-field">
            <span className="admin-label">Date</span>
            <input className="admin-input" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          <label className="admin-field">
            <span className="admin-label">Subcontractor crew</span>
            <select className="admin-input" value={crewFilter} onChange={(event) => setCrewFilter(event.target.value)}>
              <option value="">All crews</option>
              {(data?.crews ?? []).map((crew) => <option value={crew.id} key={crew.id}>{crew.name}</option>)}
            </select>
          </label>
          <label className="admin-field">
            <span className="admin-label">Status</span>
            <select className="admin-input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="">All statuses</option>
              {STATUSES.map((status) => <option value={status} key={status}>{status.replaceAll("_", " ")}</option>)}
            </select>
          </label>
          <label className="admin-field">
            <span className="admin-label">Truck count</span>
            <select className="admin-input" value={truckFilter} onChange={(event) => setTruckFilter(event.target.value)}>
              <option value="">Any number</option>
              {[1, 2, 3, 4].map((count) => <option value={count} key={count}>{count} {count === 1 ? "truck" : "trucks"}</option>)}
            </select>
          </label>
        </div>
      </AdminCard>

      <div className="a-dispatch-columns">
        <AdminCard title="Suggested crew split" description="Suggestions avoid overlaps and prefer the lighter workload." icon="crew">
          {loading ? <p className="admin-help" role="status">Loading daily assignments…</p> : data?.suggestions.length ? (
            <div className="a-dispatch-suggestions">
              {data.suggestions.map((suggestion) => {
                const booking = bookingById.get(suggestion.bookingId);
                return (
                  <div className="a-dispatch-suggestion" key={suggestion.bookingId}>
                    <div className="a-dispatch-suggestion-main">
                      <Link href={`/admin/bookings/${suggestion.bookingId}`} className="admin-link">{booking?.booking_number ?? "Booking"}</Link>
                      <span>{booking?.customers?.name ?? "Customer not recorded"}</span>
                    </div>
                    {suggestion.crewId ? (
                      <div className="a-dispatch-suggestion-action">
                        <span className="a-dispatch-crew-name">{crewById.get(suggestion.crewId) ?? "Crew"}</span>
                        <button type="button" className="admin-btn admin-btn--secondary admin-btn--sm" disabled={pending === suggestion.bookingId} onClick={() => void assignCrew(suggestion.bookingId, suggestion.crewId!)}>
                          {pending === suggestion.bookingId ? "Saving…" : "Assign"}
                        </button>
                      </div>
                    ) : <span className="a-dispatch-warning">{suggestion.reason === "no_crew" ? "No crew available" : "Conflict — review first"}</span>}
                  </div>
                );
              })}
            </div>
          ) : <AdminEmptyState icon="crew" title="No crew suggestions" description="All visible jobs are assigned, or there is nothing scheduled for this day." />}
        </AdminCard>

        <AdminCard title="Overlap warnings" description="Existing HF assignments and imported calendar events." icon="alert">
          {loading ? <p className="admin-help" role="status">Checking overlaps…</p> : conflictCount ? (
            <ul className="a-dispatch-conflicts">
              {data?.conflicts.map((conflict, index) => {
                const booking = data.bookingIndex?.[conflict.bookingId];
                const otherBooking = data.bookingIndex?.[conflict.otherId];
                const event = data?.calendarReservations.find((item) => item.id === conflict.otherId);
                const certainty = conflict.certainty ?? "definite";
                return (
                  <li key={`${conflict.bookingId}-${conflict.otherId}-${conflict.kind}-${index}`} data-certainty={certainty}>
                    <span className="a-dispatch-conflict-icon"><Icon name="alert" size={15} /></span>
                    <span>
                      <strong>{conflictLabel({ kind: conflict.kind, certainty })}</strong>
                      <small>
                        <Link href={`/admin/bookings/${conflict.bookingId}`} className="admin-link">{booking?.bookingNumber ?? "HF job"}</Link>
                        {" · "}{booking?.customerName ?? "Customer not recorded"}{booking ? ` · ${formatWindow(booking.startsAt, booking.endsAt, data.timezone)}` : ""}
                      </small>
                      <small>
                        {"↔ "}
                        {otherBooking
                          ? <><Link href={`/admin/bookings/${conflict.otherId}`} className="admin-link">{otherBooking.bookingNumber}</Link>{" · "}{otherBooking.customerName ?? "Customer not recorded"}{` · ${formatWindow(otherBooking.startsAt, otherBooking.endsAt, data.timezone)}`}</>
                          : <>{event?.summary ?? "Google Calendar event"}{event ? ` · ${formatWindow(event.startsAt, event.endsAt, data.timezone)}` : ""}</>}
                      </small>
                      {certainty === "possible" && <small className="a-dispatch-possible">Possible: a finish time is missing, so this overlap is inferred. Confirm the finish time.</small>}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : <div className="a-dispatch-clear"><Icon name="check" size={18} /><span>No overlaps found for this day.</span></div>}
        </AdminCard>
      </div>

      <AdminCard title="Daily run sheet" description={date} icon="calendar" className="a-dispatch-run-sheet" id="dispatch-run-sheet">
        {loading ? <p className="admin-help" role="status">Loading bookings…</p> : data?.bookings.length ? (
          <div className="a-dispatch-list">
            {data.bookings.map((booking) => (
              <article className="a-dispatch-job" key={booking.id}>
                <div className="a-dispatch-job-time"><strong>{formatTime(booking.starts_at, data.timezone)}</strong><span>{minutesLabel(booking.estimated_duration_minutes)}</span></div>
                <div className="a-dispatch-job-main">
                  <div className="a-dispatch-job-title"><Link href={`/admin/bookings/${booking.id}`}>{booking.customers?.name ?? "Customer not recorded"}</Link><AdminStatusBadge status={booking.booking_status} /></div>
                  <p>{booking.booking_number} · {booking.crew_size} movers · {effectiveDispatchTruckCount(booking) ?? "Truck not recorded"} {booking.dispatch_truck_count === 1 || (!booking.dispatch_truck_count && booking.vehicle_id) ? "truck" : "trucks"}</p>
                  <div className="a-dispatch-route"><span><Icon name="mapPin" size={14} />{formatAddress(booking.pickup_address)}</span><Icon name="arrowRight" size={14} /><span><Icon name="mapPin" size={14} />{formatAddress(booking.destination_address)}</span></div>
                  <div className="a-dispatch-job-facts">
                    <span><Icon name="crew" size={14} />{crewById.get(booking.crew_id ?? "") ?? "Crew unassigned"}</span>
                    <span><Icon name="truck" size={14} />{(booking.dispatch_additional_vehicle_ids?.length ?? 0) + (booking.vehicle_id ? 1 : 0)} assigned</span>
                    <span><Icon name="clock" size={14} />Travel {minutesLabel(booking.dispatch_travel_minutes)}</span>
                    {booking.dispatch_overnight && <span>Overnight</span>}
                    {booking.dispatch_truck_left_onsite && <span>Truck remains onsite</span>}
                    {booking.dispatch_pricing_type && <span>{booking.dispatch_pricing_type} pricing</span>}
                    {booking.calendar_sync_status && (() => {
                      const reason = calendarSyncReason({ booking_status: booking.booking_status, calendar_sync_status: booking.calendar_sync_status, google_calendar_event_id: booking.google_calendar_event_id ?? null, calendar_sync_error: booking.calendar_sync_error });
                      return <span className="a-dispatch-sync" data-tone={reason.tone} title={reason.detail}><Icon name="sync" size={14} />Calendar: {reason.label}</span>;
                    })()}
                  </div>
                  {booking.customer_notes && <p className="a-dispatch-note"><strong>Customer note:</strong> {booking.customer_notes}</p>}
                </div>
                <Link href={`/admin/bookings/${booking.id}`} className="admin-btn admin-btn--secondary admin-btn--sm">Open booking</Link>
                <DispatchEditor key={`${booking.id}-${refreshKey}`} booking={booking} crews={data.crews} vehicles={data.vehicles ?? []} timezone={data.timezone} onSaved={(message) => { setNotice(message); refresh(); }} />
              </article>
            ))}
          </div>
        ) : <AdminEmptyState icon="calendar" title="No HF bookings on this day" description="Try another date or clear the filters." />}
      </AdminCard>

      {data?.calendarReservations.length ? (
        <AdminCard title="Google Calendar events" description="Imported as schedule reservations; missing customer and job details stay blank." icon="calendar">
          <div className="a-dispatch-list a-dispatch-list--external">
            {data.calendarReservations.map((event) => (
              <div className="a-dispatch-external" key={event.id}>
                <span><Icon name="calendar" size={16} /></span>
                <strong>{event.summary ?? "Calendar event"}</strong>
                <span>{formatTime(event.startsAt, data.timezone)}{event.endsAt ? ` – ${formatTime(event.endsAt, data.timezone)}` : ""}</span>
                <span className="a-dispatch-muted">{event.status}</span>
              </div>
            ))}
          </div>
        </AdminCard>
      ) : null}
    </div>
  );
}
