"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { AdminAlert, AdminCard, AdminEmptyState } from "../../_components/ui";
import { AdminStatusBadge } from "../../_components/AdminStatusBadge";
import { Icon } from "../../_components/Icon";

interface QueueItem {
  id: string;
  bookingNumber: string;
  status: string;
  startsAt: string;
  endsAt: string | null;
  customerName: string | null;
  pickup: string;
  destination: string;
  crewName: string | null;
  truckNames: string[];
  trucksRequired: number | null;
  needsCrew: boolean;
  needsTruck: boolean;
}

interface QueuesData {
  todayYmd: string;
  today: QueueItem[];
  upcoming: QueueItem[];
  needsAllocation: QueueItem[];
}

type TabKey = "today" | "upcoming" | "needsAllocation";

const TABS: Array<{ key: TabKey; label: string; empty: string }> = [
  { key: "today", label: "Today", empty: "No jobs are scheduled for today." },
  { key: "upcoming", label: "Upcoming", empty: "No jobs in the next 14 days." },
  { key: "needsAllocation", label: "Needs crew or truck", empty: "Every upcoming job has a crew and its trucks." },
];

const TZ = "Australia/Adelaide";
const dayFormat = new Intl.DateTimeFormat("en-AU", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });
const timeFormat = new Intl.DateTimeFormat("en-AU", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
const ymdFormat = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

interface Props {
  refreshKey: number;
  onOpenDay: (ymd: string) => void;
}

/** Today / upcoming / awaiting-assignment lists, all computed server-side in Australia/Adelaide. */
export function DispatchQueues({ refreshKey, onOpenDay }: Props) {
  const baseId = useId();
  const [tab, setTab] = useState<TabKey>("today");
  const [data, setData] = useState<QueuesData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/admin/dispatch/queues", { cache: "no-store", signal: controller.signal });
        const body = await response.json() as QueuesData | { error?: string };
        if (!response.ok) throw new Error("error" in body && body.error ? body.error : "Dispatch queues are unavailable.");
        setData(body as QueuesData);
      } catch (failure) {
        if (failure instanceof DOMException && failure.name === "AbortError") return;
        setError(failure instanceof Error ? failure.message : "Dispatch queues are unavailable.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [refreshKey]);

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = TABS.length - 1;
    const next = event.key === "ArrowRight" ? (index === last ? 0 : index + 1)
      : event.key === "ArrowLeft" ? (index === 0 ? last : index - 1)
      : event.key === "Home" ? 0 : event.key === "End" ? last : null;
    if (next === null) return;
    event.preventDefault();
    const key = TABS[next]!.key;
    setTab(key);
    tabRefs.current[key]?.focus();
  }

  const items = data?.[tab] ?? [];
  const active = TABS.find((entry) => entry.key === tab)!;

  return (
    <AdminCard title="Work queues" description="Jobs to run today, what is coming up, and what still needs a crew or truck." icon="bookings" className="a-dispatch-queues" id="dispatch-queues">
      <div className="a-dispatch-tabs" role="tablist" aria-label="Dispatch work queues">
        {TABS.map((entry, index) => (
          <button
            key={entry.key}
            type="button"
            role="tab"
            id={`${baseId}-${entry.key}-tab`}
            aria-selected={tab === entry.key}
            aria-controls={`${baseId}-panel`}
            tabIndex={tab === entry.key ? 0 : -1}
            ref={(node) => { tabRefs.current[entry.key] = node; }}
            onClick={() => setTab(entry.key)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className="a-dispatch-tab"
            data-alert={entry.key === "needsAllocation" && (data?.needsAllocation.length ?? 0) > 0 ? "true" : undefined}
          >
            {entry.label}
            <span className="a-dispatch-tab-count">{data ? data[entry.key].length : "–"}</span>
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`${baseId}-panel`} aria-labelledby={`${baseId}-${tab}-tab`} aria-busy={loading} tabIndex={0}>
        {error ? <AdminAlert tone="error">{error}</AdminAlert>
          : loading && !data ? <p className="admin-help" role="status">Loading jobs…</p>
          : items.length === 0 ? <AdminEmptyState icon="calendar" title={active.empty} />
          : (
            <ul className="a-dispatch-queue-list">
              {items.map((item) => {
                const day = ymdFormat.format(new Date(item.startsAt));
                return (
                  <li key={item.id} className="a-dispatch-queue-item">
                    <div className="a-dispatch-queue-when">
                      <strong>{timeFormat.format(new Date(item.startsAt))}</strong>
                      <span>{dayFormat.format(new Date(item.startsAt))}</span>
                    </div>
                    <div className="a-dispatch-queue-main">
                      <div className="a-dispatch-job-title">
                        <Link href={`/admin/bookings/${item.id}`}>{item.customerName ?? "Customer not recorded"}</Link>
                        <AdminStatusBadge status={item.status} />
                      </div>
                      <p>{item.bookingNumber} · {item.pickup || "Pickup not recorded"} → {item.destination || "Drop-off not recorded"}</p>
                      <div className="a-dispatch-chips">
                        <span data-missing={item.needsCrew || undefined}><Icon name="crew" size={13} />{item.crewName ?? "No crew"}</span>
                        <span data-missing={item.needsTruck || undefined}><Icon name="truck" size={13} />{item.truckNames.length ? item.truckNames.join(", ") : "No truck"}{item.trucksRequired && item.truckNames.length < item.trucksRequired ? ` (needs ${item.trucksRequired})` : ""}</span>
                      </div>
                    </div>
                    <div className="a-dispatch-queue-actions">
                      <button type="button" className="admin-btn admin-btn--secondary admin-btn--sm" onClick={() => { onOpenDay(day); document.getElementById("dispatch-run-sheet")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>Open day</button>
                      <Link href={`/admin/bookings/${item.id}`} className="admin-btn admin-btn--secondary admin-btn--sm">Open booking</Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
      </div>
    </AdminCard>
  );
}
