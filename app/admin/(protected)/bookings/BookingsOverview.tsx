import Link from "next/link";
import { Icon, type IconName } from "../../_components/Icon";
import { statusStyle } from "../../_components/AdminStatusBadge";
import { formatMoney } from "../../_components/ui";
import type { BookingSummary } from "./grouping";

interface StatProps {
  icon: IconName;
  label: string;
  value: string | number;
  hint: string;
  tone?: "deep" | "warn";
  index: number;
}

function Stat({ icon, label, value, hint, tone, index }: StatProps) {
  return (
    <div className="a-bk-stat a-reveal" data-tone={tone} style={{ "--i": index } as React.CSSProperties}>
      <span className="a-bk-stat-icon"><Icon name={icon} size={18} /></span>
      <p className="a-bk-stat-value">{value}</p>
      <p className="a-bk-stat-label">{label}</p>
      <p className="a-bk-stat-hint">{hint}</p>
    </div>
  );
}

/** Four summary tiles. Every figure is derived from the loaded rows only, and says so. */
export function BookingsSummaryStrip({ summary, shown }: { summary: BookingSummary; shown: number }) {
  const scope = `of the ${shown} shown`;
  return (
    <div className="a-bk-stats" role="group" aria-label={`Booking summary, ${scope}`}>
      <Stat index={0} tone="deep" icon="calendar" label="Today" value={summary.today} hint={`Moves today, ${scope}`} />
      <Stat index={1} icon="calendarCheck" label="Upcoming" value={summary.upcoming} hint={`Confirmed to in progress, ${scope}`} />
      <Stat
        index={2}
        tone={summary.needsTruck > 0 ? "warn" : undefined}
        icon="truck"
        label="Need a truck"
        value={summary.needsTruck}
        hint={summary.needsTruck > 0 ? `Confirmed with no truck, ${scope}` : `Every confirmed job has one, ${scope}`}
      />
      <Stat
        index={3}
        icon="dollar"
        label="Balance due"
        value={formatMoney(summary.balanceDueCents, { decimals: 0 })}
        hint={summary.balanceJobs > 0 ? `Across ${summary.balanceJobs} ${summary.balanceJobs === 1 ? "booking" : "bookings"}, estimate until finalised` : `Nothing owing, ${scope}`}
      />
    </div>
  );
}

interface FilterProps {
  active: string;
  total: number;
  statuses: { status: string; count: number }[];
}

/** Status filter as plain links: the filter lives in the URL, works without JavaScript and is shareable. */
export function BookingStatusFilter({ active, total, statuses }: FilterProps) {
  const chips = [{ status: "all", label: "All", count: total }, ...statuses.map((s) => ({ ...s, label: statusStyle("booking", s.status).label }))];
  return (
    <nav className="a-bk-chips" aria-label="Filter bookings by status">
      {chips.map((chip) => (
        <Link
          key={chip.status}
          href={chip.status === "all" ? "/admin/bookings" : `/admin/bookings?status=${chip.status}`}
          className="a-bk-chip"
          aria-current={active === chip.status ? "true" : undefined}
          scroll={false}
        >
          {chip.label}
          <b>{chip.count}</b>
        </Link>
      ))}
    </nav>
  );
}
