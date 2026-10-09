import Link from "next/link";
import {
  dayNumber,
  fmtTime,
  hourLabel,
  hourWindow,
  longDayLabel,
  mondayIndex,
  placeInLanes,
  shortWeekday,
  type DayData,
} from "./calendar-model";
import { statusStyle } from "../../_components/AdminStatusBadge";
import { Icon } from "../../_components/Icon";
import { BlockedCard, BookingCard, GridBlock, GridEvent, blockScope } from "./CalendarEvents";

const HOUR_PX = 76;
const MONTH_CHIPS = 3;

interface GridProps {
  days: DayData[];
  timezone: string;
  todayKey: string;
  onOpenDay: (key: string) => void;
}

/* ------------------------------------------------------------ Time grid */

function DayHead({ day, todayKey, onOpenDay }: { day: DayData; todayKey: string; onOpenDay: (key: string) => void }) {
  const isToday = day.key === todayKey;
  const jobs = day.bookings.length;
  return (
    <button type="button" className="a-cal-head" data-today={isToday} onClick={() => onOpenDay(day.key)} aria-label={`Open ${longDayLabel(day.key)}${isToday ? " (today)" : ""}`}>
      <span className="a-cal-head-dow">{shortWeekday(day.key)}</span>
      <span className="a-cal-head-num">{dayNumber(day.key)}</span>
      <span className="a-cal-head-count">{jobs === 0 ? "No jobs" : `${jobs} job${jobs === 1 ? "" : "s"}`}</span>
    </button>
  );
}

const CASCADE_SPREAD = 42;
const CASCADE_PEEK = 12;

/** Overlapping jobs cascade (later ones sit on top, offset) so each stays wide enough to read. */
function laneStyle(lane: number, lanes: number, top: string, height: string): React.CSSProperties {
  if (lanes === 1) return { top, height, left: 0, width: "100%" };
  const left = (lane / (lanes - 1)) * CASCADE_SPREAD;
  const width = lane === lanes - 1 ? 100 - left : 100 - left - CASCADE_PEEK;
  return { top, height, left: `${left}%`, width: `${width}%`, zIndex: 2 + lane };
}

