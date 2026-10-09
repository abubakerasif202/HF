import { statusStyle } from "../../_components/AdminStatusBadge";
import { Icon } from "../../_components/Icon";
import type { CalendarViewName, Resource } from "./calendar-model";

export interface Filters {
  vehicle: string;
  crew: string;
  status: string;
  packageId: string;
}

export const NO_FILTERS: Filters = { vehicle: "", crew: "", status: "", packageId: "" };

// Statuses the calendar can show (cancelled/expired/draft are excluded by the page query).
export const FILTERABLE_STATUSES = ["held", "pending_payment", "confirmed", "assigned", "in_progress", "completed"];

const VIEWS: CalendarViewName[] = ["day", "week", "month"];

export function CalendarToolbar({
  view,
  title,
  onView,
  onPrev,
  onNext,
  onToday,
}: {
  view: CalendarViewName;
  title: string;
  onView: (view: CalendarViewName) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  return (
    <div className="a-cal-toolbar">
      <div className="a-cal-nav">
        <button type="button" onClick={onPrev} className="a-cal-navbtn" aria-label={`Previous ${view}`}>
          <Icon name="chevronLeft" size={18} />
        </button>
        <button type="button" onClick={onNext} className="a-cal-navbtn" aria-label={`Next ${view}`}>
          <Icon name="chevronRight" size={18} />
        </button>
        <button type="button" onClick={onToday} className="admin-btn admin-btn--secondary admin-btn--sm">Today</button>
      </div>
      <h2 className="a-cal-title" aria-live="polite">{title}</h2>
      <div className="admin-segmented" role="group" aria-label="Calendar view">
        {VIEWS.map((name) => (
          <button key={name} type="button" aria-pressed={view === name} onClick={() => onView(name)}>{name}</button>
        ))}
      </div>
    </div>
  );
}

export function CalendarFilters({
  filters,
  onChange,
  vehicles,
  crews,
  packages,
}: {
  filters: Filters;
  onChange: (next: Filters) => void;
  vehicles: Resource[];
  crews: Resource[];
  packages: { id: string; name: string }[];
}) {
  const active = Object.values(filters).some(Boolean);
  const set = (key: keyof Filters) => (event: React.ChangeEvent<HTMLSelectElement>) => onChange({ ...filters, [key]: event.target.value });
  return (
    <div className="a-cal-filters">
      <span className="a-cal-filters-label"><Icon name="filter" size={15} />Filter</span>
      <select aria-label="Filter by vehicle" value={filters.vehicle} onChange={set("vehicle")} className="admin-input admin-input--compact">
        <option value="">All vehicles</option>
        {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
      </select>
      <select aria-label="Filter by crew" value={filters.crew} onChange={set("crew")} className="admin-input admin-input--compact">
        <option value="">All crews</option>
        {crews.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <select aria-label="Filter by status" value={filters.status} onChange={set("status")} className="admin-input admin-input--compact">
        <option value="">All statuses</option>
        {FILTERABLE_STATUSES.map((value) => <option key={value} value={value}>{statusStyle("booking", value).label}</option>)}
      </select>
      <select aria-label="Filter by package" value={filters.packageId} onChange={set("packageId")} className="admin-input admin-input--compact">
        <option value="">All packages</option>
        {packages.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
      {active && (
        <button type="button" className="a-cal-clear" onClick={() => onChange(NO_FILTERS)}>
          <Icon name="x" size={14} />
          Clear filters
        </button>
      )}
    </div>
  );
}

/** Status legend that doubles as a one-tap status filter. Counts come from the jobs in the visible range. */
export function CalendarLegend({
  counts,
  active,
  onPick,
}: {
  counts: Record<string, number>;
  active: string;
  onPick: (status: string) => void;
}) {
  return (
    <div className="a-cal-legend" role="group" aria-label="Booking statuses, tap to filter">
      {FILTERABLE_STATUSES.map((value) => {
        const style = statusStyle("booking", value);
        return (
          <button key={value} type="button" className="a-cal-legend-item" data-tone={style.tone} data-zero={(counts[value] ?? 0) === 0} aria-pressed={active === value} onClick={() => onPick(active === value ? "" : value)}>
            <Icon name={style.icon} size={13} />
            {style.label}
            <span className="a-cal-legend-count">{counts[value] ?? 0}</span>
          </button>
        );
      })}
      <span className="a-cal-legend-item a-cal-legend-item--block" aria-hidden="false">
        <Icon name="ban" size={13} />
        Blocked time
      </span>
    </div>
  );
}
