import Link from "next/link";
import type { ReactNode } from "react";
import { requireAdmin } from "../../../../lib/server/admin-dal.ts";
import { loadReports, type Section } from "../../../../lib/server/reports-repo.ts";
import { PRESET_LABELS, RANGE_PRESETS, formatDurationHours, resolveReportRange, type CountRow } from "../../../../lib/admin/reports.ts";
import { AdminAlert, AdminCard, AdminEmptyState, AdminPageHeader, DataTable, MetricCard, formatMoney } from "../../_components/ui";
import { BarChart, PipelineBars, type PipelineStage } from "../../_components/charts";
import "../../styles/reports.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reports", robots: { index: false, follow: false } };

const VIZ = ["var(--a-viz-1)", "var(--a-viz-2)", "var(--a-viz-3)", "var(--a-viz-4)", "var(--a-viz-5)", "var(--a-viz-6)"];

function stagesFrom(rows: CountRow[]): PipelineStage[] {
  return rows.map((row, index) => ({ label: row.label, count: row.count, color: VIZ[index % VIZ.length] }));
}

function Unavailable({ what }: { what: string }) {
  return <AdminAlert tone="error">{what} could not be loaded. Refresh to try again; other sections are unaffected.</AdminAlert>;
}

function NotAvailableYet({ what }: { what: string }) {
  return <p className="a-rep-note">{what}: not available yet. It appears once the quote CRM fields are applied to the database.</p>;
}

function CountTable({ title, rows, firstLabel }: { title: string; rows: CountRow[]; firstLabel: string }) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return (
    <details className="a-rep-table" open>
      <summary>{title} data table</summary>
      <DataTable columns={[{ label: firstLabel }, { label: "Count" }, { label: "Share" }]} minWidth={360}>
        {rows.map((row) => (
          <tr key={row.key}>
            <td data-label={firstLabel}>{row.label}</td>
            <td data-label="Count">{row.count}</td>
            <td data-label="Share">{total > 0 ? `${Math.round((row.count / total) * 100)}%` : "—"}</td>
          </tr>
        ))}
      </DataTable>
    </details>
  );
}

function Breakdown({ title, description, rows, empty, firstLabel }: { title: string; description: string; rows: CountRow[]; empty: string; firstLabel: string }) {
  return (
    <AdminCard title={title} description={description}>
      {rows.length === 0 ? (
        <p className="a-rep-note">{empty}</p>
      ) : (
        <>
          <PipelineBars stages={stagesFrom(rows)} />
          <CountTable title={title} rows={rows} firstLabel={firstLabel} />
        </>
      )}
    </AdminCard>
  );
}

