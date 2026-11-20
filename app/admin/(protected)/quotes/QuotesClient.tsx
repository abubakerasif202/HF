"use client";

import { useCallback, useMemo, useState, type CSSProperties } from "react";
import { Refine, useList, useUpdate, type DataProvider } from "@refinedev/core";
import { AdminAlert, AdminCard, AdminEmptyState, AdminPageHeader, SkeletonLoader, formatAdelaide } from "../../_components/ui";
import { AdminStatusBadge, QUOTE_STATUS } from "../../_components/AdminStatusBadge";
import { ConfirmationDialog } from "../../_components/ConfirmationDialog";
import { DetailDrawer } from "../../_components/DetailDrawer";
import { Icon } from "../../_components/Icon";
<<<<<<< ours
import {
  BULK_MAX_IDS,
  DEFAULT_CLOSE_HM,
  DEFAULT_OPEN_HM,
  LOST_REASONS,
  followUpState,
  followUpYmd,
  responseBadge,
  type LostReason,
  type QuoteSummary,
} from "../../../../lib/admin/quote-crm";
import { QuoteDetailPanel } from "./QuoteDetailPanel";
import { QUOTE_STATUS_ORDER, type QuoteStatus } from "./quoteStatus";
import { formatPreferredDate, initialsOf, shortDate } from "./quoteFormat";
import { displayName, field, hasValue, type Quote, type QuotePatch } from "./quoteTypes";
import "../../styles/quotes.css";

type Tab = "all" | "needs_reply" | "due" | "overdue";
type Sort = "newest" | "oldest";
type BusinessHours = { open: string; close: string };

const TABS: { value: Tab; label: string }[] = [
  { value: "needs_reply", label: "Needs reply" },
  { value: "due", label: "Follow-ups due" },
  { value: "overdue", label: "Overdue" },
  { value: "all", label: "All" },
];
=======
import { ExportCsvLink } from "../../_components/ExportCsvLink";
>>>>>>> theirs

const STATUS_COLOR: Record<QuoteStatus, string> = {
  new: "var(--a-brand)",
  quote_sent: "var(--a-info)",
  follow_up: "var(--a-warning)",
  booked: "var(--a-success)",
  completed: "var(--a-viz-3)",
  lost: "var(--a-faint)",
};

const PAGE_SIZE = 20;

