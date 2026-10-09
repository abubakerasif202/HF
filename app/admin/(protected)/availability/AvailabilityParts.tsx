import { Icon, type IconName } from "../../_components/Icon";
import { AdminEmptyState, formatAdelaide } from "../../_components/ui";
import { DeleteBlockedTimeButton } from "./DeleteBlockedTimeButton";
import {
  blockScope,
  blockState,
  formatDuration,
  resourceStatus,
  scopeLabel,
  type BlockedRow,
  type BlockState,
  type ResourceRef,
  type ResourceStatus,
} from "./availability-model";

const SCOPE_ICON: Record<"all" | "vehicle" | "crew", IconName> = { all: "ban", vehicle: "truck", crew: "crew" };

const STATUS_COPY: Record<ResourceStatus["state"], { label: string; icon: IconName; tone: string }> = {
  available: { label: "Available", icon: "check", tone: "success" },
  "blocked-now": { label: "Blocked now", icon: "ban", tone: "warning" },
  "blocked-later": { label: "Block coming up", icon: "clock", tone: "info" },
};

const STATE_COPY: Record<BlockState, { label: string; icon: IconName; tone: string }> = {
  active: { label: "Active now", icon: "ban", tone: "warning" },
  upcoming: { label: "Upcoming", icon: "clock", tone: "info" },
  past: { label: "Ended", icon: "check", tone: "neutral" },
};

function ResourceCard({ kind, resource, rows, nowMs }: { kind: "vehicle" | "crew"; resource: ResourceRef; rows: BlockedRow[]; nowMs: number }) {
  const status = resourceStatus(rows, kind, resource.id, nowMs);
  const copy = STATUS_COPY[status.state];
  const detail =
    status.state === "blocked-now" && status.block
      ? `Until ${formatAdelaide(status.block.ends_at, { dateStyle: "medium", timeStyle: "short" })}`
      : status.state === "blocked-later" && status.block
        ? `From ${formatAdelaide(status.block.starts_at, { dateStyle: "medium", timeStyle: "short" })}`
        : "No blocked time scheduled";
  return (
    <li className="a-av-resource" data-state={status.state}>
      <span className="a-av-resource-icon"><Icon name={kind === "vehicle" ? "truck" : "crew"} size={20} /></span>
      <div className="a-av-resource-body">
        <p className="a-av-resource-name">{resource.name}</p>
        <p className="a-av-resource-detail">{detail}</p>
        {status.block && <p className="a-av-resource-reason">{status.block.reason}</p>}
      </div>
      <span className="admin-badge" data-tone={copy.tone}>
        <Icon name={copy.icon} size={13} />
        {copy.label}
      </span>
    </li>
  );
}

export function ResourceGroup({
  kind,
  title,
  resources,
  rows,
  nowMs,
}: {
  kind: "vehicle" | "crew";
  title: string;
  resources: ResourceRef[];
  rows: BlockedRow[];
  nowMs: number;
}) {
  const noun = kind === "vehicle" ? "trucks" : "crews";
  return (
    <div className="a-av-group">
      <h3 className="a-av-group-title"><Icon name={kind === "vehicle" ? "truck" : "crew"} size={16} />{title}</h3>
      {resources.length === 0 ? (
        <p className="admin-help">No active {noun}. Add or reactivate them under {kind === "vehicle" ? "Vehicles" : "Crews"}.</p>
      ) : (
        <ul className="a-av-resources">
          {resources.map((resource) => <ResourceCard key={resource.id} kind={kind} resource={resource} rows={rows} nowMs={nowMs} />)}
        </ul>
      )}
    </div>
  );
}

function BlockEntry({ row, state }: { row: BlockedRow; state: BlockState }) {
  const scope = blockScope(row);
  const copy = STATE_COPY[state];
  const start = formatAdelaide(row.starts_at, { dateStyle: "medium", timeStyle: "short" });
  const end = formatAdelaide(row.ends_at, { dateStyle: "medium", timeStyle: "short" });
  const label = scopeLabel(row);
  return (
    <li className="a-av-entry" data-scope={scope} data-state={state}>
      <div className="a-av-date" aria-hidden="true">
        <span className="a-av-date-mon">{formatAdelaide(row.starts_at, { month: "short" })}</span>
        <span className="a-av-date-day">{formatAdelaide(row.starts_at, { day: "numeric" })}</span>
      </div>
      <div className="a-av-entry-body">
        <div className="a-av-entry-tags">
          <span className="a-av-scope-chip" data-scope={scope}>
            <Icon name={SCOPE_ICON[scope]} size={14} />
            {label}
          </span>
          <span className="admin-badge" data-tone={copy.tone}>
            <Icon name={copy.icon} size={13} />
            {copy.label}
          </span>
        </div>
        <p className="a-av-entry-range">
          <span>{start}</span>
          <Icon name="arrowRight" size={14} />
          <span>{end}</span>
          <span className="a-av-entry-length">{formatDuration(row.starts_at, row.ends_at)}</span>
        </p>
        <p className="a-av-entry-reason">{row.reason}</p>
      </div>
      <DeleteBlockedTimeButton id={row.id} summary={`${label}, ${start} to ${end}.`} />
    </li>
  );
}

export function BlockTimeline({ rows, nowMs }: { rows: BlockedRow[]; nowMs: number }) {
  if (rows.length === 0) {
    return (
      <AdminEmptyState icon="availability" title="No blocked times" description="Every active truck and crew is bookable during business hours." />
    );
  }
  const withState = rows.map((row) => ({ row, state: blockState(row, nowMs) }));
  const sections: { key: BlockState; title: string; items: typeof withState }[] = [
    { key: "active", title: "Blocked right now", items: withState.filter((entry) => entry.state === "active") },
    { key: "upcoming", title: "Upcoming", items: withState.filter((entry) => entry.state === "upcoming") },
  ];
  const past = withState.filter((entry) => entry.state === "past").reverse();
  return (
    <div className="a-av-timeline">
      {sections.map((section) =>
        section.items.length === 0 ? null : (
          <section key={section.key} aria-label={section.title}>
            <h3 className="a-av-timeline-title">{section.title}<span>{section.items.length}</span></h3>
            <ol className="a-av-entries">
              {section.items.map(({ row, state }) => <BlockEntry key={row.id} row={row} state={state} />)}
            </ol>
          </section>
        ),
      )}
      {sections.every((section) => section.items.length === 0) && (
        <p className="admin-help">Nothing is blocked now or coming up.</p>
      )}
      {past.length > 0 && (
        <details className="a-av-past">
          <summary>Past blocks <span>{past.length}</span></summary>
          <ol className="a-av-entries">
            {past.map(({ row, state }) => <BlockEntry key={row.id} row={row} state={state} />)}
          </ol>
        </details>
      )}
    </div>
  );
}
