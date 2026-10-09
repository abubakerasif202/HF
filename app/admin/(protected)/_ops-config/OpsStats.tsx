import type { ReactNode } from "react";
import "../../styles/ops-config.css";

export interface OpsStat {
  label: string;
  value: ReactNode;
  /** Small suffix shown beside the value, e.g. "of 4". */
  unit?: string;
  hint?: ReactNode;
  tone?: "warn" | "gold";
}

/** Compact, honest summary tiles. Every value is derived from rows the page already loaded. */
export function OpsStats({ stats }: { stats: OpsStat[] }) {
  return (
    <div className="a-ops-stats">
      {stats.map((stat, index) => (
        <div key={stat.label} className="a-ops-stat a-reveal" data-tone={stat.tone} style={{ ["--i" as string]: index }}>
          <p className="a-ops-stat-label">{stat.label}</p>
          <p className="a-ops-stat-value">
            {stat.value}
            {stat.unit && <small> {stat.unit}</small>}
          </p>
          {stat.hint && <p className="a-ops-stat-hint">{stat.hint}</p>}
        </div>
      ))}
    </div>
  );
}

/** Two-letter initials for avatars. Display only. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : (parts[0][1] ?? "");
  return `${first}${last}`.toUpperCase();
}
