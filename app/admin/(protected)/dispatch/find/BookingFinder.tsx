"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { FINDER_STATUSES, type FinderResult } from "../../../../../lib/booking-finder.ts";
import { AdminAlert, AdminCard, AdminEmptyState, SkeletonLoader } from "../../../_components/ui";
import { AdminStatusBadge } from "../../../_components/AdminStatusBadge";
import { Icon } from "../../../_components/Icon";

interface Resource { id: string; name: string }
interface SearchResponse { results: FinderResult[]; total: number; page: number; pageSize: number; hasMore: boolean }

const TZ = "Australia/Adelaide";
const dateTime = new Intl.DateTimeFormat("en-AU", { timeZone: TZ, weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
const FIELDS = ["q", "from", "to", "status", "crewId", "vehicleId"] as const;

const RANK_LABEL: Record<number, string> = { 0: "Exact reference", 1: "Phone match", 2: "Reference match" };

export function BookingFinder({ crews, vehicles }: { crews: Resource[]; vehicles: Resource[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const id = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  const queryString = params.toString();
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);

  useEffect(() => { searchRef.current?.focus(); }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/admin/bookings/search?${queryString}`, { cache: "no-store", signal: controller.signal });
        const body = await response.json() as SearchResponse | { error?: string };
        if (!response.ok) throw new Error("error" in body && body.error ? body.error : "Booking search is unavailable.");
        setData(body as SearchResponse);
      } catch (failure) {
        if (failure instanceof DOMException && failure.name === "AbortError") return;
        setData(null);
        setError(failure instanceof Error ? failure.message : "Booking search is unavailable.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [queryString, retry]);

  function go(next: URLSearchParams) {
    const text = next.toString();
    router.push(text ? `${pathname}?${text}` : pathname);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = new URLSearchParams();
    for (const field of FIELDS) {
      const value = String(form.get(field) ?? "").trim();
      if (value) next.set(field, value);
    }
    go(next); // a new search always starts on page 1
  }

  function goToPage(target: number) {
    const next = new URLSearchParams(params.toString());
    if (target <= 1) next.delete("page"); else next.set("page", String(target));
    go(next);
  }

  const hasFilters = FIELDS.some((field) => params.get(field));
  const first = data && data.total ? (data.page - 1) * data.pageSize + 1 : 0;
  const last = data ? Math.min(data.total, (data.page - 1) * data.pageSize + data.results.length) : 0;

  return (
    <div className="a-find-layout">
      <AdminCard title="Search" icon="search">
        <form onSubmit={onSubmit} className="a-find-form" role="search" aria-label="Find booking" key={queryString}>
          <label className="admin-field a-find-q" htmlFor={`${id}-q`}>
            <span className="admin-label">Booking, customer or place</span>
            <input
              id={`${id}-q`} ref={searchRef} className="admin-input" type="search" name="q" defaultValue={params.get("q") ?? ""}
              placeholder="HF-2026-00042, Sample Customer, 0491 704 136, Salisbury…" autoComplete="off" maxLength={100} enterKeyHint="search"
            />
            <span className="admin-help">Partial matches work. Phones can be 04…, +61 4… or with spaces.</span>
          </label>
          <label className="admin-field" htmlFor={`${id}-from`}>
            <span className="admin-label">Moves from</span>
            <input id={`${id}-from`} className="admin-input" type="date" name="from" defaultValue={params.get("from") ?? ""} />
          </label>
          <label className="admin-field" htmlFor={`${id}-to`}>
            <span className="admin-label">Moves to</span>
            <input id={`${id}-to`} className="admin-input" type="date" name="to" defaultValue={params.get("to") ?? ""} />
          </label>
          <label className="admin-field" htmlFor={`${id}-status`}>
            <span className="admin-label">Status</span>
            <select id={`${id}-status`} className="admin-input" name="status" defaultValue={params.get("status") ?? ""}>
              <option value="">Any status</option>
              {FINDER_STATUSES.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
            </select>
          </label>
          <label className="admin-field" htmlFor={`${id}-crew`}>
            <span className="admin-label">Crew / subcontractor</span>
            <select id={`${id}-crew`} className="admin-input" name="crewId" defaultValue={params.get("crewId") ?? ""}>
              <option value="">Any crew</option>
              {crews.map((crew) => <option key={crew.id} value={crew.id}>{crew.name}</option>)}
            </select>
          </label>
          <label className="admin-field" htmlFor={`${id}-truck`}>
            <span className="admin-label">Truck</span>
            <select id={`${id}-truck`} className="admin-input" name="vehicleId" defaultValue={params.get("vehicleId") ?? ""}>
              <option value="">Any truck</option>
              {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.name}</option>)}
            </select>
          </label>
          <div className="a-find-actions">
            <button type="submit" className="admin-btn admin-btn--primary"><Icon name="search" size={16} />Search</button>
            {hasFilters && <button type="button" className="admin-btn admin-btn--secondary" onClick={() => { go(new URLSearchParams()); searchRef.current?.focus(); }}>Clear</button>}
          </div>
        </form>
      </AdminCard>

      <section aria-labelledby={`${id}-results`} aria-busy={loading} className="a-find-results">
        <h2 id={`${id}-results`} className="sr-only">Results</h2>
        <p className="admin-help a-find-count" role="status" aria-live="polite">
          {loading ? "Searching…" : error ? "" : data ? (data.total ? `Showing ${first}–${last} of ${data.total} bookings` : "No bookings found") : ""}
        </p>

        {error ? (
          <AdminAlert tone="error">
            {error}{" "}
            <button type="button" className="admin-link a-find-retry" onClick={() => setRetry((value) => value + 1)}>Try again</button>
          </AdminAlert>
        ) : loading && !data ? <SkeletonLoader rows={4} label="Searching bookings" />
        : data && data.results.length === 0 ? (
          <AdminEmptyState icon="search" title="No bookings match" description={hasFilters ? "Check the spelling, widen the dates or clear a filter." : "There are no bookings yet."} />
        ) : data ? (
          <ul className="a-find-list">
            {data.results.map((result) => (
              <li key={result.id}>
                <Link href={`/admin/bookings/${result.id}`} className="a-find-result">
                  <span className="a-find-result-head">
                    <strong>{result.bookingNumber}</strong>
                    <AdminStatusBadge status={result.status} />
                    {RANK_LABEL[result.matchRank] && <span className="a-find-match">{RANK_LABEL[result.matchRank]}</span>}
                  </span>
                  <span className="a-find-result-when">{dateTime.format(new Date(result.startsAt))}</span>
                  <span className="a-find-result-customer">
                    {result.customerName ?? "Customer not recorded"}
                    {result.customerPhone && <small>{result.customerPhone}</small>}
                  </span>
                  <span className="a-find-result-route"><Icon name="mapPin" size={14} />{result.pickup || "Pickup not recorded"}<Icon name="arrowRight" size={13} />{result.destination || "Drop-off not recorded"}</span>
                  <span className="a-find-result-assign">
                    <span data-missing={!result.crewName || undefined}><Icon name="crew" size={13} />{result.crewName ?? "No crew"}</span>
                    <span data-missing={result.truckNames.length === 0 || undefined}><Icon name="truck" size={13} />{result.truckNames.length ? result.truckNames.join(", ") : "No truck"}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}

        {data && data.total > data.pageSize && (
          <nav className="a-find-pager" aria-label="Search result pages">
            <button type="button" className="admin-btn admin-btn--secondary" disabled={page <= 1 || loading} onClick={() => goToPage(page - 1)}>Previous</button>
            <span>Page {data.page} of {Math.max(1, Math.ceil(data.total / data.pageSize))}</span>
            <button type="button" className="admin-btn admin-btn--secondary" disabled={!data.hasMore || loading} onClick={() => goToPage(page + 1)}>Next</button>
          </nav>
        )}
      </section>
    </div>
  );
}
