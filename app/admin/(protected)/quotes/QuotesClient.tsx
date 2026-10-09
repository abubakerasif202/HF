"use client";

import { useCallback, useMemo, useState, type CSSProperties } from "react";
import { Refine, useList, useUpdate, type DataProvider } from "@refinedev/core";
import { AdminAlert, AdminCard, AdminEmptyState, AdminPageHeader, SkeletonLoader, formatAdelaide } from "../../_components/ui";
import { AdminStatusBadge, QUOTE_STATUS } from "../../_components/AdminStatusBadge";
import { DetailDrawer } from "../../_components/DetailDrawer";
import { Icon } from "../../_components/Icon";

import { QUOTE_STATUS_ORDER, type QuoteStatus, type StatusCounts } from "./quoteStatus";

type DeliveryStatus = "pending" | "sent" | "failed" | "unknown";
type Quote = {
  id: string;
  payload: Record<string, string | string[]>;
  quote_status: QuoteStatus;
  delivery_status: DeliveryStatus;
  created_at: string;
};

const STATUSES: { value: QuoteStatus; label: string }[] = QUOTE_STATUS_ORDER.map((value) => ({ value, label: QUOTE_STATUS[value].label }));
const STATUS_COLOR: Record<QuoteStatus, string> = {
  new: "var(--a-brand)",
  quote_sent: "var(--a-info)",
  follow_up: "var(--a-warning)",
  booked: "var(--a-success)",
  completed: "var(--a-viz-3)",
  lost: "var(--a-faint)",
};

/** Suggested next steps per stage. These only ever change quote_status, the one real mutation available. */
const NEXT_STEPS: Record<QuoteStatus, { to: QuoteStatus; label: string; primary?: boolean }[]> = {
  new: [{ to: "quote_sent", label: "Mark quote sent", primary: true }, { to: "follow_up", label: "Needs follow-up" }, { to: "lost", label: "Mark lost" }],
  quote_sent: [{ to: "follow_up", label: "Needs follow-up", primary: true }, { to: "booked", label: "Mark booked" }, { to: "lost", label: "Mark lost" }],
  follow_up: [{ to: "booked", label: "Mark booked", primary: true }, { to: "quote_sent", label: "Back to quote sent" }, { to: "lost", label: "Mark lost" }],
  booked: [{ to: "completed", label: "Mark completed", primary: true }, { to: "follow_up", label: "Back to follow-up" }],
  completed: [{ to: "follow_up", label: "Reopen as follow-up" }],
  lost: [{ to: "new", label: "Reopen as new", primary: true }],
};

const DETAIL_FIELDS: { key: string; label: string }[] = [
  { key: "move_category", label: "Move category" },
  { key: "move_type", label: "Move type" },
  { key: "truck_package_id", label: "Truck selection" },
  { key: "property_size", label: "Property size" },
  { key: "floor_access", label: "Floor access" },
  { key: "parking_access", label: "Parking" },
  { key: "boxes_needed", label: "Boxes" },
  { key: "services[]", label: "Extra services" },
];

const MISSING = "—";

function field(quote: Quote, name: string): string {
  const value = quote.payload?.[name];
  if (typeof value === "string") return value.trim() || MISSING;
  return Array.isArray(value) ? value.join(", ") || MISSING : MISSING;
}

function hasValue(value: string): boolean {
  return value !== MISSING;
}

function initialsOf(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (!hasValue(name) || parts.length === 0) return "?";
  return ((parts[0][0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "")).toUpperCase();
}

/** tel: target only when the value contains a plausible number (never "tel:—"). */
function telHref(phone: string): string | null {
  const digits = phone.replace(/[^\d+]/g, "");
  return digits.replace(/\D/g, "").length >= 6 ? `tel:${digits}` : null;
}

function mailHref(email: string): string | null {
  return /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email) ? `mailto:${email}` : null;
}

