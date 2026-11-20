import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import * as csv from "../lib/admin-csv.ts";
import * as datesLib from "../lib/admin/dates.ts";
import * as finderLib from "../lib/booking-finder.ts";

const require = createRequire(import.meta.url);

/** Loads a TS module into a VM with collaborators replaced by stubs (same approach as the other API tests). */
function load(path, stubs) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(output, {
    exports, console: { error() {} }, URL, Date, Set, Map, Object, JSON, Promise, Array, Number, String, Intl, Uint8Array, Error, RegExp, Math, Buffer,
    require: (id) => {
      for (const [needle, value] of Object.entries(stubs)) if (id.includes(needle)) return value;
      if (id === "server-only") return {};
      return require(id);
    },
  });
  return exports;
}

class NextResponse {
  constructor(body, init = {}) { this.body = body; this.status = init.status ?? 200; this.headers = init.headers ?? {}; }
  static json(body, init = {}) { return new NextResponse(body, init); }
}

const unauth = { status: "unauthenticated" };
const forbidden = { status: "forbidden" };
const owner = { status: "authorized", session: { userId: "owner-1", email: "admin@hfremovalsadelaide.com.au" } };
const req = (path, query = "") => ({ url: `https://hf.test${path}?${query}`, headers: new Headers() });

/** Records every query-builder call; awaiting a builder resolves to the rows registered for its table. */
function recorder(tables = {}) {
  const calls = [];
  const from = (table) => {
    const proxy = new Proxy(function () {}, {
      get: (_t, prop) => (prop === "then"
        ? (resolve) => resolve({ data: tables[table] ?? [], error: tables.__error ?? null })
        : (...args) => { calls.push([table, String(prop), args]); return proxy; }),
    });
    return proxy;
  };
  const supabase = { from, rpc: async (name, args) => { calls.push(["rpc", name, args]); return { data: tables.rpc ?? [], error: null }; } };
  return { calls, supabase };
}

function harness(auth = owner, tables = {}) {
  const rec = recorder(tables);
  const data = load("../lib/server/export-data.ts", {
    "next/server": { NextResponse },
    "supabase-ssr": { getAdminAuthState: async () => auth },
    "supabase.ts": { getSupabaseAdmin: () => rec.supabase },
    "admin/dates": datesLib,
    "booking-finder": finderLib,
    "admin-csv": csv,
  });
  const route = (name) => load(`../app/api/admin/export/${name}/route.ts`, { "export-data": data });
  const search = load("../lib/server/admin-search.ts", {
    "supabase.ts": { getSupabaseAdmin: () => rec.supabase },
    "admin/dates": datesLib,
    "booking-finder": finderLib,
    "admin-csv": csv,
  });
  const searchRoute = load("../app/api/admin/search/route.ts", { "next/server": { NextResponse }, "export-data": data, "admin-search": search });
  return { ...rec, route, searchRoute };
}

// ---- CSV escaping and formula neutralisation ----------------------------------------------------

test("csvCell quotes commas, quotes and newlines and doubles embedded quotes", () => {
  assert.equal(csv.csvCell("plain"), "plain");
  assert.equal(csv.csvCell("a,b"), '"a,b"');
  assert.equal(csv.csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csv.csvCell("line1\nline2"), '"line1\nline2"');
  assert.equal(csv.csvCell("line1\r\nline2"), '"line1\r\nline2"');
  assert.equal(csv.csvCell(null), "");
  assert.equal(csv.csvCell(undefined), "");
  assert.equal(csv.csvCell(42), "42");
  assert.equal(csv.csvCell(true), "true");
});

test("text cells starting with = + - @ (or tab/CR) are prefixed with a single quote", () => {
  for (const lead of ["=", "+", "-", "@"]) {
    assert.equal(csv.csvCell(`${lead}SUM(A1)`), `'${lead}SUM(A1)`);
  }
  assert.equal(csv.csvCell("\t=1+1"), '\'\t=1+1');
  assert.equal(csv.csvCell("  =cmd|' /C calc'!A0"), "'  =cmd|' /C calc'!A0");
  assert.equal(csv.csvCell('=HYPERLINK("http://evil","x")'), `"'=HYPERLINK(""http://evil"",""x"")"`);
  assert.equal(csv.csvCell("+61 491 704 136"), "'+61 491 704 136");
  // Safe text and real numbers (incl. negative) are untouched.
  assert.equal(csv.csvCell("Mark O'Brien"), "Mark O'Brien");
  assert.equal(csv.csvCell("a=b"), "a=b");
  assert.equal(csv.csvCell(-5), "-5");
});