export function TimeGrid({ days, timezone, todayKey, onOpenDay, nowMinutes }: GridProps & { nowMinutes: number | null }) {
  const { startHour, endHour } = hourWindow(days.flatMap((day) => [...day.bookings, ...day.blocks]));
  const hours = endHour - startHour;
  const windowMinutes = hours * 60;
  const hourMarks = Array.from({ length: hours }, (_, index) => startHour + index);
  const pct = (minutes: number) => `${((minutes - startHour * 60) / windowMinutes) * 100}%`;
  const heightPct = (from: number, to: number) => `${((to - from) / windowMinutes) * 100}%`;

  return (
    <div className="a-cal-time" data-cols={days.length} style={{ ["--cols" as string]: days.length, ["--hour-px" as string]: `${HOUR_PX}px`, ["--hours" as string]: hours }}>
      <div className="a-cal-time-heads">
        <span aria-hidden="true" />
        {days.map((day) => <DayHead key={day.key} day={day} todayKey={todayKey} onOpenDay={onOpenDay} />)}
      </div>
      <div className="a-cal-time-body">
        <div className="a-cal-gutter" aria-hidden="true">
          {hourMarks.map((hour) => <span key={hour}>{hourLabel(hour)}</span>)}
        </div>
        {days.map((day) => {
          const lanes = placeInLanes(day.bookings.map((span) => ({ item: span.item, from: span.from, to: span.to })));
          const showNow = day.key === todayKey && nowMinutes !== null && nowMinutes >= startHour * 60 && nowMinutes <= endHour * 60;
          return (
            <section key={day.key} className="a-cal-col" data-today={day.key === todayKey} aria-label={longDayLabel(day.key)}>
              {day.blocks.map((span) => (
                <div key={span.item.id} className="a-cal-slot a-cal-slot--block" style={{ top: pct(Math.max(span.from, startHour * 60)), height: heightPct(Math.max(span.from, startHour * 60), Math.min(span.to, endHour * 60)) }}>
                  <GridBlock block={span.item} timezone={timezone} />
                </div>
              ))}
              {lanes.map((placed) => {
                const from = Math.max(placed.from, startHour * 60);
                const to = Math.min(placed.to, endHour * 60);
                return (
                  <div
                    key={placed.item.id}
                    className="a-cal-slot"
                    style={laneStyle(placed.lane, placed.lanes, pct(from), heightPct(from, to))}
                  >
                    <GridEvent booking={placed.item} timezone={timezone} heightPx={((to - from) / 60) * HOUR_PX} />
                  </div>
                );
              })}
              {showNow && <span className="a-cal-now" style={{ top: pct(nowMinutes) }} aria-hidden="true" />}
            </section>
          );
        })}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- Month grid */

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function MonthGrid({ days, timezone, todayKey, onOpenDay }: GridProps) {
  const lead = days.length > 0 ? mondayIndex(days[0].key) : 0;
  const trail = (7 - ((lead + days.length) % 7)) % 7;
  return (
    <div className="a-cal-month">
      <div className="a-cal-month-dow" aria-hidden="true">
        {WEEKDAYS.map((name) => <span key={name}>{name}</span>)}
      </div>
      <div className="a-cal-month-grid">
        {Array.from({ length: lead }, (_, index) => <span key={`l${index}`} className="a-cal-cell a-cal-cell--pad" aria-hidden="true" />)}
        {days.map((day) => <MonthCell key={day.key} day={day} timezone={timezone} isToday={day.key === todayKey} onOpenDay={onOpenDay} />)}
        {Array.from({ length: trail }, (_, index) => <span key={`t${index}`} className="a-cal-cell a-cal-cell--pad" aria-hidden="true" />)}
      </div>
    </div>
  );
}

function MonthCell({ day, timezone, isToday, onOpenDay }: { day: DayData; timezone: string; isToday: boolean; onOpenDay: (key: string) => void }) {
  const shown = day.bookings.slice(0, MONTH_CHIPS);
  const hidden = day.bookings.length - shown.length;
  return (
    <section className="a-cal-cell" data-today={isToday} data-empty={day.bookings.length === 0 && day.blocks.length === 0} aria-label={longDayLabel(day.key)}>
      <button type="button" className="a-cal-cell-num" onClick={() => onOpenDay(day.key)} aria-label={`Open ${longDayLabel(day.key)}`}>
        {dayNumber(day.key)}
      </button>
      {day.blocks.length > 0 && (
        <Link href="/admin/availability" className="a-cal-chip a-cal-chip--block" title={day.blocks.map((span) => `${blockScope(span.item).label}: ${span.item.reason}`).join("\n")}>
          <Icon name="ban" size={11} />
          {day.blocks.length === 1 ? blockScope(day.blocks[0].item).label : `${day.blocks.length} blocks`}
        </Link>
      )}
      {shown.map((span) => {
        const style = statusStyle("booking", span.item.status);
        return (
          <Link key={span.item.id} href={`/admin/bookings/${span.item.id}`} className="a-cal-chip" data-tone={style.tone} title={`${span.item.customerName ?? "Customer"} · ${style.label}`}>
            <Icon name={style.icon} size={11} />
            <span className="a-cal-chip-time">{fmtTime(span.item.startsAt, timezone)}</span>
            <span className="a-cal-chip-name">{span.item.customerName ?? "—"}</span>
            <span className="sr-only">{style.label}</span>
          </Link>
        );
      })}
      {hidden > 0 && (
        <button type="button" className="a-cal-more" onClick={() => onOpenDay(day.key)}>+{hidden} more</button>
      )}
    </section>
  );
}

/* --------------------------------------------------------------- Agenda */

export function AgendaView({ days, timezone, todayKey, hideEmpty }: Omit<GridProps, "onOpenDay"> & { hideEmpty: boolean }) {
  const visible = hideEmpty ? days.filter((day) => day.bookings.length + day.blocks.length > 0) : days;
  return (
    <div className="a-cal-agenda">
      {visible.map((day) => {
        const isToday = day.key === todayKey;
        const merged = [
          ...day.blocks.map((span) => ({ kind: "block" as const, span })),
          ...day.bookings.map((span) => ({ kind: "job" as const, span })),
        ].sort((a, b) => a.span.from - b.span.from);
        return (
          <section key={day.key} className="a-cal-agenda-day" data-today={isToday} data-empty={merged.length === 0} aria-label={longDayLabel(day.key)}>
            <header className="a-cal-agenda-head">
              <span className="a-cal-agenda-date" aria-hidden="true">
                <span>{shortWeekday(day.key)}</span>
                <strong>{dayNumber(day.key)}</strong>
              </span>
              <span className="a-cal-agenda-title">
                {longDayLabel(day.key)}
                {isToday && <span className="a-cal-today-pill">Today</span>}
              </span>
              <span className="a-cal-agenda-count">{day.bookings.length === 0 ? "No jobs" : `${day.bookings.length} job${day.bookings.length === 1 ? "" : "s"}`}</span>
            </header>
            {merged.length > 0 && (
              <div className="a-cal-agenda-list">
                {merged.map((entry) =>
                  entry.kind === "job" ? (
                    <BookingCard key={`b-${entry.span.item.id}`} booking={entry.span.item} timezone={timezone} />
                  ) : (
                    <BlockedCard key={`x-${entry.span.item.id}`} block={entry.span.item} timezone={timezone} />
                  ),
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
