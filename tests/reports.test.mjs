import assert from "node:assert/strict";
import test from "node:test";
import {
  addDaysYmd,
  agingBuckets,
  countBy,
  enquiriesBySourcePage,
  formatDurationHours,
  isMissingColumnError,
  lostReasons,
  median,
  medianFirstResponseHours,
  normaliseSourcePage,
  parseYmd,
  quoteFunnel,
  resolveReportRange,
  summariseBookings,
  summariseInvoices,
} from "../lib/admin/reports.ts";

// 2026-11-18 is a Wednesday; 02:00 UTC is 12:30 the same day in Adelaide (ACDT).
const NOW = new Date("2026-11-18T02:00:00Z");

test("preset ranges resolve to Adelaide calendar boundaries", () => {
  const week = resolveReportRange({ range: "this_week" }, NOW);
  assert.deepEqual([week.fromYmd, week.toYmd], ["2026-11-16", "2026-11-22"]);
  const month = resolveReportRange({ range: "this_month" }, NOW);
  assert.deepEqual([month.fromYmd, month.toYmd], ["2026-11-01", "2026-11-30"]);
  const last = resolveReportRange({ range: "last_month" }, NOW);
  assert.deepEqual([last.fromYmd, last.toYmd], ["2026-10-01", "2026-10-31"]);
  // Adelaide midnight (UTC+10:30 in DST) is 13:30 UTC the previous day; the end is exclusive.
  assert.equal(month.start, "2026-10-31T13:30:00.000Z");
  assert.equal(month.end, "2026-11-30T13:30:00.000Z");
  assert.equal(resolveReportRange({}, NOW).preset, "this_month");
  assert.equal(resolveReportRange({ range: "bogus" }, NOW).preset, "this_month");
});

test("year boundary and Sunday week handling", () => {
  const jan = resolveReportRange({ range: "last_month" }, new Date("2027-01-10T00:00:00Z"));
  assert.deepEqual([jan.fromYmd, jan.toYmd], ["2026-12-01", "2026-12-31"]);
  const sunday = resolveReportRange({ range: "this_week" }, new Date("2026-11-22T02:00:00Z"));
  assert.deepEqual([sunday.fromYmd, sunday.toYmd], ["2026-11-16", "2026-11-22"]);
});

test("custom ranges validate dates and fall back with a notice", () => {
  const ok = resolveReportRange({ range: "custom", from: "2026-09-01", to: "2026-09-15" }, NOW);
  assert.equal(ok.preset, "custom");
  assert.equal(ok.notice, undefined);
  assert.deepEqual([ok.fromYmd, ok.toYmd], ["2026-09-01", "2026-09-15"]);
  for (const input of [
    { range: "custom", from: "2026-02-30", to: "2026-03-01" },
    { range: "custom", from: "nope", to: "2026-03-01" },
    { range: "custom", from: "2026-03-05", to: "2026-03-01" },
    { range: "custom", from: "2020-01-01", to: "2026-03-01" },
    { range: "custom" },
  ]) {
    const range = resolveReportRange(input, NOW);
    assert.equal(range.preset, "this_month", JSON.stringify(input));
    assert.ok(range.notice, JSON.stringify(input));
  }
  assert.equal(parseYmd("2026-13-01"), null);
  assert.equal(addDaysYmd("2026-12-31", 1), "2027-01-01");
});

test("bookings are counted by status, package and truck class", () => {
  const summary = summariseBookings([
    { booking_status: "completed", package_id: "two-movers", truck_class: "small" },
    { booking_status: "completed", package_id: "two-movers", truck_class: null },
    { booking_status: "confirmed", package_id: null, truck_class: "small" },
    { booking_status: "cancelled", package_id: "three-movers", truck_class: "large" },
  ]);
  assert.equal(summary.total, 4);
  assert.equal(summary.completed, 2);
  assert.deepEqual(summary.byStatus.map((r) => [r.key, r.count]), [["confirmed", 1], ["completed", 2], ["cancelled", 1]]);
  assert.deepEqual(summary.byPackage.map((r) => [r.key, r.count]), [["two-movers", 2], ["three-movers", 1], ["unspecified", 1]]);
  assert.equal(summary.byTruckClass.find((r) => r.key === "unspecified")?.label, "Not recorded");
  assert.deepEqual(countBy([], () => "x"), []);
});

const invoices = [
  { id: "a", status: "issued", total_cents: 10000, issue_date: "2026-11-01", due_date: "2026-11-15" },
  { id: "b", status: "issued", total_cents: 20000, issue_date: "2026-09-01", due_date: "2026-09-15" },
  { id: "c", status: "issued", total_cents: 5000, issue_date: "2026-08-01", due_date: null },
  { id: "d", status: "draft", total_cents: 99900, issue_date: null, due_date: null },
  { id: "e", status: "void", total_cents: 99900, issue_date: "2026-11-02", due_date: null },
];
const payments = [
  { invoice_id: "a", kind: "deposit", amount_cents: 3000 },
  { invoice_id: "a", kind: "payment", amount_cents: 2000 },
  { invoice_id: "a", kind: "reversal", amount_cents: 1000 },
  { invoice_id: "b", kind: "payment", amount_cents: 20000 },
  { invoice_id: "c", kind: "payment", amount_cents: 8000 },
];