function section<T>(value: Section<T>, what: string, render: (data: T) => ReactNode): ReactNode {
  return value.ok ? render(value.data) : <Unavailable what={what} />;
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ range?: string; from?: string; to?: string }> }) {
  await requireAdmin();
  const params = await searchParams;
  const range = resolveReportRange({ range: params.range, from: params.from, to: params.to });
  const report = await loadReports(range);

  return (
    <div className="a-rep">
      <AdminPageHeader
        eyebrow="Insights"
        title="Reports"
        description={`Real figures from the database for ${range.label.toLowerCase()} (${range.fromYmd} to ${range.toYmd}, Adelaide time). Bookings use move date; enquiries use received date; invoices use issue date.`}
      />

      <form method="get" action="/admin/reports" className="a-rep-range" aria-label="Report date range">
        <nav className="a-rep-presets" aria-label="Preset ranges">
          {RANGE_PRESETS.filter((preset) => preset !== "custom").map((preset) => (
            <Link key={preset} href={`/admin/reports?range=${preset}`} aria-current={range.preset === preset ? "page" : undefined} className="a-rep-tab">
              {PRESET_LABELS[preset]}
            </Link>
          ))}
        </nav>
        <div className="a-rep-custom">
          <input type="hidden" name="range" value="custom" />
          <label className="admin-field">
            <span className="admin-label">From</span>
            <input className="admin-input" type="date" name="from" defaultValue={range.fromYmd} required />
          </label>
          <label className="admin-field">
            <span className="admin-label">To</span>
            <input className="admin-input" type="date" name="to" defaultValue={range.toYmd} required />
          </label>
          <button type="submit" className="admin-btn admin-btn--secondary">Apply custom range</button>
        </div>
      </form>
      {range.notice && <AdminAlert tone="info">{range.notice}</AdminAlert>}

      {section(report.bookings, "Booking figures", (bookings) => (
        <>
          <div className="a-rep-metrics">
            <MetricCard icon="bookings" label="Bookings in range" value={bookings.total} hint="By move date" />
            <MetricCard icon="calendarCheck" label="Completed moves" value={bookings.completed} hint="Status completed" variant="feature" />
          </div>
          {bookings.total === 0 ? (
            <AdminEmptyState icon="bookings" title="No bookings in this range" description="Pick a wider range to see booking breakdowns." />
          ) : (
            <div className="a-rep-grid">
              <Breakdown title="Bookings by status" description="Current status of moves scheduled in this range." rows={bookings.byStatus} empty="No bookings." firstLabel="Status" />
              <Breakdown title="Bookings by package" description="Package chosen at booking." rows={bookings.byPackage} empty="No bookings." firstLabel="Package" />
              <Breakdown title="Bookings by truck class" description="Truck class chosen at booking." rows={bookings.byTruckClass} empty="No bookings." firstLabel="Truck class" />
            </div>
          )}
        </>
      ))}

      {section(report.billing, "Billing figures", (billing) => (
        <>
          <div className="a-rep-metrics">
            <MetricCard icon="dollar" label="Invoiced" value={formatMoney(billing.inRange.invoicedCents)} hint={`${billing.inRange.invoiceCount} issued in range`} />
            <MetricCard icon="check" label="Paid" value={formatMoney(billing.inRange.paidCents)} hint="Net of reversals" variant="feature" />
            <MetricCard icon="alert" label="Outstanding" value={formatMoney(billing.inRange.outstandingCents)} hint="From invoices issued in range" variant={billing.inRange.outstandingCents > 0 ? "gold" : "porcelain"} />
          </div>
          <AdminCard title="Outstanding invoice aging" description="All issued invoices with a balance, by days since the issue date (today, Adelaide time). Not limited to the selected range.">
            {billing.agingTotalCents === 0 ? (
              <p className="a-rep-note">No outstanding issued invoices.</p>
            ) : (
              <>
                <BarChart title="Outstanding dollars by age" unit=" AUD" data={billing.aging.map((bucket, index) => ({ label: bucket.label, value: Math.round(bucket.outstandingCents / 100), accent: index === 2 }))} />
                <details className="a-rep-table" open>
                  <summary>Aging data table</summary>
                  <DataTable columns={[{ label: "Age" }, { label: "Invoices" }, { label: "Outstanding" }]} minWidth={360}>
                    {billing.aging.map((bucket) => (
                      <tr key={bucket.label}>
                        <td data-label="Age">{bucket.label}</td>
                        <td data-label="Invoices">{bucket.count}</td>
                        <td data-label="Outstanding">{formatMoney(bucket.outstandingCents)}</td>
                      </tr>
                    ))}
                    <tr>
                      <th scope="row" data-label="Age">Total</th>
                      <td data-label="Invoices">{billing.aging.reduce((sum, bucket) => sum + bucket.count, 0)}</td>
                      <td data-label="Outstanding">{formatMoney(billing.agingTotalCents)}</td>
                    </tr>
                  </DataTable>
                </details>
              </>
            )}
          </AdminCard>
        </>
      ))}

      {section(report.quotes, "Quote enquiry figures", (quotes) => (
        <>
          <div className="a-rep-metrics">
            <MetricCard icon="inbox" label="Enquiries received" value={quotes.received} hint="By received date" />
            <MetricCard
              icon="clock"
              label="Median first response"
              value={quotes.phase2Available ? formatDurationHours(quotes.medianFirstResponseHours) : "Not available yet"}
              hint={quotes.phase2Available ? "Receipt to first status change" : "Needs the quote CRM fields"}
              variant="feature"
            />
          </div>
          {quotes.received === 0 ? (
            <AdminEmptyState icon="inbox" title="No enquiries in this range" description="Pick a wider range to see the quote funnel." />
          ) : (
            <div className="a-rep-grid">
              <AdminCard title="Quote funnel" description="Received, responded, quoted and booked; lost is shown as its own outcome.">
                {!quotes.phase2Available && <NotAvailableYet what="Exact response and quote tracking" />}
                <PipelineBars stages={quotes.funnel.map((stage, index) => ({ label: `${stage.label} (${stage.percent}%)`, count: stage.count, color: VIZ[index % VIZ.length] }))} />
                <details className="a-rep-table" open>
                  <summary>Quote funnel data table</summary>
                  <DataTable columns={[{ label: "Stage" }, { label: "Enquiries" }, { label: "Of received" }]} minWidth={360}>
                    {quotes.funnel.map((stage) => (
                      <tr key={stage.key}>
                        <td data-label="Stage">{stage.label}</td>
                        <td data-label="Enquiries">{stage.count}</td>
                        <td data-label="Of received">{stage.percent}%</td>
                      </tr>
                    ))}
                  </DataTable>
                </details>
              </AdminCard>
              <AdminCard title="Lost reasons" description="Why enquiries were marked lost.">
                {!quotes.phase2Available ? (
                  <NotAvailableYet what="Lost reasons" />
                ) : quotes.lostReasons.length === 0 ? (
                  <p className="a-rep-note">No lost enquiries in this range.</p>
                ) : (
                  <>
                    <PipelineBars stages={stagesFrom(quotes.lostReasons)} />
                    <CountTable title="Lost reasons" rows={quotes.lostReasons} firstLabel="Reason" />
                  </>
                )}
              </AdminCard>
              <AdminCard title="Enquiries by source page" description="The page each enquiry was submitted from.">
                <PipelineBars stages={stagesFrom(quotes.sources.rows)} />
                <CountTable title="Source page" rows={quotes.sources.rows} firstLabel="Page" />
                {quotes.sources.otherCount > 0 && <p className="a-rep-note">Plus {quotes.sources.otherCount} enquiries from less common pages.</p>}
              </AdminCard>
            </div>
          )}
        </>
      ))}
    </div>
  );
}
