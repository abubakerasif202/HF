import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import * as invoiceLib from "../lib/invoice.ts";
import * as pdfLib from "../lib/invoice-pdf.ts";
import * as finderLib from "../lib/booking-finder.ts";
import * as datesLib from "../lib/admin/dates.ts";
import * as dispatchLib from "../lib/dispatch.ts";

const require = createRequire(import.meta.url);

/** Loads a TS route/action file into a VM with every collaborator replaced by a recording stub. */
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
const ID = "00000000-0000-4000-8000-000000000001";
const request = (query = "") => ({ nextUrl: { searchParams: new URLSearchParams(query), origin: "https://hf.test" }, url: `https://hf.test/x?${query}`, headers: new Headers() });

/** Chainable query stub: any builder method returns itself; awaiting resolves to the rows. */
function chain(rows) {
  const proxy = new Proxy(function () {}, {
    get: (_t, prop) => (prop === "then" ? (resolve) => resolve({ data: rows, error: null }) : () => proxy),
  });
  return proxy;
}

function searchHarness({ auth = owner, rpcResult = { data: [], error: null } } = {}) {
  const calls = [];
  const supabase = {
    rpc: async (name, args) => { calls.push(["rpc", name, args]); return rpcResult; },
    from: () => chain([]),
  };
  const mod = load("../app/api/admin/bookings/search/route.ts", {
    "next/server": { NextResponse },
    "supabase-ssr": { getAdminAuthState: async () => auth },
    "lib/server/supabase.ts": { getSupabaseAdmin: () => supabase },
    "admin/dates": datesLib,
    "booking-finder": finderLib,
  });
  return { calls, get: (q) => mod.GET(request(q)) };
}

test("booking search enforces owner-only access on the server before touching data", async () => {
  for (const [auth, status] of [[unauth, 401], [forbidden, 403]]) {
    const h = searchHarness({ auth });
    const response = await h.get("q=salisbury");
    assert.equal(response.status, status);
    assert.equal(h.calls.length, 0, "no query for an unauthorised caller");
    assert.match(response.headers["Cache-Control"], /no-store/);
  }
});

test("booking search validates filters and converts them to Adelaide instants", async () => {
  const bad = searchHarness();
  assert.equal((await bad.get("from=nope")).status, 400);
  assert.equal((await bad.get("status=bogus")).status, 400);
  assert.equal((await bad.get("crewId=1")).status, 400);
  assert.equal(bad.calls.length, 0);

  const h = searchHarness({ rpcResult: { data: [{ id: ID, booking_number: "HF-1", booking_status: "confirmed", starts_at: "2026-11-20T00:00:00Z", ends_at: "2026-11-20T03:00:00Z", customer_name: "Sample", customer_phone: "0491 704 136", customer_email: null, pickup_address: { suburb: "Salisbury" }, destination_address: "Unit 4, Test Rd, Norwood SA 5067", crew_name: null, vehicle_name: null, dispatch_additional_vehicle_ids: [], match_rank: 1, total_count: "41" }], error: null } });
  const response = await h.get("q=%2B61%20491%20704%20136&from=2026-11-20&to=2026-11-20&page=2&pageSize=20");
  assert.equal(response.status, 200);
  const [, name, args] = h.calls[0];
  assert.equal(name, "admin_search_bookings");
  assert.equal(args.p_phone, "0491704136");
  assert.equal(args.p_from, "2026-11-19T13:30:00.000Z");
  assert.equal(args.p_offset, 20);
  assert.equal(response.body.total, 41);
  assert.equal(response.body.hasMore, true);
  assert.equal(response.body.results[0].pickup, "Salisbury");
  assert.equal(response.body.results[0].destination, "Test Rd, Norwood SA 5067"); // legacy string address: last two parts, like shortPlace
});

test("booking search failures return a generic 503 without leaking database text", async () => {
  const h = searchHarness({ rpcResult: { data: null, error: { code: "42P01", message: 'relation "secret_table" does not exist' } } });
  const response = await h.get("q=x");
  assert.equal(response.status, 503);
  assert.doesNotMatch(JSON.stringify(response.body), /secret_table|42P01/);
});

function pdfHarness({ auth = owner, invoice, settings = null } = {}) {
  const calls = [];
  const mod = load("../app/api/admin/invoices/[id]/pdf/route.ts", {
    "next/server": { NextResponse, NextRequest: class {} },
    "supabase-ssr": { getAdminAuthState: async () => auth },
    "invoice-repo": {
      getInvoice: async (id) => { calls.push(["getInvoice", id]); return invoice ?? null; },
      getInvoiceSettings: async () => settings,
      buildInvoiceDocument: async (inv) => inv.snapshot ? { ...inv.snapshot, voided: inv.status === "void", draft: false } : { title: "Invoice", invoiceNumber: null, bookingReference: inv.bookingReference, serviceDate: "2026-11-20", customer: { name: "Sample" }, amountsIncludeGst: null, seller: { legalName: "HF REMOVALS PTY LTD" }, lines: [], payments: [], totals: { subtotalCents: 0, gstCents: 0, totalCents: 0, paidCents: 0, balanceDueCents: 0 }, draft: true },
    },
    "invoice-pdf": pdfLib,
  });
  return { calls, get: (id) => mod.GET({}, { params: Promise.resolve({ id }) }) };
}

