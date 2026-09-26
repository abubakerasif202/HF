import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

/**
 * Shared presentational building blocks for the light admin design
 * system (styles live in app/admin/admin.css). Server-safe: no hooks,
 * no client state — client components can import them too.
 */

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

export function AdminCard({
  title,
  description,
  icon,
  actions,
  children,
  flush,
  className = "",
  id,
}: {
  title?: ReactNode;
  description?: ReactNode;
  icon?: IconName;
  actions?: ReactNode;
  children: ReactNode;
  flush?: boolean;
  className?: string;
  id?: string;
}) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section id={id} className={`admin-card ${className}`} aria-labelledby={title ? headingId : undefined}>
      {title && (
        <div className="admin-card-header">
          <div className="admin-card-heading">
            {icon && <Icon name={icon} />}
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
      <div className="admin-empty-icon"><Icon name={icon} size={24} /></div>
      <p className="admin-empty-title">{title}</p>
      {description && <p className="admin-empty-text">{description}</p>}
      {action && <div className="admin-empty-action">{action}</div>}
    </div>
  );
}

export function AdminAlert({ tone, children }: { tone: "error" | "success" | "info"; children: ReactNode }) {
  const icon: IconName = tone === "error" ? "alert" : tone === "success" ? "check" : "clock";
  return (
    <div className={`admin-alert admin-alert--${tone}`} role={tone === "error" ? "alert" : "status"}>
      <Icon name={icon} size={16} />
      <div>{children}</div>
    </div>
  );
}

/** Display-only money formatting. Never used for any calculation. */
export function formatMoney(cents: number | null | undefined, { decimals = 2 }: { decimals?: 0 | 2 } = {}): string {
  const value = (cents ?? 0) / 100;
  return value.toLocaleString("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function formatAdelaide(iso: string, options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" }): string {
  return new Date(iso).toLocaleString("en-AU", { timeZone: "Australia/Adelaide", ...options });
}
