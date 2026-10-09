import Link from "next/link";
import { requireAdmin } from "../../../lib/server/admin-dal.ts";
import { AdminCard, AdminEmptyState, MetricCard, PageHero, QuickAction, TrendIndicator, formatAdelaide, formatMoney } from "../_components/ui";
import { AdminStatusBadge } from "../_components/AdminStatusBadge";
import { BarChart, DonutChart, PipelineBars, Sparkline, type BarDatum } from "../_components/charts";
import { Icon } from "../_components/Icon";
import { getSupabaseAdmin } from "../../../lib/server/supabase.ts";
import { adelaideDay, adelaideDayOffset } from "../../../lib/admin/dates.ts";
import { instantToZonedParts } from "../../../lib/booking/timezone.ts";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

const QUOTE_STAGES = [
  { key: "new", label: "New", color: "var(--a-viz-1)" },
  { key: "quote_sent", label: "Quote sent", color: "var(--a-viz-3)" },
  { key: "follow_up", label: "Follow up", color: "var(--a-viz-2)" },
  { key: "booked", label: "Booked", color: "var(--a-viz-4)" },
  { key: "completed", label: "Completed", color: "var(--a-viz-5)" },
  { key: "lost", label: "Lost", color: "var(--a-viz-6)" },
] as const;

const LIVE_STATUSES = ["confirmed", "assigned", "in_progress"] as const;
const COUNTED_STATUSES = ["confirmed", "assigned", "in_progress", "completed"] as const;
const WEEK_MS = 7 * 86_400_000;

/** bookings.*_address is jsonb: { suburb, addressLine, formattedAddress, ... } (legacy rows may hold a string). */
type AddressJson = { suburb?: string; addressLine?: string; formattedAddress?: string } | string | null;

type MoveRow = {
  id: string;
  booking_number: string;
  starts_at: string;
  booking_status: string;
  pickup_address: AddressJson;
  destination_address: AddressJson;
  vehicle_id: string | null;
  crew_id: string | null;
  customers: { name: string | null } | { name: string | null }[] | null;
};

function firstOf<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/** Suburb-level label for dense lists; tolerant of the jsonb shape and plain strings. */
function shortPlace(address: AddressJson | undefined): string {
  if (!address) return "—";
  if (typeof address === "string") {
    const parts = address.split(",").map((part) => part.trim()).filter(Boolean);
    return parts.length > 1 ? parts.slice(-2).join(", ") : (parts[0] ?? "—");
  }
  return address.suburb || address.addressLine || address.formattedAddress || "—";
}