const issued = {
  id: ID, status: "issued", invoiceNumber: "INV-000007", bookingReference: "HF-2026-00042",
  snapshot: { title: "Tax invoice", invoiceNumber: "INV-000007", issueDate: "2026-11-18", dueDate: "2026-12-02", bookingReference: "HF-2026-00042", serviceDate: "2026-11-20", customer: { name: "Sample Customer 01" }, amountsIncludeGst: true,
    seller: { legalName: "HF REMOVALS PTY LTD", abn: "51824753556", gstRegistered: true }, lines: [{ kind: "service", description: "Move", quantityMilli: 1000, unitPriceCents: 11000, amountCents: 11000 }], payments: [], totals: { subtotalCents: 10000, gstCents: 1000, totalCents: 11000, paidCents: 0, balanceDueCents: 11000 } },
};

test("invoice PDF download obeys the same owner-only permission as the invoice pages", async () => {
  for (const [auth, status] of [[unauth, 401], [forbidden, 403]]) {
    const h = pdfHarness({ auth, invoice: issued });
    const response = await h.get(ID);
    assert.equal(response.status, status);
    assert.equal(h.calls.length, 0, "an unauthorised caller must not even load the invoice");
    assert.doesNotMatch(JSON.stringify(response.body), /INV-000007|Sample/);
  }
});

test("invoice PDF returns the issued snapshot as a private attachment, and 404s unknown or malformed ids", async () => {
  const h = pdfHarness({ invoice: issued });
  const response = await h.get(ID);
  assert.equal(response.status, 200);
  assert.equal(response.headers["Content-Type"], "application/pdf");
  assert.equal(response.headers["Content-Disposition"], 'attachment; filename="HF-INV-000007.pdf"');
  assert.match(response.headers["Cache-Control"], /private, no-store/);
  assert.equal(response.headers["X-Content-Type-Options"], "nosniff");
  const text = Buffer.from(response.body).toString("latin1");
  assert.match(text, /^%PDF-1\.4/);
  assert.ok(text.includes("(INV-000007) Tj") && text.includes("TAX INVOICE"));
  assert.equal((await pdfHarness({}).get(ID)).status, 404);
  const malformed = pdfHarness({ invoice: issued });
  assert.equal((await malformed.get("../../etc/passwd")).status, 404);
  assert.equal(malformed.calls.length, 0);
  const draft = await pdfHarness({ invoice: { id: ID, status: "draft", invoiceNumber: null, bookingReference: "HF-2026-00042", snapshot: null } }).get(ID);
  assert.equal(draft.headers["Content-Disposition"], 'attachment; filename="HF-draft-HF-2026-00042.pdf"');
  assert.ok(Buffer.from(draft.body).toString("latin1").includes("(DRAFT) Tj"));
  const voided = await pdfHarness({ invoice: { ...issued, status: "void" } }).get(ID);
  assert.match(voided.headers["Content-Disposition"], /HF-VOID-INV-000007/);
});

test("dispatch queues are owner-only", async () => {
  for (const [auth, status] of [[unauth, 401], [forbidden, 403]]) {
    const calls = [];
    const mod = load("../app/api/admin/dispatch/queues/route.ts", {
      "next/server": { NextResponse },
      "supabase-ssr": { getAdminAuthState: async () => auth },
      "lib/server/supabase.ts": { getSupabaseAdmin: () => { calls.push("db"); return {}; } },
      "admin/dates": datesLib, "lib/dispatch.ts": dispatchLib, "booking-finder": finderLib,
    });
    assert.equal((await mod.GET()).status, status);
    assert.equal(calls.length, 0);
  }
});

function actionsHarness({ session = { userId: "owner-1" } } = {}) {
  const calls = [];
  const spy = (name, result) => async (...args) => { calls.push([name, ...args]); return typeof result === "function" ? result(...args) : result; };
  const repo = {
    InvoiceError: class extends Error { constructor(status, code, message) { super(message); this.status = status; this.code = code; } },
    mapInvoiceError: (e) => ({ message: e?.message ?? "Invoicing is temporarily unavailable." }),
    createInvoiceDraftForBooking: spy("create", { id: ID, created: true }),
    discardInvoiceDraft: spy("discard", undefined),
    issueInvoice: spy("issue", { invoiceNumber: "INV-000001", replayed: false }),
    recordInvoicePayment: spy("payment", { balanceDueCents: 100, replayed: false }),
    saveInvoiceDraft: spy("save", { version: 2 }),
    saveInvoiceSettings: spy("settings", undefined),
    voidInvoice: spy("void", { newDraftId: null }),
  };
  const mod = load("../app/admin/(protected)/invoices/actions.ts", {
    "next/cache": { revalidatePath() {} },
    "next/navigation": { redirect: (url) => { throw Object.assign(new Error("NEXT_REDIRECT"), { url }); } },
    "supabase-ssr": { getStaffSession: async () => session },
    "invoice-repo": repo,
    "lib/invoice.ts": invoiceLib,
    zod: require("zod"),
  });
  return { calls, mod };
}