/** Customer-supplied URL: link only http(s) pages on the HF domain. Anything else shows as plain text. */
function safeSourceUrl(value: string): string | null {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const ours = host === "hfremovalsadelaide.com.au" || host.endsWith(".hfremovalsadelaide.com.au");
    return (url.protocol === "https:" || url.protocol === "http:") && ours ? url.toString() : null;
  } catch {
    return null;
  }
}

function formatPreferredDate(value: string): { text: string; soon: string | null } {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return { text: value, soon: null };
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  const text = date.toLocaleDateString("en-AU", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const today = new Date();
  const days = Math.round((date.getTime() - Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) / 86_400_000);
  const soon = days === 0 ? "Today" : days === 1 ? "Tomorrow" : days > 1 && days <= 14 ? `In ${days} days` : days < 0 ? "Date passed" : null;
  return { text, soon };
}

function ago(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

const dataProvider: DataProvider = {
  getApiUrl: () => "/api/admin/quotes",
  getList: async ({ resource, pagination, filters }) => {
    if (resource !== "quotes") throw new Error("Unknown resource");
    const params = new URLSearchParams({
      page: String(pagination?.currentPage ?? 1),
      pageSize: String(pagination?.pageSize ?? 20),
    });
    const filter = filters?.find((item) => "field" in item && item.field === "quote_status");
    if (filter && "value" in filter && typeof filter.value === "string") {
      params.set("status", filter.value);
    }
    const response = await fetch(`/api/admin/quotes?${params.toString()}`, { cache: "no-store" });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || "Could not load quote enquiries");
    }
    return response.json();
  },
  update: async ({ resource, id, variables }) => {
    if (resource !== "quotes") throw new Error("Unknown resource");
    const response = await fetch("/api/admin/quotes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, quote_status: (variables as { quote_status?: string }).quote_status }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || "Could not update quote");
    }
    return response.json();
  },
  getOne: async () => { throw new Error("Not supported"); },
  getMany: async () => { throw new Error("Not supported"); },
  create: async () => { throw new Error("Not supported"); },
  deleteOne: async () => { throw new Error("Not supported"); },
};

function ContactButton({ icon, label, value, href }: { icon: "phone" | "mail"; label: string; value: string; href: string | null }) {
  return (
    <a className="a-contact-btn" href={href ?? undefined} aria-disabled={href ? undefined : true} tabIndex={href ? undefined : -1}>
      <Icon name={icon} size={20} />
      <span>
        <span className="a-contact-label" style={{ display: "block" }}>{label}</span>
        <span className="a-contact-value" style={{ display: "block" }}>{hasValue(value) ? value : "Not provided"}</span>
      </span>
    </a>
  );
}

