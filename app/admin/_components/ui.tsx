import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

/**
 * HF Private Operations — shared presentational building blocks.
 * Styles live in app/admin/styles/*.css. Server-safe: no hooks, no client
 * state, so client components can import them too.
 */

/* ------------------------------------------------------------------ Page */

export function AdminPageHeader({
  title,
  description,
  eyebrow,
  actions,
  back,
}: {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div>
      {back && (
        <Link href={back.href} className="admin-back-link">
          <Icon name="arrowLeft" size={16} />
          {back.label}
        </Link>
      )}
      <header className="admin-page-header">
        <div className="admin-page-header-text">
          {eyebrow && <p className="admin-page-eyebrow">{eyebrow}</p>}
          <h1 className="admin-page-title">{title}</h1>
          {description && <p className="admin-page-description">{description}</p>}
        </div>
        {actions && <div className="admin-page-actions">{actions}</div>}
      </header>
    </div>
  );
}

/** Dark-emerald command hero with road-line artwork. `title` may include <em>. */
export function PageHero({
  eyebrow,
  title,
  lede,
  actions,
  stats,
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  lede?: ReactNode;
  actions?: ReactNode;
  stats?: { value: ReactNode; label: string }[];
}) {
  return (
    <section className="a-hero" aria-labelledby="a-hero-title">
      <svg className="a-hero-art" viewBox="0 0 1200 520" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
        <circle className="ring" cx="1030" cy="120" r="150" />
        <circle className="ring" cx="1030" cy="120" r="230" />
        <circle className="ring" cx="1030" cy="120" r="320" />
        <path className="road" d="M-60 470C250 330 520 360 770 230S1120 90 1290 130" />
        <path className="road" d="M-60 500C260 370 530 396 790 266S1130 128 1290 166" />
        <path className="road-dash" d="M-60 485C255 350 525 378 780 248S1125 109 1290 148" />
      </svg>
      <div className="a-hero-top">
        <div>
          <p className="a-eyebrow">{eyebrow}</p>
          <h1 id="a-hero-title" className="a-hero-title">{title}</h1>
          {lede && <p className="a-hero-lede">{lede}</p>}
          {actions && <div className="a-hero-actions">{actions}</div>}
        </div>
      </div>
      {stats && stats.length > 0 && (
        <dl className="a-hero-stats">
          {stats.map((stat) => (
            <div className="a-hero-stat" key={stat.label}>
              <dd className="a-hero-stat-value" style={{ margin: 0 }}>{stat.value}</dd>
              <dt className="a-hero-stat-label">{stat.label}</dt>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

/* ----------------------------------------------------------- Cards/panels */

export function AdminCard({
  title,
  description,
  icon,
  actions,
  children,
  flush,
  className = "",
  id,
  variant,
}: {
  title?: ReactNode;
  description?: ReactNode;
  icon?: IconName;
  actions?: ReactNode;
  children: ReactNode;
  flush?: boolean;
  className?: string;
  id?: string;
  variant?: "dark" | "sunken";
}) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section id={id} className={`admin-card ${className}`} data-variant={variant} aria-labelledby={title ? headingId : undefined}>
      {title && (
        <div className="admin-card-header">
          <div className="admin-card-heading">
            {icon && <Icon name={icon} size={18} />}
            <div>
              <h2 id={headingId} className="admin-card-title">{title}</h2>
              {description && <p className="admin-card-description">{description}</p>}
            </div>
          </div>
          {actions}
        </div>
      )}
      <div className={flush ? "admin-card-body--flush" : "admin-card-body"}>{children}</div>
    </section>
  );
}

/** SectionPanel and ChartPanel are AdminCard presets so every page shares one surface system. */
export const SectionPanel = AdminCard;

export function ChartPanel({
  title,
  description,
  icon = "activity",
  actions,
  children,
  className = "",
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: IconName;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <AdminCard title={title} description={description} icon={icon} actions={actions} className={className}>
      <div className="a-chart">{children}</div>
    </AdminCard>
  );
}

/* ----------------------------------------------------------------- Metrics */

export function TrendIndicator({ direction, children }: { direction: "up" | "down" | "flat"; children: ReactNode }) {
  const icon: IconName = direction === "up" ? "trendUp" : direction === "down" ? "trendDown" : "arrowRight";
  return (
    <span className="a-trend" data-dir={direction}>
      <Icon name={icon} size={13} />
      {children}
    </span>
  );
}

export function MetricCard({
  icon,
  label,
  value,
  hint,
  variant = "porcelain",
  span,
  wide,
  trend,
  art,
  style,
}: {
  icon: IconName;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  variant?: "porcelain" | "feature" | "deep" | "gold" | "alert";
  span?: 3 | 4 | 5 | 6;
  wide?: boolean;
  trend?: ReactNode;
  art?: ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <article className="a-metric a-reveal" data-variant={variant} data-span={span} data-wide={wide} data-art={art ? "true" : undefined} style={style}>
      {art && <div className="a-metric-art" aria-hidden="true">{art}</div>}
      <div className="a-metric-top">
        <span className="a-metric-icon"><Icon name={icon} size={20} /></span>
        {trend}
      </div>
      <p className="a-metric-label" style={{ marginTop: 16 }}>{label}</p>
      <p className="a-metric-value">{value}</p>
      {hint && <p className="a-metric-hint">{hint}</p>}
    </article>
  );
}

export function QuickAction({ href, icon, title, text }: { href: string; icon: IconName; title: string; text: string }) {
  return (
    <Link href={href} className="a-quick">
      <span className="a-quick-icon"><Icon name={icon} size={19} /></span>
      <span>
        <span className="a-quick-title" style={{ display: "block" }}>{title}</span>
        <span className="a-quick-text" style={{ display: "block" }}>{text}</span>
      </span>
      <Icon name="chevronRight" size={18} />
    </Link>
  );
}

/* --------------------------------------------------------------- Data rows */

export function AdminDataList({ children }: { children: ReactNode }) {
  return <dl className="admin-dl">{children}</dl>;
}

export function AdminDataRow({
  label,
  value,
  tone,
  className = "",
}: {
  label: ReactNode;
  value: ReactNode;
  tone?: "mono" | "strong" | "ruby" | "green";
  className?: string;
}) {
  return (
    <div className={`admin-dl-row ${className}`}>
      <dt>{label}</dt>
      <dd className={tone ? `is-${tone}` : undefined}>{value === "" || value == null ? "—" : value}</dd>
    </div>
  );
}

/** Responsive table shell: scrolls on desktop, becomes stacked cards below 900px. */
export function DataTable({
  columns,
  children,
  minWidth = 940,
  className = "",
}: {
  columns: { label: string; srOnly?: boolean }[];
  children: ReactNode;
  minWidth?: number;
  className?: string;
}) {
  return (
    <div className="admin-table-wrap">
      <table className={`admin-table admin-table--stack ${className}`} style={{ ["--table-min" as string]: `${minWidth}px` }}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.label} scope="col">
                {column.srOnly ? <span className="sr-only">{column.label}</span> : column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

/* ----------------------------------------------------------------- States */

export function AdminEmptyState({
  icon = "inbox",
  title,
  description,
  action,
}: {
  icon?: IconName;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="admin-empty">
      <div className="admin-empty-icon"><Icon name={icon} size={26} /></div>
      <p className="admin-empty-title">{title}</p>
      {description && <p className="admin-empty-text">{description}</p>}
      {action && <div className="admin-empty-action">{action}</div>}
    </div>
  );
}

export const EmptyState = AdminEmptyState;

export function AdminAlert({ tone, children }: { tone: "error" | "success" | "info"; children: ReactNode }) {
  const icon: IconName = tone === "error" ? "alert" : tone === "success" ? "check" : "clock";
  return (
    <div className={`admin-alert admin-alert--${tone}`} role={tone === "error" ? "alert" : "status"}>
      <Icon name={icon} size={16} />
      <div>{children}</div>
    </div>
  );
}

/** Shimmering placeholder rows while data loads. Decorative: announce via a status region. */
export function SkeletonLoader({ rows = 4, label = "Loading" }: { rows?: number; label?: string }) {
  return (
    <div className="a-skeleton-stack" role="status" aria-live="polite">
      <span className="sr-only">{label}…</span>
      {Array.from({ length: rows }, (_, index) => (
        <span key={index} className="a-skeleton" style={{ height: index === 0 ? 22 : 52, width: index === 0 ? "38%" : "100%" }} aria-hidden="true" />
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- Activity */

export interface ActivityItem {
  id: string;
  title: ReactNode;
  meta?: ReactNode;
  time?: string;
  tone?: "default" | "gold" | "info";
}

export function ActivityTimeline({ items }: { items: ActivityItem[] }) {
  return (
    <ol className="a-timeline">
      {items.map((item) => (
        <li key={item.id} data-tone={item.tone === "default" ? undefined : item.tone}>
          <div className="admin-timeline-title">{item.title}</div>
          {(item.meta || item.time) && (
            <div className="admin-timeline-meta">
              {item.meta}
              {item.meta && item.time ? " · " : ""}
              {item.time}
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}

/* ----------------------------------------------------------------- Format */

/** Display-only money formatting. Never used for any calculation. */
export function formatMoney(cents: number | null | undefined, { decimals = 2 }: { decimals?: 0 | 2 } = {}): string {
  const value = (cents ?? 0) / 100;
  return value.toLocaleString("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function formatAdelaide(iso: string, options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" }): string {
  return new Date(iso).toLocaleString("en-AU", { timeZone: "Australia/Adelaide", ...options });
}