test("toCsv emits a BOM, a header row and CRLF-separated rows", () => {
  const out = csv.toCsv(["A", "B,C"], [["1", "x\ny"], [null, "=1+1"]]);
  assert.equal(out, '﻿A,"B,C"\r\n1,"x\ny"\r\n,\'=1+1\r\n');
});

test("money and Adelaide date helpers", () => {
  assert.equal(csv.audFromCents(12345), "123.45");
  assert.equal(csv.audFromCents("5"), "0.05");
  assert.equal(csv.audFromCents(-250), "-2.50");
  assert.equal(csv.audFromCents(null), "");
  assert.equal(csv.adelaideDateTime("2026-11-21T04:00:00Z"), "2026-11-21 14:30");
  assert.equal(csv.adelaideDateTime("2026-07-01T00:00:00Z"), "2026-07-01 09:30");
  assert.equal(csv.adelaideDateTime("nonsense"), "");
});

test("row mappers neutralise customer-supplied text", () => {
  const out = csv.bookingsCsv([{
    booking_number: "HF-1", booking_status: "confirmed", payment_status: "pending", starts_at: "2026-11-21T04:00:00Z", ends_at: null,
    crew_size: 2, subtotal_cents: 10000, deposit_paid_cents: 0, balance_due_cents: 10000, created_at: null,
    pickup_address: { formattedAddress: "1 Main St, Adelaide" }, destination_address: "=cmd()",
    customers: { name: "=HYPERLINK(\"x\")", email: "a@b.co", phone: "+61491704136" },
  }]);
  assert.match(out, /'=HYPERLINK\(""x""\)/);
  assert.match(out, /'\+61491704136/);
  assert.match(out, /'=cmd\(\)/);
  assert.match(out, /100\.00/);
  const quotes = csv.quotesCsv([{ id: "1", quote_status: "new", delivery_status: "sent", created_at: "2026-11-21T04:00:00Z", payload: { name: "@evil", details: ["a", "b"], email: "x@y.z" } }]);
  assert.match(quotes, /'@evil/);
  assert.match(quotes, /a; b/);
});

test("safeLikeTerm strips filter syntax and wildcards", () => {
  assert.equal(csv.safeLikeTerm('a,b)(*%"x'), "a b x");
  assert.equal(csv.safeLikeTerm("x"), "");
  assert.equal(csv.safeLikeTerm("  john.smith@example.com "), "john.smith@example.com");
});

// ---- Authorization on every new route -------------------------------------------------------------

const EXPORTS = ["bookings", "quotes", "invoices", "customers"];

test("every export route and the search route return 401/403 before touching data", async () => {
  for (const [auth, status] of [[unauth, 401], [forbidden, 403]]) {
    const h = harness(auth);
    for (const name of EXPORTS) {
      const response = await h.route(name).GET(req(`/api/admin/export/${name}`));
      assert.equal(response.status, status, `${name} must reject`);
      assert.equal(response.headers["Cache-Control"], "private, no-store, max-age=0");
      assert.ok(!String(response.headers["Content-Type"] ?? "").includes("csv"));
    }
    const search = await h.searchRoute.GET(req("/api/admin/search", "q=salisbury"));
    assert.equal(search.status, status);
    assert.equal(h.calls.length, 0, "no query may run for an unauthorized caller");
  }
});

// ---- Export happy paths ---------------------------------------------------------------------------

test("bookings export is an attachment, no-store, filtered and escaped", async () => {
  const rows = [{
    booking_number: "HF-2026-1", booking_status: "confirmed", payment_status: "pending", starts_at: "2026-11-21T04:00:00Z", ends_at: "2026-11-21T08:00:00Z",
    crew_size: 2, subtotal_cents: 25000, deposit_paid_cents: 0, balance_due_cents: 25000, created_at: "2026-11-01T00:00:00Z",
    pickup_address: { suburb: "Salisbury" }, destination_address: { formattedAddress: "5 Beach Rd, Glenelg" },
    customers: [{ name: "Amy, Jr", email: "amy@example.com", phone: "=1+1" }],
  }];
  const h = harness(owner, { bookings: rows });
  const response = await h.route("bookings").GET(req("/api/admin/export/bookings", "status=confirmed"));
  assert.equal(response.status, 200);
  assert.equal(response.headers["Content-Type"], "text/csv; charset=utf-8");
  assert.match(response.headers["Content-Disposition"], /^attachment; filename="hf-bookings-\d{4}-\d{2}-\d{2}\.csv"$/);
  assert.equal(response.headers["Cache-Control"], "private, no-store, max-age=0");
  assert.equal(response.headers["X-Export-Truncated"], "false");
  assert.match(response.body, /"Amy, Jr"/);
  assert.match(response.body, /'=1\+1/);
  assert.match(response.body, /2026-11-21 14:30/);
  assert.ok(h.calls.some(([t, m, a]) => t === "bookings" && m === "eq" && a[0] === "booking_status" && a[1] === "confirmed"));

  const bad = await h.route("bookings").GET(req("/api/admin/export/bookings", "status=bogus"));
  assert.equal(bad.status, 400);
});

test("quotes export validates status, filters by search and neutralises payload text", async () => {
  const rows = [
    { id: "1", quote_status: "new", delivery_status: "sent", created_at: "2026-11-20T00:00:00Z", payload: { name: "@Bob", email: "bob@x.co", moving_from: "Salisbury" } },
    { id: "2", quote_status: "new", delivery_status: "sent", created_at: "2026-11-19T00:00:00Z", payload: { name: "Cara", email: "cara@x.co", moving_from: "Glenelg" } },
  ];
  const h = harness(owner, { quote_requests: rows });
  const ok = await h.route("quotes").GET(req("/api/admin/export/quotes", "status=new&q=salisbury"));
  assert.equal(ok.status, 200);
  assert.match(ok.body, /'@Bob/);
  assert.doesNotMatch(ok.body, /Cara/);
  assert.equal((await h.route("quotes").GET(req("/api/admin/export/quotes", "status=nope"))).status, 400);
});

test("invoices export covers its filter and rejects unknown statuses", async () => {
  const rows = [{ invoice_number: "INV-0001", status: "issued", booking_reference: "HF-1", customer: { name: "-Dan" }, service_date: "2026-11-01", issue_date: "2026-11-02", total_cents: 9900, created_at: "2026-11-02T00:00:00Z" }];
  const h = harness(owner, { invoices: rows });
  const ok = await h.route("invoices").GET(req("/api/admin/export/invoices", "status=issued"));
  assert.equal(ok.status, 200);
  assert.match(ok.body, /INV-0001/);
  assert.match(ok.body, /'-Dan/);
  assert.match(ok.body, /99\.00/);
  assert.ok(h.calls.some(([t, m, a]) => t === "invoices" && m === "eq" && a[1] === "issued"));
  assert.equal((await h.route("invoices").GET(req("/api/admin/export/invoices", "status=paid"))).status, 400);
});

test("customers export queries the customers table directly and counts bookings", async () => {
  const h = harness(owner, {
    customers: [{ id: "c1", name: "Eve", email: "eve@x.co", phone: "0491", created_at: "2026-01-01T00:00:00Z" }, { id: "c2", name: "Finn", email: "finn@x.co", phone: null, created_at: "2026-02-01T00:00:00Z" }],
    bookings: [{ customer_id: "c1", starts_at: "2026-11-21T04:00:00Z" }, { customer_id: "c1", starts_at: "2026-10-01T04:00:00Z" }],
  });
  const response = await h.route("customers").GET(req("/api/admin/export/customers", "q=ev%2C(e)"));
  assert.equal(response.status, 200);
  assert.match(response.body, /Eve,eve@x\.co,0491,2,2026-11-21 14:30/);
  assert.match(response.body, /Finn,finn@x\.co,,0,,/);
  const or = h.calls.find(([t, m]) => t === "customers" && m === "or");
  assert.ok(or, "search term is applied as a name/email/phone filter");
  assert.doesNotMatch(or[2][0], /[()]/);
});

test("an export that hits the row cap is flagged as truncated", async () => {
  const rows = Array.from({ length: 5001 }, (_, i) => ({ invoice_number: `INV-${i}`, status: "issued", booking_reference: "HF", customer: null, service_date: "2026-01-01", issue_date: null, total_cents: 100, created_at: null }));
  const h = harness(owner, { invoices: rows });
  const response = await h.route("invoices").GET(req("/api/admin/export/invoices"));
  assert.equal(response.headers["X-Export-Truncated"], "true");
  assert.equal(response.body.split("\r\n").filter(Boolean).length, 5001, "header + 5000 rows");
});

test("a database failure returns a generic 503 and leaks nothing", async () => {
  const h = harness(owner, { __error: { code: "XX000", message: "secret detail" }, bookings: [] });
  const response = await h.route("bookings").GET(req("/api/admin/export/bookings"));
  assert.equal(response.status, 503);
  assert.doesNotMatch(JSON.stringify(response.body), /secret/);
});

// ---- Global search --------------------------------------------------------------------------------

test("global search ignores short queries without querying", async () => {
  const h = harness(owner);
  const response = await h.searchRoute.GET(req("/api/admin/search", "q=a"));
  assert.equal(response.status, 200);
  assert.equal(JSON.stringify(response.body), JSON.stringify({ bookings: [], quotes: [], customers: [] }));
  assert.equal(h.calls.length, 0);
});

test("global search covers bookings (finder RPC), quote enquiries and customers", async () => {
  const bookingRow = {
    id: "b1", booking_number: "HF-2026-7", booking_status: "confirmed", starts_at: "2026-11-21T04:00:00Z", ends_at: "2026-11-21T08:00:00Z", estimated_duration_minutes: 240,
    crew_id: null, crew_name: null, vehicle_id: null, vehicle_name: null, dispatch_additional_vehicle_ids: null,
    customer_name: "Gina", customer_email: "gina@x.co", customer_phone: "0491704136", pickup_address: { suburb: "Salisbury" }, destination_address: { suburb: "Glenelg" }, match_rank: 1, total_count: 1,
  };
  const h = harness(owner, {
    rpc: [bookingRow],
    quote_requests: [{ id: "q1", quote_status: "new", created_at: "2026-11-20T00:00:00Z", payload: { name: "Hal", email: "hal@x.co", moving_from: "Salisbury", moving_to: "Mawson Lakes" } }],
    customers: [{ id: "c1", name: "Gina", email: "gina@x.co", phone: "0491704136" }],
    vehicles: [],
  });
  const response = await h.searchRoute.GET(req("/api/admin/search", "q=salisbury"));
  assert.equal(response.status, 200);
  assert.equal(response.headers["Cache-Control"], "private, no-store, max-age=0");
  assert.equal(response.body.bookings[0].href, "/admin/bookings/b1");
  assert.match(response.body.bookings[0].title, /HF-2026-7/);
  assert.equal(response.body.quotes[0].href, "/admin/quotes");
  assert.equal(response.body.customers[0].href, "/admin/customers/c1");
  const rpc = h.calls.find(([t]) => t === "rpc");
  assert.equal(rpc[1], "admin_search_bookings");
  assert.equal(JSON.stringify(rpc[2].p_tokens), JSON.stringify(["salisbury"]));
  assert.equal(rpc[2].p_limit, 5);
});

test("global search sanitises filter syntax before building PostgREST filters", async () => {
  const h = harness(owner);
  await h.searchRoute.GET(req("/api/admin/search", "q=" + encodeURIComponent('x),email.eq.(*,"')));
  const filters = h.calls.filter(([, m]) => m === "or").map(([, , a]) => a[0]);
  assert.equal(filters.length, 2);
  for (const filter of filters) {
    assert.doesNotMatch(filter, /[()"%]/);
    for (const part of filter.split(",")) assert.match(part, /\.ilike\.\*[^*,]+\*$/);
  }
});

test("a search failure is a generic 503", async () => {
  const h = harness(owner, { __error: { code: "XX000" } });
  const response = await h.searchRoute.GET(req("/api/admin/search", "q=salisbury"));
  assert.equal(response.status, 503);
});

// ---- UI wiring ------------------------------------------------------------------------------------

test("the admin shell mounts the global search dialog with combobox semantics", () => {
  const shell = readFileSync(new URL("../app/admin/_components/shell/AdminShell.tsx", import.meta.url), "utf8");
  assert.match(shell, /<GlobalSearch \/>/);
  const dialog = readFileSync(new URL("../app/admin/_components/shell/GlobalSearch.tsx", import.meta.url), "utf8");
  assert.match(dialog, /showModal\(\)/);
  assert.match(dialog, /role="combobox"/);
  assert.match(dialog, /role="listbox"/);
  assert.match(dialog, /ArrowDown/);
  assert.match(dialog, /event\.key\.toLowerCase\(\) === "k"/);
  assert.match(dialog, /returnFocusRef/);
});

test("export buttons are wired on bookings, quotes and invoices", () => {
  for (const [file, route] of [
    ["../app/admin/(protected)/bookings/page.tsx", "/api/admin/export/bookings"],
    ["../app/admin/(protected)/quotes/QuotesClient.tsx", "/api/admin/export/quotes"],
    ["../app/admin/(protected)/invoices/page.tsx", "/api/admin/export/invoices"],
  ]) {
    assert.ok(readFileSync(new URL(file, import.meta.url), "utf8").includes(route), `${file} links ${route}`);
  }
});