function QuotesList({ initialCounts }: { initialCounts: StatusCounts | null }) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<QuoteStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [counts, setCounts] = useState<StatusCounts | null>(initialCounts);
  const [selected, setSelected] = useState<Quote | null>(null);

  const filters = useMemo(
    () => status === "all" ? [] : [{ field: "quote_status", operator: "eq" as const, value: status }],
    [status],
  );
  const { result, query } = useList<Quote>({
    resource: "quotes",
    pagination: { currentPage: page, pageSize: 20 },
    filters,
    queryOptions: { retry: false, staleTime: 15000 },
  });
  const { mutate, mutation } = useUpdate<Quote>();
  const rows = useMemo(() => result?.data ?? [], [result?.data]);
  const total = result?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));

  const needle = search.trim().toLowerCase();
  const visible = useMemo(() => {
    if (!needle) return rows;
    return rows.filter((quote) =>
      ["name", "phone", "email", "moving_from", "moving_to"].some((key) => field(quote, key).toLowerCase().includes(needle)),
    );
  }, [rows, needle]);

  const updateStatus = useCallback((quote: Quote, next: QuoteStatus) => {
    if (next === quote.quote_status) return;
    setMessage(null);
    mutate(
      { resource: "quotes", id: quote.id, values: { quote_status: next }, mutationMode: "pessimistic" },
      {
        onSuccess: () => {
          setMessage({ tone: "success", text: `${field(quote, "name") === MISSING ? "Enquiry" : field(quote, "name")} moved to “${QUOTE_STATUS[next].label}”.` });
          setCounts((current) => current && ({ ...current, [quote.quote_status]: Math.max(0, current[quote.quote_status] - 1), [next]: current[next] + 1 }));
          setSelected((current) => (current && current.id === quote.id ? { ...current, quote_status: next } : current));
        },
        onError: (error) => setMessage({ tone: "error", text: error.message || "Update failed. Try again." }),
      },
    );
  }, [mutate]);

  const closeDrawer = useCallback(() => setSelected(null), []);
  const selectedIndex = selected ? visible.findIndex((quote) => quote.id === selected.id) : -1;
  const step = (direction: 1 | -1) => {
    const next = visible[selectedIndex + direction];
    if (next) setSelected(next);
  };

  const totalAll = counts ? QUOTE_STATUS_ORDER.reduce((sum, key) => sum + counts[key], 0) : null;

  return (
    <div>
      <AdminPageHeader
        eyebrow="Customer desk"
        title={<>Quote <em>enquiries</em></>}
        description="Every website quote request in one place. Open an enquiry to call, email and move it through your follow-up."
      />

      {counts && (
        <div className="a-crm-stats a-reveal" role="group" aria-label="Filter enquiries by status">
          {QUOTE_STATUS_ORDER.map((key) => (
            <button
              key={key}
              type="button"
              className="a-crm-stat"
              style={{ "--c": STATUS_COLOR[key] } as CSSProperties}
              aria-pressed={status === key}
              onClick={() => { setStatus(status === key ? "all" : key); setPage(1); }}
            >
              <span className="a-crm-stat-label">{QUOTE_STATUS[key].label}</span>
              <span className="a-crm-stat-value">{counts[key]}</span>
            </button>
          ))}
        </div>
      )}

      <AdminCard className="mt-6 a-reveal" flush>
        <div style={{ padding: "20px 26px 16px" }}>
          <div className="a-toolbar">
            <label className="a-search">
              <span className="sr-only">Search enquiries on this page</span>
              <Icon name="search" size={18} />
              <input
                type="search"
                className="admin-input"
                placeholder="Search this page by name, phone, email or suburb"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <div className="a-chips">
              <button type="button" className="a-chip" aria-pressed={status === "all"} onClick={() => { setStatus("all"); setPage(1); }}>
                All enquiries{totalAll !== null && <b>{totalAll}</b>}
              </button>
            </div>
            <span aria-live="polite" className="admin-help">
              {query.isLoading ? "Loading…" : needle ? `${visible.length} of ${rows.length} on this page` : `${total} ${total === 1 ? "enquiry" : "enquiries"}`}
            </span>
          </div>
          {message && (
            <div style={{ marginTop: 14 }}>
              <AdminAlert tone={message.tone === "success" ? "success" : "error"}>{message.text}</AdminAlert>
            </div>
          )}
        </div>

        {query.isError ? (
          <div style={{ padding: "0 26px 26px" }}>
            <AdminAlert tone="error">
              Unable to load quotes: {query.error instanceof Error ? query.error.message : "Unknown error"}. Check Supabase migration 0014 and the admin session.
              <button className="admin-btn admin-btn--secondary admin-btn--sm" style={{ marginLeft: 12 }} type="button" onClick={() => void query.refetch()}>Retry</button>
            </AdminAlert>
          </div>
        ) : query.isLoading ? (
          <SkeletonLoader rows={5} label="Loading enquiries" />
        ) : rows.length === 0 ? (
          <AdminEmptyState icon="inbox" title="No matching enquiries" description="New successful quote requests will appear when capture is enabled." />
        ) : visible.length === 0 ? (
          <AdminEmptyState icon="search" title="No matches on this page" description="Try a different search, or clear it to see every enquiry on this page." action={<button type="button" className="admin-btn admin-btn--secondary admin-btn--sm" onClick={() => setSearch("")}>Clear search</button>} />
        ) : (
          <ul className="a-lead-list">
            {visible.map((quote) => {
              const name = field(quote, "name");
              const phone = field(quote, "phone");
              const email = field(quote, "email");
              const preferred = field(quote, "preferred_moving_date");
              const preferredDate = hasValue(preferred) ? formatPreferredDate(preferred) : null;
              return (
                <li key={quote.id}>
                  <button type="button" className="a-lead" aria-haspopup="dialog" aria-current={selected?.id === quote.id ? "true" : undefined} onClick={() => setSelected(quote)}>
                    <span className="a-lead-avatar" aria-hidden="true">{initialsOf(name)}</span>
                    <span style={{ minWidth: 0 }}>
                      <span className="a-lead-name" style={{ display: "block" }}>{hasValue(name) ? name : "Unnamed enquiry"}</span>
                      <span className="a-lead-contact" style={{ display: "block" }}>{[hasValue(phone) ? phone : null, hasValue(email) ? email : null].filter(Boolean).join(" · ") || "No contact details"}</span>
                    </span>
                    <span className="a-route" aria-label={`From ${field(quote, "moving_from")} to ${field(quote, "moving_to")}`}>
                      <span className="a-route-stop">{field(quote, "moving_from")}</span>
                      <span className="a-route-stop">{field(quote, "moving_to")}</span>
                    </span>
                    <span className="a-lead-datecol">
                      <span className="a-lead-date-label" style={{ display: "block" }}>Preferred date</span>
                      <span className="a-lead-date" style={{ display: "block" }}>{preferredDate ? preferredDate.text : "Flexible / not given"}</span>
                      <span className="a-lead-ago" style={{ display: "block" }}>{preferredDate?.soon ? `${preferredDate.soon} · ` : ""}Received {ago(quote.created_at)}</span>
                    </span>
                    <span className="a-lead-statuscol"><AdminStatusBadge kind="quote" status={quote.quote_status} /></span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="a-pager">
          <span>Page {page} of {totalPages}</span>
          <span style={{ display: "inline-flex", gap: 8 }}>
            <button type="button" className="admin-btn admin-btn--secondary admin-btn--sm" disabled={page <= 1 || query.isFetching} onClick={() => setPage((current) => Math.max(1, current - 1))}>
              <Icon name="chevronLeft" size={15} />Previous
            </button>
            <button type="button" className="admin-btn admin-btn--secondary admin-btn--sm" disabled={page >= totalPages || query.isFetching} onClick={() => setPage((current) => current + 1)}>
              Next<Icon name="chevronRight" size={15} />
            </button>
          </span>
        </div>
      </AdminCard>

      <div className="mt-6">
        <AdminAlert tone="info">
          Website quotes are still emailed through Web3Forms. This list mirrors successful browser submissions where Supabase capture is configured; historic and non-JavaScript submissions are not imported.
          Delivery is unverified in the database, so use the actual email inbox to confirm receipt.
        </AdminAlert>
      </div>

      <DetailDrawer
        open={selected !== null}
        onClose={closeDrawer}
        eyebrow="Quote enquiry"
        title={selected ? (hasValue(field(selected, "name")) ? field(selected, "name") : "Unnamed enquiry") : ""}
        headerExtra={selected && (
          <span style={{ display: "inline-flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
            <AdminStatusBadge kind="quote" status={selected.quote_status} />
            <span className="admin-help">Received {formatAdelaide(selected.created_at)}</span>
          </span>
        )}
        footer={selected && (
          <>
            <button type="button" className="admin-btn admin-btn--secondary admin-btn--sm" onClick={() => step(-1)} disabled={selectedIndex <= 0}>
              <Icon name="chevronLeft" size={15} />Previous
            </button>
            <button type="button" className="admin-btn admin-btn--secondary admin-btn--sm" onClick={() => step(1)} disabled={selectedIndex < 0 || selectedIndex >= visible.length - 1}>
              Next<Icon name="chevronRight" size={15} />
            </button>
            <button type="button" className="admin-btn admin-btn--ghost admin-btn--sm" style={{ marginLeft: "auto" }} onClick={closeDrawer}>Close</button>
          </>
        )}
      >
        {selected && (
          <>
            <section className="a-drawer-section">
              <h3 className="a-drawer-section-title">Contact</h3>
              <div className="a-contact-row">
                <ContactButton icon="phone" label="Call" value={field(selected, "phone")} href={telHref(field(selected, "phone"))} />
                <ContactButton icon="mail" label="Email" value={field(selected, "email")} href={mailHref(field(selected, "email"))} />
              </div>
            </section>

            <section className="a-drawer-section">
              <h3 className="a-drawer-section-title">The move</h3>
              <div className="a-route" style={{ marginBottom: 14 }}>
                <span className="a-route-stop" style={{ whiteSpace: "normal" }}>{field(selected, "moving_from")}</span>
                <span className="a-route-stop" style={{ whiteSpace: "normal" }}>{field(selected, "moving_to")}</span>
              </div>
              <dl className="admin-dl">
                <div className="admin-dl-row"><dt>Preferred date</dt><dd>{(() => { const v = field(selected, "preferred_moving_date"); if (!hasValue(v)) return MISSING; const f = formatPreferredDate(v); return f.soon ? `${f.text} · ${f.soon}` : f.text; })()}</dd></div>
                {DETAIL_FIELDS.map(({ key, label }) => (
                  <div className="admin-dl-row" key={key}><dt>{label}</dt><dd>{field(selected, key)}</dd></div>
                ))}
              </dl>
            </section>

            {hasValue(field(selected, "details")) && (
              <section className="a-drawer-section">
                <h3 className="a-drawer-section-title">Job details from the customer</h3>
                <pre className="admin-note-box">{field(selected, "details")}</pre>
              </section>
            )}

            <section className="a-drawer-section">
              <h3 className="a-drawer-section-title">Follow-up</h3>
              <div className="a-next-steps" role="group" aria-label="Suggested next steps">
                {NEXT_STEPS[selected.quote_status].map((nextStep) => (
                  <button key={nextStep.to} type="button" className="a-step" data-primary={nextStep.primary || undefined} disabled={mutation.isPending} onClick={() => updateStatus(selected, nextStep.to)}>
                    <Icon name={QUOTE_STATUS[nextStep.to].icon} size={16} />
                    {nextStep.label}
                  </button>
                ))}
              </div>
              <label className="admin-field" style={{ marginTop: 16 }}>
                <span className="admin-label">Set status directly</span>
                <select
                  className="admin-input"
                  aria-label={`Follow-up status for ${field(selected, "name")}`}
                  value={selected.quote_status}
                  disabled={mutation.isPending}
                  onChange={(event) => updateStatus(selected, event.target.value as QuoteStatus)}
                >
                  {STATUSES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              {message && <div style={{ marginTop: 12 }}><AdminAlert tone={message.tone === "success" ? "success" : "error"}>{message.text}</AdminAlert></div>}
            </section>

            <section className="a-drawer-section">
              <h3 className="a-drawer-section-title">Original submission</h3>
              <dl className="admin-dl">
                <div className="admin-dl-row">
                  <dt>Form source</dt>
                  <dd>{(() => { const value = field(selected, "source_page"); const href = hasValue(value) ? safeSourceUrl(value) : null; return href ? <a className="admin-link" href={href} target="_blank" rel="noopener noreferrer">{value}</a> : value; })()}</dd>
                </div>
                <div className="admin-dl-row"><dt>Email delivery verification</dt><dd>{selected.delivery_status === "unknown" ? "Not verified" : selected.delivery_status}</dd></div>
                <div className="admin-dl-row"><dt>Reference</dt><dd className="is-mono">{selected.id}</dd></div>
              </dl>
            </section>
          </>
        )}
      </DetailDrawer>
    </div>
  );
}

export default function QuotesClient({ initialCounts = null }: { initialCounts?: StatusCounts | null }) {
  return (
    <Refine
      dataProvider={dataProvider}
      resources={[{ name: "quotes", list: "/admin/quotes" }]}
      options={{ disableTelemetry: true }}
    >
      <QuotesList initialCounts={initialCounts} />
    </Refine>
  );
}