const dataProvider: DataProvider = {
  getApiUrl: () => "/api/admin/quotes",
  getList: async ({ resource, pagination, filters, meta }) => {
    if (resource !== "quotes") throw new Error("Unknown resource");
    const params = new URLSearchParams({
      page: String(pagination?.currentPage ?? 1),
      pageSize: String(pagination?.pageSize ?? PAGE_SIZE),
    });
    const filter = filters?.find((item) => "field" in item && item.field === "quote_status");
    if (filter && "value" in filter && typeof filter.value === "string") params.set("status", filter.value);
    if (meta?.tab) params.set("tab", String(meta.tab));
    if (meta?.sort) params.set("sort", String(meta.sort));
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
      body: JSON.stringify({ id, ...(variables as QuotePatch) }),
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

function QuotesList({ initialSummary, businessHours }: { initialSummary: QuoteSummary | null; businessHours: BusinessHours }) {
  const hasNew = (initialSummary?.counts.new ?? 0) > 0;
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<Tab>(hasNew ? "needs_reply" : "all");
  const [sort, setSort] = useState<Sort>(hasNew ? "oldest" : "newest");
  const [status, setStatus] = useState<QuoteStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [selected, setSelected] = useState<Quote | null>(null);
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const [bulkStatus, setBulkStatus] = useState<QuoteStatus>("lost");
  const [bulkReason, setBulkReason] = useState<LostReason>("no_response");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkPending, setBulkPending] = useState(false);

  const filters = useMemo(
    () => status === "all" ? [] : [{ field: "quote_status", operator: "eq" as const, value: status }],
    [status],
  );
  const { result, query } = useList<Quote>({
    resource: "quotes",
    pagination: { currentPage: page, pageSize: PAGE_SIZE },
    filters,
    meta: { tab, sort },
    queryOptions: { retry: false, staleTime: 15000 },
  });
  const { mutate, mutation } = useUpdate<Quote>();
  const rows = useMemo(() => result?.data ?? [], [result?.data]);
  const total = result?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const summary: QuoteSummary | null = (query.data as { summary?: QuoteSummary | null } | undefined)?.summary ?? initialSummary;

  const needle = search.trim().toLowerCase();
  const visible = useMemo(() => {
    if (!needle) return rows;
    return rows.filter((quote) =>
      ["name", "phone", "email", "moving_from", "moving_to"].some((key) => field(quote, key).toLowerCase().includes(needle)),
    );
  }, [rows, needle]);

  const chooseTab = (next: Tab) => { setTab(next); setStatus("all"); setPage(1); setChecked(new Set()); if (next !== "all") setSort("oldest"); };
  const chooseStatus = (next: QuoteStatus | "all") => { setStatus(next); setTab("all"); setPage(1); setChecked(new Set()); };

  const patchQuote = useCallback((quote: Quote, patch: QuotePatch) => {
    setMessage(null);
    mutate(
      { resource: "quotes", id: quote.id, values: patch, mutationMode: "pessimistic" },
      {
        onSuccess: (response) => {
          const updated = (response as unknown as { data: Quote }).data;
          const label = displayName(quote);
          setMessage({ tone: "success", text: patch.quote_status ? `${label} moved to “${QUOTE_STATUS[patch.quote_status].label}”.` : `Saved changes for ${label}.` });
          setSelected((current) => (current && current.id === quote.id ? { ...current, ...updated } : current));
        },
        onError: (error) => setMessage({ tone: "error", text: error.message || "Update failed. Try again." }),
      },
    );
  }, [mutate]);

  const onConverted = useCallback((quote: Quote, bookingNumber: string) => {
    setSelected((current) => (current && current.id === quote.id ? { ...current, ...quote } : current));
    setMessage({ tone: "success", text: `Booking draft ${bookingNumber} created and linked.` });
    void query.refetch();
  }, [query]);

  async function applyBulk() {
    setBulkPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/quotes/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...checked], quote_status: bulkStatus, ...(bulkStatus === "lost" ? { lost_reason: bulkReason } : {}) }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Bulk update failed");
      setMessage({ tone: "success", text: `${body.updated} of ${body.requested} enquiries moved to “${QUOTE_STATUS[bulkStatus].label}”.` });
      setChecked(new Set());
      setBulkOpen(false);
      await query.refetch();
    } catch (error) {
      setBulkOpen(false);
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Bulk update failed" });
    } finally {
      setBulkPending(false);
    }
  }

  const closeDrawer = useCallback(() => setSelected(null), []);
  const selectedIndex = selected ? visible.findIndex((quote) => quote.id === selected.id) : -1;
  const step = (direction: 1 | -1) => {
    const next = visible[selectedIndex + direction];
    if (next) setSelected(next);
  };

  const counts = summary?.counts ?? null;
  const totalAll = counts ? QUOTE_STATUS_ORDER.reduce((sum, key) => sum + counts[key], 0) : null;
  const tabCount: Record<Tab, number | null> = {
    needs_reply: counts?.new ?? null,
    due: summary?.due ?? null,
    overdue: summary?.overdue ?? null,
    all: totalAll,
  };
  const allVisibleChecked = visible.length > 0 && visible.every((quote) => checked.has(quote.id));
  const toggleChecked = (id: string) => setChecked((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else if (next.size < BULK_MAX_IDS) next.add(id);
    return next;
  });
  const toggleAllVisible = () => setChecked((current) => {
    if (allVisibleChecked) return new Set([...current].filter((id) => !visible.some((quote) => quote.id === id)));
    return new Set([...current, ...visible.map((quote) => quote.id)].slice(0, BULK_MAX_IDS));
  });
  const now = new Date();

  return (
    <div>
      <AdminPageHeader
        eyebrow="Customer desk"
        title={<>Quote <em>enquiries</em></>}
<<<<<<< ours
        description="Every website quote request in one place. Reply, set a follow-up, and turn a won enquiry into a booking."
=======
        description="Every website quote request in one place. Open an enquiry to call, email and move it through your follow-up."
        actions={<ExportCsvLink href={`/api/admin/export/quotes?${new URLSearchParams({ ...(status !== "all" ? { status } : {}), ...(search.trim() ? { q: search.trim() } : {}) }).toString()}`} />}
>>>>>>> theirs
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
              onClick={() => chooseStatus(status === key ? "all" : key)}
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
            <div className="a-q-tabs a-chips" role="group" aria-label="Enquiry view">
              {TABS.map((item) => (
                <button key={item.value} type="button" className="a-chip" aria-pressed={tab === item.value && status === "all"} onClick={() => chooseTab(item.value)}>
                  {item.label}{tabCount[item.value] !== null && <b>{tabCount[item.value]}</b>}
                </button>
              ))}
            </div>
            <label className="a-q-sort">
              <span className="admin-help">Sort</span>
              <select className="admin-input" value={sort} onChange={(event) => { setSort(event.target.value as Sort); setPage(1); }}>
                <option value="oldest">Oldest first</option>
                <option value="newest">Newest first</option>
              </select>
            </label>
          </div>
          <div style={{ marginTop: 10 }}>
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

        {checked.size > 0 && (
          <div className="a-q-bulk" role="region" aria-label="Bulk actions">
            <span><b>{checked.size}</b> selected</span>
            <label className="sr-only" htmlFor="quote-bulk-status">Set status for selected enquiries</label>
            <select id="quote-bulk-status" className="admin-input" value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value as QuoteStatus)}>
              {QUOTE_STATUS_ORDER.map((key) => <option key={key} value={key}>Set to {QUOTE_STATUS[key].label}</option>)}
            </select>
            <button type="button" className="admin-btn admin-btn--primary admin-btn--sm" onClick={() => setBulkOpen(true)}>Apply…</button>
            <button type="button" className="admin-btn admin-btn--ghost admin-btn--sm" onClick={() => setChecked(new Set())}>Clear selection</button>
          </div>
        )}

        {query.isError ? (
          <div style={{ padding: "0 26px 26px" }}>
            <AdminAlert tone="error">
              Unable to load quotes: {query.error instanceof Error ? query.error.message : "Unknown error"}. Check Supabase migrations 0014 and 0021 and the admin session.
              <button className="admin-btn admin-btn--secondary admin-btn--sm" style={{ marginLeft: 12 }} type="button" onClick={() => void query.refetch()}>Retry</button>
            </AdminAlert>
          </div>
        ) : query.isLoading ? (
          <SkeletonLoader rows={5} label="Loading enquiries" />
        ) : rows.length === 0 ? (
          <AdminEmptyState
            icon="inbox"
            title={tab === "needs_reply" ? "Nothing waiting for a reply" : tab === "due" || tab === "overdue" ? "No follow-ups here" : "No matching enquiries"}
            description={tab === "all" ? "New successful quote requests will appear when capture is enabled." : "Switch to All to see every enquiry."}
          />
        ) : visible.length === 0 ? (
          <AdminEmptyState icon="search" title="No matches on this page" description="Try a different search, or clear it to see every enquiry on this page." action={<button type="button" className="admin-btn admin-btn--secondary admin-btn--sm" onClick={() => setSearch("")}>Clear search</button>} />
        ) : (
          <>
            <div style={{ padding: "0 26px 8px" }}>
              <label className="a-q-selectall">
                <input type="checkbox" checked={allVisibleChecked} onChange={toggleAllVisible} />
                Select all on this page
              </label>
            </div>
            <ul className="a-lead-list">
              {visible.map((quote) => {
                const name = field(quote, "name");
                const phone = field(quote, "phone");
                const email = field(quote, "email");
                const preferred = field(quote, "preferred_moving_date");
                const preferredDate = hasValue(preferred) ? formatPreferredDate(preferred) : null;
                const badge = responseBadge({ createdAt: quote.created_at, firstResponseAt: quote.first_response_at, status: quote.quote_status, now, openHm: businessHours.open || DEFAULT_OPEN_HM, closeHm: businessHours.close || DEFAULT_CLOSE_HM });
                const followUp = followUpState(quote.follow_up_at, quote.quote_status, now);
                return (
                  <li key={quote.id} className="a-q-item">
                    <label className="a-q-check">
                      <span className="sr-only">Select {hasValue(name) ? name : "unnamed enquiry"}</span>
                      <input type="checkbox" checked={checked.has(quote.id)} onChange={() => toggleChecked(quote.id)} />
                    </label>
                    <button type="button" className="a-lead" aria-haspopup="dialog" aria-current={selected?.id === quote.id ? "true" : undefined} onClick={() => setSelected(quote)}>
                      <span className="a-lead-avatar" aria-hidden="true">{initialsOf(name)}</span>
                      <span style={{ minWidth: 0 }}>
                        <span className="a-lead-name" style={{ display: "block" }}>{hasValue(name) ? name : "Unnamed enquiry"}</span>
                        <span className="a-lead-contact" style={{ display: "block" }}>{[hasValue(phone) ? phone : null, hasValue(email) ? email : null].filter(Boolean).join(" · ") || "No contact details"}</span>
                        <span className="a-q-meta">
                          <span className="admin-badge" data-tone={badge.level === "red" ? "danger" : badge.level === "amber" ? "warning" : "neutral"}>
                            <Icon name="clock" size={13} />{badge.label}
                            {badge.level === "red" && <span className="sr-only"> (over 24 hours without a response)</span>}
                            {badge.level === "amber" && <span className="sr-only"> (over 4 business hours without a response)</span>}
                          </span>
                          {(followUp === "overdue" || followUp === "due") && (
                            <span className="admin-badge" data-tone={followUp === "overdue" ? "danger" : "warning"}>
                              <Icon name="bell" size={13} />{followUp === "overdue" ? "Follow-up overdue" : "Follow up today"}
                            </span>
                          )}
                          {followUp === "upcoming" && <span className="admin-help">Follow up {shortDate(followUpYmd(quote.follow_up_at))}</span>}
                          {quote.booking && (
                            <span className="admin-badge" data-tone="success"><Icon name="calendarCheck" size={13} />{quote.booking.booking_number}</span>
                          )}
                        </span>
                      </span>
                      <span className="a-route" aria-label={`From ${field(quote, "moving_from")} to ${field(quote, "moving_to")}`}>
                        <span className="a-route-stop">{field(quote, "moving_from")}</span>
                        <span className="a-route-stop">{field(quote, "moving_to")}</span>
                      </span>
                      <span className="a-lead-datecol">
                        <span className="a-lead-date-label" style={{ display: "block" }}>Preferred date</span>
                        <span className="a-lead-date" style={{ display: "block" }}>{preferredDate ? preferredDate.text : "Flexible / not given"}</span>
                        <span className="a-lead-ago" style={{ display: "block" }}>{preferredDate?.soon ? `${preferredDate.soon} · ` : ""}Received {formatAdelaide(quote.created_at)}</span>
                      </span>
                      <span className="a-lead-statuscol"><AdminStatusBadge kind="quote" status={quote.quote_status} /></span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
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

      <ConfirmationDialog
        open={bulkOpen}
        title={`Move ${checked.size} ${checked.size === 1 ? "enquiry" : "enquiries"} to “${QUOTE_STATUS[bulkStatus].label}”?`}
        confirmLabel="Move enquiries"
        pending={bulkPending}
        destructive={bulkStatus === "lost"}
        onConfirm={() => void applyBulk()}
        onCancel={() => setBulkOpen(false)}
      >
        This changes the status of every selected enquiry. No emails or messages are sent to customers.
        {bulkStatus === "lost" && (
          <label className="a-q-dialog-field">
            <span className="admin-label">Lost reason</span>
            <select className="admin-input" value={bulkReason} onChange={(event) => setBulkReason(event.target.value as LostReason)}>
              {LOST_REASONS.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}
            </select>
          </label>
        )}
      </ConfirmationDialog>

      <DetailDrawer
        open={selected !== null}
        onClose={closeDrawer}
        eyebrow="Quote enquiry"
        title={selected ? displayName(selected) : ""}
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
          <QuoteDetailPanel
            quote={selected}
            pending={mutation.isPending}
            notice={message}
            onPatch={(patch) => patchQuote(selected, patch)}
            onConverted={onConverted}
          />
        )}
      </DetailDrawer>
    </div>
  );
}

export default function QuotesClient({ initialSummary = null, businessHours }: { initialSummary?: QuoteSummary | null; businessHours: BusinessHours }) {
  return (
    <Refine
      dataProvider={dataProvider}
      resources={[{ name: "quotes", list: "/admin/quotes" }]}
      options={{ disableTelemetry: true }}
    >
      <QuotesList initialSummary={initialSummary} businessHours={businessHours} />
    </Refine>
  );
}