test("every invoice action rejects an unauthorised caller before any work", async () => {
  const h = actionsHarness({ session: null });
  const form = new FormData();
  const attempts = [
    () => h.mod.createInvoiceDraftAction(ID),
    () => h.mod.saveInvoiceDraftAction({}),
    () => h.mod.issueInvoiceAction(ID, "key-0000001"),
    () => h.mod.recordPaymentAction({}),
    () => h.mod.reversePaymentAction({}),
    () => h.mod.voidInvoiceAction(ID, "mistake", false),
    () => h.mod.discardInvoiceDraftAction(ID),
    () => h.mod.saveInvoiceSettingsAction(form),
  ];
  for (const run of attempts) await assert.rejects(run, /Not authorized/);
  assert.equal(h.calls.length, 0);
});

test("invoice actions validate input and pass the owner id and retry key through", async () => {
  const h = actionsHarness();
  assert.deepEqual({ ...await h.mod.issueInvoiceAction("not-a-uuid", "key-0000001") }, { error: "Some details are invalid. Check the highlighted fields." });
  assert.deepEqual({ ...await h.mod.issueInvoiceAction(ID, "short") }, { error: "Some details are invalid. Check the highlighted fields." });
  assert.equal(h.calls.length, 0);
  assert.deepEqual({ ...await h.mod.issueInvoiceAction(ID, "key-0000001") }, { invoiceNumber: "INV-000001", replayed: false });
  assert.deepEqual(h.calls.at(-1), ["issue", ID, "key-0000001", "owner-1"]);

  const line = { kind: "service", description: "Move", quantityMilli: 3500, unitPriceCents: 15800 };
  const draft = { invoiceId: ID, version: 1, customer: { name: "A", email: null, phone: null }, notes: null, serviceDate: "2026-11-20", amountsIncludeGst: true, lines: [line], payments: [] };
  assert.equal((await h.mod.saveInvoiceDraftAction(draft)).version, 2);
  for (const bad of [
    { ...draft, lines: [{ ...line, unitPriceCents: -1 }] },
    { ...draft, lines: [{ ...line, kind: "refund" }] },
    { ...draft, lines: [{ ...line, quantityMilli: 0 }] },
    { ...draft, serviceDate: "2026-02-30" },
    { ...draft, payments: [{ kind: "reversal", amountCents: 5, receivedOn: "2026-11-20" }] },
    { ...draft, invoiceId: "x" },
  ]) assert.match((await h.mod.saveInvoiceDraftAction(bad)).error, /invalid/);
  assert.equal(h.calls.filter((c) => c[0] === "save").length, 1);
});

test("settings reject an invalid ABN, prefix and terms; blank means not configured", async () => {
  const h = actionsHarness();
  const form = (fields) => { const f = new FormData(); for (const [k, v] of Object.entries(fields)) f.set(k, v); return f; };
  assert.match((await h.mod.saveInvoiceSettingsAction(form({ abn: "12345678901" }))).error, /ABN is not valid/);
  assert.match((await h.mod.saveInvoiceSettingsAction(form({ invoice_prefix: "bad prefix!" }))).error, /prefix/);
  assert.match((await h.mod.saveInvoiceSettingsAction(form({ payment_terms_days: "9999" }))).error, /Payment terms/);
  assert.equal(h.calls.length, 0);
  assert.equal((await h.mod.saveInvoiceSettingsAction(form({ abn: "51 824 753 556", gst_registered: "yes", rates_include_gst: "inclusive", invoice_prefix: "INV-", payment_terms_days: "14" }))).error, undefined);
  assert.deepEqual({ ...h.calls[0][1] }, { abn: "51824753556", gstRegistered: true, ratesIncludeGst: true, bankAccountName: null, bankBsb: null, bankAccountNumber: null, paymentInstructions: null, paymentTermsDays: 14, invoicePrefix: "INV-", footerNote: null });
  // Blank form: everything stays null (nothing is invented).
  await h.mod.saveInvoiceSettingsAction(form({}));
  assert.deepEqual({ ...h.calls[1][1] }, { abn: null, gstRegistered: null, ratesIncludeGst: null, bankAccountName: null, bankBsb: null, bankAccountNumber: null, paymentInstructions: null, paymentTermsDays: null, invoicePrefix: null, footerNote: null });
});

test("voiding needs a reason and discarding/creating redirect only on success", async () => {
  const h = actionsHarness();
  assert.match((await h.mod.voidInvoiceAction(ID, " ", true)).error, /invalid/);
  assert.equal(h.calls.length, 0);
  await assert.rejects(() => h.mod.createInvoiceDraftAction(ID), (error) => error.url === `/admin/invoices/${ID}`);
  await assert.rejects(() => h.mod.discardInvoiceDraftAction(ID), (error) => error.url === "/admin/invoices");
});