test("invoice totals count only issued invoices and net out reversals in cents", () => {
  const summary = summariseInvoices(invoices, payments);
  assert.equal(summary.invoiceCount, 3);
  assert.equal(summary.invoicedCents, 35000);
  // a: 4000 net, b: 20000, c: capped at its 5000 total (overpayment is not counted as paid)
  assert.equal(summary.paidCents, 4000 + 20000 + 5000);
  assert.equal(summary.outstandingCents, 6000);
  assert.deepEqual(summariseInvoices([], []), { invoiceCount: 0, invoicedCents: 0, paidCents: 0, outstandingCents: 0 });
});

test("aging buckets split outstanding balances by days since issue", () => {
  const buckets = agingBuckets(invoices, payments, "2026-11-18");
  assert.deepEqual(buckets.map((b) => [b.label, b.count, b.outstandingCents]), [
    ["0–30 days", 1, 6000],
    ["31–60 days", 0, 0],
    ["Over 60 days", 0, 0],
  ]);
  const old = agingBuckets([{ id: "z", status: "issued", total_cents: 1000, issue_date: "2026-08-01", due_date: null }], [], "2026-11-18");
  assert.equal(old[2].outstandingCents, 1000);
  const mid = agingBuckets([{ id: "z", status: "issued", total_cents: 1000, issue_date: "2026-10-01", due_date: null }], [], "2026-11-18");
  assert.equal(mid[1].count, 1);
});

const created = "2026-11-10T00:00:00Z";
const quotes = [
  { created_at: created, quote_status: "new", payload: { source_page: "https://www.hfremovalsadelaide.com.au/services/house-removals?x=1" } },
  { created_at: created, quote_status: "quote_sent", payload: { source_page: "/services/house-removals/" }, first_response_at: "2026-11-10T02:00:00Z", quoted_amount_cents: 45000 },
  { created_at: created, quote_status: "booked", payload: { source_page: "/pricing" }, first_response_at: "2026-11-10T06:00:00Z", booking_id: "b1" },
  { created_at: created, quote_status: "lost", payload: {}, first_response_at: "2026-11-11T00:00:00Z", lost_reason: "price" },
  { created_at: created, quote_status: "lost", payload: null, lost_reason: null },
  { created_at: created, quote_status: "follow_up", payload: { source_page: 42 } },
];

test("quote funnel counts stages from columns or status", () => {
  const funnel = quoteFunnel(quotes);
  assert.deepEqual(Object.fromEntries(funnel.map((s) => [s.key, s.count])), { received: 6, responded: 5, quoted: 2, booked: 1, lost: 2 });
  assert.equal(funnel[1].percent, 83);
  assert.deepEqual(quoteFunnel([]).map((s) => s.count), [0, 0, 0, 0, 0]);
  assert.equal(quoteFunnel([]).every((s) => s.percent === 0), true);
});

test("lost reasons, response time and sources aggregate real rows only", () => {
  assert.deepEqual(lostReasons(quotes).map((r) => [r.label, r.count]), [["Price", 1], ["Not recorded", 1]]);
  // responses after 2 h, 6 h and 24 h -> median 6 h
  assert.equal(medianFirstResponseHours(quotes), 6);
  assert.equal(medianFirstResponseHours([{ created_at: created, quote_status: "new", payload: {} }]), null);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(median([]), null);
  assert.equal(formatDurationHours(null), "No responses recorded");
  assert.equal(formatDurationHours(0.5), "30 min");
  assert.equal(formatDurationHours(6), "6 h");
  assert.equal(formatDurationHours(72), "3 days");

  const sources = enquiriesBySourcePage(quotes, 2);
  assert.deepEqual(sources.rows.map((r) => [r.key, r.count]), [["/services/house-removals", 2], ["/pricing", 1]]);
  assert.equal(sources.otherCount, 3);
  assert.equal(normaliseSourcePage("https://x.test/a/b/?q=1#h"), "/a/b");
  assert.equal(normaliseSourcePage("pricing"), "/pricing");
  assert.equal(normaliseSourcePage("https://x.test"), "/");
  assert.equal(normaliseSourcePage(null), "unspecified");
});

test("missing Phase 2 columns are recognised so the funnel degrades instead of failing", () => {
  assert.equal(isMissingColumnError({ code: "42703", message: "x" }), true);
  assert.equal(isMissingColumnError({ code: "PGRST204", message: "Could not find the 'lost_reason' column" }), true);
  assert.equal(isMissingColumnError({ message: "column quote_requests.first_response_at does not exist" }), true);
  assert.equal(isMissingColumnError({ code: "42501", message: "permission denied" }), false);
  assert.equal(isMissingColumnError(null), false);
});