function relativeTime(iso: string, now: Date): string {
  const minutes = Math.round((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days < 14 ? `${days}d ago` : formatAdelaide(iso, { day: "numeric", month: "short" });
}

function humanise(value: string): string {
  const text = value.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function greeting(now: Date): string {
  const hour = instantToZonedParts(now, "Australia/Adelaide").hour;
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default async function AdminDashboardPage() {
  await requireAdmin();
  const supabase = getSupabaseAdmin();
  const now = new Date();
  const nowIso = now.toISOString();
  const today = adelaideDay(0, now);
  const tomorrow = adelaideDay(1, now);
  const sevenDays = new Date(now.getTime() + WEEK_MS).toISOString();
  const fourteenDaysAgo = adelaideDay(-13, now).start;
  const weekWindowStart = adelaideDay(-21, now).start;
  const weekWindowEnd = adelaideDay(35, now).start;

  const [
    statusRowsResult,
    todayResult,
    tomorrowResult,
    upcomingWeekResult,
    attentionResult,
    unassignedResult,
    balanceResult,
    movesResult,
    vehiclesResult,
    todayVehicleResult,
    blockedResult,
    weeklyResult,
    quoteDatesResult,
    eventsResult,
    recentQuotesResult,
    ...stageResults
  ] = await Promise.all([
    supabase.from("bookings").select("booking_status").limit(5000),
    supabase.from("bookings").select("id", { count: "exact", head: true }).gte("starts_at", today.start).lt("starts_at", today.end).not("booking_status", "in", "(cancelled,expired)"),
    supabase.from("bookings").select("id", { count: "exact", head: true }).gte("starts_at", tomorrow.start).lt("starts_at", tomorrow.end).not("booking_status", "in", "(cancelled,expired)"),
    supabase.from("bookings").select("id", { count: "exact", head: true }).gte("starts_at", nowIso).lt("starts_at", sevenDays).in("booking_status", [...LIVE_STATUSES]),
    supabase
      .from("bookings")
      .select("id, booking_number, booking_status, payment_status, vehicle_id, crew_id, calendar_sync_status, starts_at")
      .in("booking_status", ["confirmed", "assigned", "pending_payment"])
      .order("starts_at", { ascending: true })
      .limit(50),
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("booking_status", "confirmed").is("vehicle_id", null),
    supabase.from("bookings").select("balance_due_cents").gt("balance_due_cents", 0).in("booking_status", ["confirmed", "assigned", "completed"]),
    supabase
      .from("bookings")
      .select("id, booking_number, starts_at, booking_status, pickup_address, destination_address, vehicle_id, crew_id, customers(name)")
      .gte("starts_at", nowIso)
      .in("booking_status", [...LIVE_STATUSES])
      .order("starts_at", { ascending: true })
      .limit(6),
    supabase.from("vehicles").select("id, name, vehicle_type, active").order("name", { ascending: true }),
    supabase.from("bookings").select("vehicle_id").gte("starts_at", today.start).lt("starts_at", today.end).not("booking_status", "in", "(cancelled,expired)").not("vehicle_id", "is", null),
    supabase.from("blocked_times").select("vehicle_id").lt("starts_at", today.end).gt("ends_at", today.start),
    supabase.from("bookings").select("starts_at").gte("starts_at", weekWindowStart).lt("starts_at", weekWindowEnd).in("booking_status", [...COUNTED_STATUSES]),
    supabase.from("quote_requests").select("created_at").gte("created_at", fourteenDaysAgo).limit(2000),
    supabase.from("booking_events").select("id, event, created_at, bookings(booking_number)").order("created_at", { ascending: false }).limit(8),
    supabase.from("quote_requests").select("id, payload, created_at").order("created_at", { ascending: false }).limit(6),
    ...QUOTE_STAGES.map((stage) => supabase.from("quote_requests").select("id", { count: "exact", head: true }).eq("quote_status", stage.key)),
  ]);

  /* ---- Bookings by status (single tally) ---- */
  const statusTally: Record<string, number> = {};
  for (const row of statusRowsResult.data ?? []) statusTally[row.booking_status] = (statusTally[row.booking_status] ?? 0) + 1;
  const totalBookings = COUNTED_STATUSES.reduce((sum, status) => sum + (statusTally[status] ?? 0), 0);
  const confirmedJobs = (statusTally.confirmed ?? 0) + (statusTally.assigned ?? 0);

  /* ---- Enquiry pipeline ---- */
  const stageCounts = QUOTE_STAGES.map((stage, index) => ({ ...stage, count: stageResults[index]?.count ?? 0 }));
  const stageOf = (key: string) => stageCounts.find((stage) => stage.key === key)?.count ?? 0;
  const totalEnquiries = stageCounts.reduce((sum, stage) => sum + stage.count, 0);
  const newEnquiries = stageOf("new");
  const followUps = stageOf("follow_up");

  /* ---- Enquiries received: last 14 days + week-on-week comparison ---- */
  const dayBuckets: BarDatum[] = Array.from({ length: 14 }, (_, index) => {
    const day = adelaideDay(index - 13, now);
    const [, month, dayOfMonth] = day.ymd.split("-");
    return { label: `${Number(dayOfMonth)}/${Number(month)}`, value: 0, accent: index === 13 };
  });
  let thisWeekEnquiries = 0;
  let previousWeekEnquiries = 0;
  for (const row of quoteDatesResult.data ?? []) {
    const offset = adelaideDayOffset(row.created_at, now);
    if (offset >= -13 && offset <= 0) dayBuckets[offset + 13].value += 1;
    if (offset >= -6 && offset <= 0) thisWeekEnquiries += 1;
    else if (offset >= -13 && offset < -6) previousWeekEnquiries += 1;
  }
  const enquiryDelta = thisWeekEnquiries - previousWeekEnquiries;
  const hasEnquiryHistory = (quoteDatesResult.data ?? []).length > 0;

  /* ---- Bookings by week: 3 past weeks, this week, 4 ahead (Monday start, Adelaide) ---- */
  const todayParts = instantToZonedParts(now, "Australia/Adelaide");
  const mondayOffset = -((todayParts.weekday + 6) % 7);
  const weekBuckets: BarDatum[] = Array.from({ length: 8 }, (_, index) => {
    const startOffset = mondayOffset + (index - 3) * 7;
    const start = adelaideDay(startOffset, now).ymd.split("-");
    return { label: `${Number(start[2])}/${Number(start[1])}`, value: 0, accent: index === 3, muted: index < 3 };
  });
  for (const row of weeklyResult.data ?? []) {
    const offset = adelaideDayOffset(row.starts_at, now);
    const weekIndex = Math.floor((offset - mondayOffset) / 7) + 3;
    if (weekIndex >= 0 && weekIndex < weekBuckets.length) weekBuckets[weekIndex].value += 1;
  }
  const weeklyTotal = weekBuckets.reduce((sum, bucket) => sum + bucket.value, 0);

  /* ---- Needs attention (unchanged rules) ---- */
  const attention = (attentionResult.data ?? []).filter(
    (b) =>
      (b.booking_status === "confirmed" && !b.vehicle_id) ||
      (b.booking_status === "confirmed" && !b.crew_id) ||
      b.booking_status === "pending_payment" ||
      b.calendar_sync_status === "failed",
  );
  const unassignedCount = unassignedResult.count ?? 0;
  const outstandingCents = (balanceResult.data ?? []).reduce((sum, row) => sum + row.balance_due_cents, 0);

  /* ---- Fleet today ---- */
  const vehicles = vehiclesResult.data ?? [];
  const busyIds = new Set((todayVehicleResult.data ?? []).map((row) => row.vehicle_id).filter((id): id is string => Boolean(id)));
  const blockedRows = blockedResult.data ?? [];
  const allBlocked = blockedRows.some((row) => row.vehicle_id === null);
  const blockedIds = new Set(blockedRows.map((row) => row.vehicle_id).filter((id): id is string => Boolean(id)));
  const fleet = vehicles.map((vehicle) => ({
    ...vehicle,
    state: !vehicle.active ? "inactive" : allBlocked || blockedIds.has(vehicle.id) ? "blocked" : busyIds.has(vehicle.id) ? "busy" : "free",
  }));
  const activeVehicles = fleet.filter((vehicle) => vehicle.active);
  const freeVehicles = fleet.filter((vehicle) => vehicle.state === "free").length;

  /* ---- Upcoming moves ---- */
  const moves = (movesResult.data ?? []) as unknown as MoveRow[];

  /* ---- Recent activity: booking events + new enquiries, newest first ---- */
  type Activity = { id: string; kind: "booking" | "quote"; title: string; sub: string; at: string };
  const activity: Activity[] = [
    ...(eventsResult.data ?? []).map((event) => {
      const booking = firstOf(event.bookings as { booking_number: string } | { booking_number: string }[] | null);
      return { id: `e-${event.id}`, kind: "booking" as const, title: humanise(event.event), sub: booking ? `Booking ${booking.booking_number}` : "Booking", at: event.created_at };
    }),
    ...(recentQuotesResult.data ?? []).map((quote) => {
      const payload = (quote.payload ?? {}) as Record<string, string | string[]>;
      const name = typeof payload.name === "string" && payload.name ? payload.name : "A customer";
      const from = typeof payload.moving_from === "string" ? shortPlace(payload.moving_from) : "";
      return { id: `q-${quote.id}`, kind: "quote" as const, title: `New quote enquiry from ${name}`, sub: from ? `Moving from ${from}` : "Website quote form", at: quote.created_at };
    }),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 8);

  const todayCount = todayResult.count ?? 0;
  const tomorrowCount = tomorrowResult.count ?? 0;
  const attentionCount = attention.length;
  const dateLabel = formatAdelaide(nowIso, { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="a-dash">
      <PageHero
        eyebrow={`${greeting(now)} · ${dateLabel}`}
        title={<>Your operations.<em>In command.</em></>}
        lede={
          <>
            <strong>{todayCount === 0 ? "No moves" : `${todayCount} ${todayCount === 1 ? "move" : "moves"}`}</strong> scheduled today
            {newEnquiries > 0 && <>, <strong>{newEnquiries} new {newEnquiries === 1 ? "enquiry" : "enquiries"}</strong> awaiting a first reply</>}
            {attentionCount > 0 ? <> and <strong>{attentionCount} {attentionCount === 1 ? "job" : "jobs"}</strong> that need attention.</> : <> — everything on the schedule is accounted for.</>}
          </>
        }
        actions={
          <>
            <Link href="/admin/quotes" className="admin-btn admin-btn--gold">
              <Icon name="inbox" size={17} />
              Review enquiries
            </Link>
            <Link href="/admin/calendar" className="admin-btn admin-btn--glass">
              <Icon name="calendar" size={17} />
              Open calendar
            </Link>
          </>
        }
        stats={[
          { value: todayCount, label: "Moves today" },
          { value: tomorrowCount, label: "Moves tomorrow" },
          { value: attentionCount, label: "Need attention" },
        ]}
      />

      <div className="a-metric-grid">
        <MetricCard
          icon="bookings"
          label="Total bookings"
          value={totalBookings}
          hint="Confirmed, in progress and completed. Excludes held, cancelled and expired."
          variant="feature"
          span={5}
          wide
          style={{ "--i": 0 } as React.CSSProperties}
          art={weeklyTotal > 0 ? <Sparkline values={weekBuckets.map((bucket) => bucket.value)} /> : undefined}
        />
        <MetricCard
          icon="inbox"
          label="New enquiries"
          value={newEnquiries}
          hint="Quote requests still awaiting a first response."
          variant="gold"
          span={4}
          style={{ "--i": 1 } as React.CSSProperties}
          trend={
            hasEnquiryHistory ? (
              <TrendIndicator direction={enquiryDelta > 0 ? "up" : enquiryDelta < 0 ? "down" : "flat"}>
                {enquiryDelta > 0 ? "+" : ""}{enquiryDelta} vs prior 7 days
              </TrendIndicator>
            ) : undefined
          }
        />
        <MetricCard icon="calendarCheck" label="Upcoming moves" value={upcomingWeekResult.count ?? 0} hint="Next 7 days, confirmed or in progress." span={3} style={{ "--i": 2 } as React.CSSProperties} />
        <MetricCard icon="check" label="Confirmed jobs" value={confirmedJobs} hint="Confirmed or assigned to a truck." span={3} style={{ "--i": 3 } as React.CSSProperties} />
        <MetricCard
          icon="truck"
          label="Available vehicles"
          value={activeVehicles.length === 0 ? "—" : freeVehicles}
          hint={activeVehicles.length === 0 ? "No active vehicles are set up yet." : `Free today, of ${activeVehicles.length} active ${activeVehicles.length === 1 ? "truck" : "trucks"}.`}
          variant="deep"
          span={5}
          wide
          style={{ "--i": 4 } as React.CSSProperties}
        />
        <MetricCard
          icon="bell"
          label="Outstanding follow-ups"
          value={followUps}
          hint={followUps > 0 ? "Enquiries marked follow up." : "No enquiries are waiting on a follow-up."}
          variant={followUps > 0 ? "alert" : "porcelain"}
          span={4}
          style={{ "--i": 5 } as React.CSSProperties}
        />
      </div>

      <div className="a-section-label">
        <h2>Operational intelligence</h2>
      </div>

      <div className="a-dash-cols" data-cols="7-5">
        <AdminCard
          icon="route"
          title="Upcoming moves"
          description="Your next confirmed jobs, soonest first."
          actions={<Link href="/admin/bookings" className="admin-link">All bookings</Link>}
          flush
        >
          {moves.length === 0 ? (
            <AdminEmptyState icon="calendar" title="No upcoming moves" description="Confirmed and assigned bookings will line up here as customers book." />
          ) : (
            <ol className="a-move-list">
              {moves.map((move) => {
                const customer = firstOf(move.customers);
                const start = new Date(move.starts_at);
                return (
                  <li key={move.id} className="a-move">
                    <div className="a-move-date" aria-hidden="true">
                      <span className="a-move-mon">{start.toLocaleDateString("en-AU", { timeZone: "Australia/Adelaide", month: "short" })}</span>
                      <span className="a-move-day">{start.toLocaleDateString("en-AU", { timeZone: "Australia/Adelaide", day: "numeric" })}</span>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div className="a-move-title">
                        <Link href={`/admin/bookings/${move.id}`} className="admin-link" style={{ textDecoration: "none", color: "inherit" }}>
                          {customer?.name || "Customer"}
                        </Link>
                      </div>
                      <div className="a-move-route">{shortPlace(move.pickup_address)} → {shortPlace(move.destination_address)}</div>
                      <div className="a-move-meta">
                        <span><Icon name="clock" size={13} />{formatAdelaide(move.starts_at, { weekday: "short", hour: "numeric", minute: "2-digit" })}</span>
                        <span data-missing={!move.vehicle_id}><Icon name="truck" size={13} />{move.vehicle_id ? "Truck assigned" : "No truck yet"}</span>
                        <span data-missing={!move.crew_id}><Icon name="crew" size={13} />{move.crew_id ? "Crew assigned" : "No crew yet"}</span>
                        <span className="a-id">{move.booking_number}</span>
                      </div>
                    </div>
                    <AdminStatusBadge status={move.booking_status} />
                  </li>
                );
              })}
            </ol>
          )}
        </AdminCard>

        <AdminCard
          icon="layers"
          title="Enquiry pipeline"
          description={totalEnquiries > 0 ? `${totalEnquiries} captured website ${totalEnquiries === 1 ? "enquiry" : "enquiries"}, by follow-up stage.` : "Where each website enquiry sits in your follow-up."}
          actions={<Link href="/admin/quotes" className="admin-link">Open CRM</Link>}
        >
          {totalEnquiries === 0 ? (
            <AdminEmptyState icon="inbox" title="No enquiries captured yet" description="Website quote requests appear here once the quote form mirrors a submission." />
          ) : (
            <PipelineBars stages={stageCounts.map((stage) => ({ label: stage.label, count: stage.count, color: stage.color }))} />
          )}
        </AdminCard>
      </div>

      <div className="a-dash-cols" data-cols="5-7">
        <AdminCard icon="truck" title="Fleet availability" description="Today's status for every truck." actions={<Link href="/admin/vehicles" className="admin-link">Manage</Link>}>
          {fleet.length === 0 ? (
            <AdminEmptyState icon="truck" title="No vehicles yet" description="Add trucks under Vehicles to see live availability here." />
          ) : (
            <>
              <div className="a-fleet-summary">
                <div className="a-fleet-big">{freeVehicles}<small> / {activeVehicles.length} free</small></div>
              </div>
              <ul className="a-fleet">
                {fleet.map((vehicle) => (
                  <li key={vehicle.id} className="a-fleet-item" data-state={vehicle.state}>
                    <span className="a-fleet-icon"><Icon name="truck" size={20} /></span>
                    <div className="a-fleet-body">
                      <div className="a-fleet-name">{vehicle.name}</div>
                      <div className="a-fleet-sub">{vehicle.vehicle_type ? humanise(vehicle.vehicle_type) : "Class not set"}</div>
                    </div>
                    <AdminStatusBadge kind="fleet" status={vehicle.state} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </AdminCard>

        <AdminCard
          icon="alert"
          title="Needs attention"
          description="Jobs missing a truck or crew, legacy bookings awaiting payment, or with a failed calendar sync."
          flush
        >
          {attention.length === 0 ? (
            <AdminEmptyState icon="check" title="All clear" description="Nothing needs attention right now." />
          ) : (
            <ul className="a-attn">
              {attention.slice(0, 8).map((b) => {
                const issues = [
                  !b.vehicle_id && b.booking_status === "confirmed" && "No truck assigned",
                  !b.crew_id && b.booking_status === "confirmed" && b.vehicle_id && "No crew assigned",
                  b.booking_status === "pending_payment" && "Legacy payment pending",
                  b.calendar_sync_status === "failed" && "Calendar sync failed",
                ].filter(Boolean);
                return (
                  <li key={b.id}>
                    <div>
                      <Link href={`/admin/bookings/${b.id}`} className="a-id" style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>{b.booking_number}</Link>
                      <span className="admin-cell-sub" style={{ marginLeft: 10 }}>{formatAdelaide(b.starts_at, { dateStyle: "medium" })}</span>
                      <div className="a-attn-issue">{issues.join(" · ")}</div>
                    </div>
                    <AdminStatusBadge status={b.booking_status} />
                  </li>
                );
              })}
            </ul>
          )}
          {attention.length > 8 && <p className="admin-help" style={{ padding: "12px 26px 4px" }}>Showing 8 of {attention.length}. Open Bookings to see the rest.</p>}
        </AdminCard>
      </div>

      <div className="a-dash-cols" data-cols="3">
        <AdminCard icon="activity" title="Bookings by week" description="Confirmed and completed moves, by start week.">
          {weeklyTotal === 0 ? (
            <AdminEmptyState icon="activity" title="No bookings in this window" description="Weeks fill in as bookings are confirmed." />
          ) : (
            <div className="a-chart"><BarChart data={weekBuckets} title="Bookings by week" /></div>
          )}
        </AdminCard>
        <AdminCard icon="inbox" title="Enquiries received" description="Last 14 days, by day received.">
          {!hasEnquiryHistory ? (
            <AdminEmptyState icon="inbox" title="No recent enquiries" description="Enquiries from the last 14 days will chart here." />
          ) : (
            <div className="a-chart"><BarChart data={dayBuckets} title="Enquiries received per day" /></div>
          )}
        </AdminCard>
        <AdminCard icon="layers" title="Booking status mix" description="All bookings on record.">
          {(statusRowsResult.data ?? []).length === 0 ? (
            <AdminEmptyState icon="layers" title="No bookings yet" description="The mix appears once bookings exist." />
          ) : (
            <DonutChart
              title="Booking status mix"
              centerValue={(statusRowsResult.data ?? []).length}
              centerLabel="Total"
              segments={[
                { label: "Confirmed", value: statusTally.confirmed ?? 0, color: "var(--a-viz-1)" },
                { label: "Assigned", value: statusTally.assigned ?? 0, color: "var(--a-viz-3)" },
                { label: "In progress", value: statusTally.in_progress ?? 0, color: "var(--a-viz-2)" },
                { label: "Completed", value: statusTally.completed ?? 0, color: "var(--a-viz-5)" },
                { label: "Held", value: statusTally.held ?? 0, color: "var(--a-viz-4)" },
                { label: "Cancelled / expired", value: (statusTally.cancelled ?? 0) + (statusTally.expired ?? 0), color: "var(--a-viz-6)" },
              ].filter((segment) => segment.value > 0)}
            />
          )}
        </AdminCard>
      </div>

      <div className="a-dash-cols" data-cols="7-5">
        <AdminCard icon="activity" title="Recent activity" description="Booking events and new enquiries, newest first.">
          {activity.length === 0 ? (
            <AdminEmptyState icon="activity" title="No activity yet" description="Booking events and enquiries will stream in here." />
          ) : (
            <ol className="a-activity" style={{ padding: 0 }}>
              {activity.map((item) => (
                <li key={item.id} data-kind={item.kind}>
                  <span className="a-activity-icon"><Icon name={item.kind === "quote" ? "inbox" : "bookings"} size={16} /></span>
                  <div>
                    <div className="a-activity-title">{item.title}</div>
                    <div className="a-activity-sub">{item.sub}</div>
                  </div>
                  <time className="a-activity-time" dateTime={item.at}>{relativeTime(item.at, now)}</time>
                </li>
              ))}
            </ol>
          )}
        </AdminCard>

        <AdminCard icon="flag" title="Quick actions" description="Jump straight to common work.">
          <div style={{ display: "grid", gap: 12 }}>
            <QuickAction href="/admin/quotes" icon="inbox" title="Follow up enquiries" text={newEnquiries > 0 ? `${newEnquiries} awaiting a first reply` : "Open the quote CRM"} />
            <QuickAction href="/admin/bookings" icon="bookings" title="Assign trucks & crews" text={unassignedCount > 0 ? `${unassignedCount} confirmed ${unassignedCount === 1 ? "job needs" : "jobs need"} a truck` : "Review confirmed bookings"} />
            <QuickAction href="/admin/availability" icon="availability" title="Block out time" text="Holidays, servicing, leave" />
            <QuickAction href="/admin/pricing" icon="pricing" title="Review pricing" text="Packages and hourly rates" />
          </div>
          {outstandingCents > 0 && (
            <p className="admin-help" style={{ marginTop: 18 }}>
              Estimated balance still to collect: <strong>{formatMoney(outstandingCents, { decimals: 0 })}</strong> (estimate until each job is finalised).
            </p>
          )}
        </AdminCard>
      </div>
    </div>
  );
}
