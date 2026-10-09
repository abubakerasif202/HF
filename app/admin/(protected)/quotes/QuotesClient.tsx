"use client";

import { useMemo, useState } from "react";
import { Refine, useList, useUpdate, type DataProvider } from "@refinedev/core";
import { AdminCard, AdminEmptyState, AdminPageHeader, formatAdelaide } from "../../_components/ui";

type QuoteStatus = "new" | "quote_sent" | "follow_up" | "booked" | "completed" | "lost";
type DeliveryStatus = "pending" | "sent" | "failed" | "unknown";
type Quote = {
  id: string;
  payload: Record<string, string | string[]>;
  quote_status: QuoteStatus;
  delivery_status: DeliveryStatus;
  created_at: string;
};

const STATUSES: { value: QuoteStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "quote_sent", label: "Quote sent" },
  { value: "follow_up", label: "Follow up" },
  { value: "booked", label: "Booked" },
  { value: "completed", label: "Completed" },
  { value: "lost", label: "Lost" },
];

const DETAIL_FIELDS: { key: string; label: string }[] = [
  { key: "name", label: "Customer" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "moving_from", label: "Pickup" },
  { key: "moving_to", label: "Destination" },
  { key: "preferred_moving_date", label: "Preferred date" },
  { key: "move_category", label: "Move category" },
  { key: "move_type", label: "Move type" },
  { key: "truck_package_id", label: "Truck selection" },
  { key: "property_size", label: "Property size" },
  { key: "floor_access", label: "Floor access" },
  { key: "parking_access", label: "Parking" },
  { key: "boxes_needed", label: "Boxes" },
  { key: "services[]", label: "Extra services" },
  { key: "details", label: "Job details" },
  { key: "source_page", label: "Form source" },
];

function field(quote: Quote, name: string): string {
  const value = quote.payload?.[name];
  if (typeof value === "string") return value || "—";
  return Array.isArray(value) ? value.join(", ") || "—" : "—";
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

function QuotesList() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<QuoteStatus | "all">("all");
  const [message, setMessage] = useState("");
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
  const rows = result?.data ?? [];
  const total = result?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));

  const updateStatus = (quote: Quote, next: QuoteStatus) => {
    setMessage("");
    mutate(
      { resource: "quotes", id: quote.id, values: { quote_status: next }, mutationMode: "pessimistic" },
      {
        onSuccess: () => setMessage("Quote status updated."),
        onError: (error) => setMessage(error.message || "Update failed. Try again."),
      },
    );
  };

  return (
    <div className="mx-auto max-w-7xl">
      <AdminPageHeader
        eyebrow="Refine CRM"
        title="Quote enquiries"
        description="Review incoming website quotes, manage follow-ups and track which customers booked."
      />
      <AdminCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-3" htmlFor="quote-status-filter">
            <span className="font-semibold">Status</span>
            <select
              id="quote-status-filter"
              className="admin-input"
              value={status}
              onChange={(event) => { setStatus(event.target.value as QuoteStatus | "all"); setPage(1); }}
            >
              <option value="all">All enquiries</option>
              {STATUSES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <span aria-live="polite">{query.isLoading ? "Loading…" : `${total} enquiries`}</span>
        </div>
        <p className="mt-3 text-sm">
          Website quotes are still emailed through Web3Forms. This list mirrors successful browser submissions
          where Supabase capture is configured; historic and non-JavaScript submissions are not imported.
          Delivery is unverified in the database, so use the actual email inbox to confirm receipt.
        </p>
        {message && <p className="mt-3" role="status">{message}</p>}
      </AdminCard>

      <AdminCard className="mt-6" flush>
        {query.isError ? (
          <div className="p-5" role="alert">
            Unable to load quotes: {query.error instanceof Error ? query.error.message : "Unknown error"}.
            Check Supabase migration 0014 and the admin session.
            <button className="admin-btn admin-btn--secondary ml-3" type="button" onClick={() => void query.refetch()}>Retry</button>
          </div>
        ) : query.isLoading ? (
          <div className="p-6" role="status">Loading enquiries…</div>
        ) : rows.length === 0 ? (
          <AdminEmptyState icon="inbox" title="No matching enquiries" description="New successful quote requests will appear when capture is enabled." />
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table admin-table--stack min-[900px]:min-w-[940px]">
              <thead><tr><th scope="col">Customer</th><th scope="col">Move</th><th scope="col">Preferred date</th><th scope="col">Received</th><th scope="col">Follow-up status</th><th scope="col">Details</th></tr></thead>
              <tbody>
                {rows.map((quote) => {
                  const phone = field(quote, "phone");
                  const phoneNumber = phone.replace(/[^\d+]/g, "");
                  return (
                    <tr key={quote.id}>
                      <td data-label="Customer">
                        <strong>{field(quote, "name")}</strong>
                        <div>{phoneNumber ? <a className="admin-link" href={`tel:${phoneNumber}`}>{phone}</a> : phone}</div>
                        <div>{field(quote, "email")}</div>
                      </td>
                      <td data-label="Move"><strong>{field(quote, "moving_from")}</strong><div>→ {field(quote, "moving_to")}</div></td>
                      <td data-label="Preferred date">{field(quote, "preferred_moving_date")}</td>
                      <td data-label="Received">{formatAdelaide(quote.created_at)}</td>
                      <td data-label="Status">
                        <select
                          aria-label={`Follow-up status for ${field(quote, "name")}`}
                          className="admin-input"
                          value={quote.quote_status}
                          disabled={mutation.isPending}
                          onChange={(event) => updateStatus(quote, event.target.value as QuoteStatus)}
                        >
                          {STATUSES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                      </td>
                      <td data-label="Details">
                        <details>
                          <summary className="admin-link cursor-pointer">View details</summary>
                          <dl className="mt-2 space-y-2">
                            {DETAIL_FIELDS.map(({ key, label }) => (
                              <div key={key}><dt className="font-semibold">{label}</dt><dd className="whitespace-pre-wrap break-words">{field(quote, key)}</dd></div>
                            ))}
                            <div><dt className="font-semibold">Email delivery verification</dt><dd>{quote.delivery_status === "unknown" ? "Not verified" : quote.delivery_status}</dd></div>
                          </dl>
                        </details>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>

      <div className="mt-5 flex items-center justify-end gap-3">
        <button type="button" className="admin-btn admin-btn--secondary" disabled={page <= 1 || query.isFetching} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button>
        <span>Page {page} of {totalPages}</span>
        <button type="button" className="admin-btn admin-btn--secondary" disabled={page >= totalPages || query.isFetching} onClick={() => setPage((current) => current + 1)}>Next</button>
      </div>
    </div>
  );
}

export default function QuotesClient() {
  return (
    <Refine
      dataProvider={dataProvider}
      resources={[{ name: "quotes", list: "/admin/quotes" }]}
      options={{ disableTelemetry: true }}
    >
      <QuotesList />
    </Refine>
  );
}
