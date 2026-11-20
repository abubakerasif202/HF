import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import * as customersLib from "../lib/customers.ts";
import {
  buildCustomerSummaries, customerChanges, customerEditSchema, filterCustomers, invoiceMoney, matchQuotes, paginate, sumPaidCents,
} from "../lib/customers.ts";

const require = createRequire(import.meta.url);
const clone = (value) => JSON.parse(JSON.stringify(value));
const ID = "00000000-0000-4000-8000-000000000001";
const OTHER = "00000000-0000-4000-8000-000000000002";

const customers = [
  { id: "c1", name: "Ada Lovelace", email: "ada@example.com", phone: "0491 704 136", createdAt: "2026-01-01T00:00:00Z" },
  { id: "c2", name: "Grace Hopper", email: "grace@example.com", phone: "+61 412 345 678", createdAt: "2026-02-01T00:00:00Z" },
  { id: "c3", name: "No Bookings", email: "none@example.com", phone: null, createdAt: "2026-03-01T00:00:00Z" },
];
const bookings = [
  { id: "b1", customerId: "c1", bookingNumber: "HF-1", status: "completed", startsAt: "2026-04-01T00:00:00Z" },
  { id: "b2", customerId: "c1", bookingNumber: "HF-2", status: "confirmed", startsAt: "2026-06-01T00:00:00Z" },
  { id: "b3", customerId: "c1", bookingNumber: "HF-3", status: "held", startsAt: "2026-09-01T00:00:00Z" },
  { id: "b4", customerId: "c2", bookingNumber: "HF-4", status: "expired", startsAt: "2026-05-01T00:00:00Z" },
  { id: "b5", customerId: "c2", bookingNumber: "HF-5", status: "cancelled", startsAt: "2026-05-02T00:00:00Z" },
];
const invoices = [
  { id: "i1", bookingId: "b1", status: "issued", invoiceNumber: "INV-1", totalCents: 100000 },
  { id: "i2", bookingId: "b2", status: "issued", invoiceNumber: "INV-2", totalCents: 50000 },
  { id: "i3", bookingId: "b1", status: "draft", invoiceNumber: null, totalCents: 99999 },
  { id: "i4", bookingId: "b2", status: "void", invoiceNumber: "INV-0", totalCents: 77777 },
];
const payments = [
  { invoiceId: "i1", kind: "deposit", amountCents: 20000 },
  { invoiceId: "i1", kind: "payment", amountCents: 30000 },
  { invoiceId: "i1", kind: "reversal", amountCents: 10000 },
];

test("money: only issued invoices count; paid nets out reversals; outstanding is never negative", () => {
  assert.equal(sumPaidCents(payments), 40000);
  assert.deepEqual(invoiceMoney(invoices, payments), { invoicedCents: 150000, outstandingCents: 60000 + 50000 });
  assert.deepEqual(invoiceMoney([{ id: "x", bookingId: "b", status: "issued", invoiceNumber: "X", totalCents: 100 }], [{ invoiceId: "x", kind: "payment", amountCents: 500 }]), { invoicedCents: 100, outstandingCents: 0 });
  assert.deepEqual(invoiceMoney([], []), { invoicedCents: 0, outstandingCents: 0 });
});

test("summaries: counts leave out holds/expired, sort by last move, roll up money per customer", () => {
  const rows = buildCustomerSummaries(customers, bookings, invoices, payments);
  assert.deepEqual(rows.map((r) => r.id), ["c1", "c2", "c3"]);
  const ada = rows[0];
  assert.equal(ada.bookingCount, 2);
  assert.equal(ada.lastMoveAt, "2026-06-01T00:00:00Z");
  assert.equal(ada.invoicedCents, 150000);
  assert.equal(ada.outstandingCents, 110000);
  const grace = rows[1];
  assert.equal(grace.bookingCount, 1, "cancelled stays in history, expired is dropped");
  assert.equal(grace.invoicedCents, 0);
  assert.equal(rows[2].lastMoveAt, null);
});

test("search: name, email and phone (any AU format) all match; every word must match", () => {
  assert.deepEqual(filterCustomers(customers, "lovelace").map((c) => c.id), ["c1"]);
  assert.deepEqual(filterCustomers(customers, "GRACE@example").map((c) => c.id), ["c2"]);
  assert.deepEqual(filterCustomers(customers, "0491704136").map((c) => c.id), ["c1"]);
  assert.deepEqual(filterCustomers(customers, "+61 491 704 136").map((c) => c.id), ["c1"]);
  assert.deepEqual(filterCustomers(customers, "0412 345").map((c) => c.id), ["c2"]);
  assert.deepEqual(filterCustomers(customers, "ada hopper").map((c) => c.id), []);
  assert.equal(filterCustomers(customers, "   ").length, 3);
  assert.equal(filterCustomers(customers, "zzz").length, 0);
});

test("pagination clamps out-of-range and junk pages", () => {
  const items = Array.from({ length: 60 }, (_, i) => i);
  assert.equal(paginate(items, 1, 25).items.length, 25);
  assert.equal(paginate(items, 3, 25).items.length, 10);
  assert.equal(paginate(items, 99, 25).page, 3);
  assert.equal(paginate(items, Number.NaN, 25).page, 1);
  assert.equal(paginate([], 1, 25).pageCount, 1);
});

test("quote enquiries match by email or phone only, newest first", () => {
  const quotes = [
    { id: "q1", quoteStatus: "new", createdAt: "2026-05-01T00:00:00Z", payload: { email: "ADA@example.com", phone: "" } },
    { id: "q2", quoteStatus: "lost", createdAt: "2026-06-01T00:00:00Z", payload: { email: "other@example.com", phone: "+61491704136" } },
    { id: "q3", quoteStatus: "new", createdAt: "2026-07-01T00:00:00Z", payload: { email: "someone@else.com", phone: "0400 000 000" } },
    { id: "q4", quoteStatus: "new", createdAt: "2026-07-02T00:00:00Z", payload: null },
  ];
  assert.deepEqual(matchQuotes(customers[0], quotes).map((q) => q.id), ["q2", "q1"]);
  assert.deepEqual(matchQuotes(customers[2], quotes), [], "no phone and no matching email means no match");
  assert.deepEqual(matchQuotes({ email: "", phone: "12" }, [{ id: "q5", quoteStatus: "new", createdAt: "2026-01-01T00:00:00Z", payload: { email: "", phone: "12" } }]), [], "empty email / too-short phone never match");
});

test("edit schema: trims, lowercases email, validates phone, rejects unknown keys", () => {
  const ok = customerEditSchema.parse({ id: ID, name: "  Ada  ", email: " ADA@Example.COM ", phone: " 0491 704 136 " });
  assert.deepEqual(ok, { id: ID, name: "Ada", email: "ada@example.com", phone: "0491 704 136" });
  assert.equal(customerEditSchema.parse({ id: ID, name: "A", email: "a@b.co", phone: "" }).phone, null);
  assert.equal(customerEditSchema.parse({ id: ID, name: "A", email: "a@b.co" }).phone, null);
  for (const bad of [
    { id: "nope", name: "A", email: "a@b.co" },
    { id: ID, name: "   ", email: "a@b.co" },
    { id: ID, name: "A", email: "not-an-email" },
    { id: ID, name: "A", email: "a@b.co", phone: "call me" },
    { id: ID, name: "A", email: "a@b.co", phone: "123" },
    { id: ID, name: "A".repeat(201), email: "a@b.co" },
    { id: ID, name: "A", email: "a@b.co", role: "owner" },
  ]) assert.equal(customerEditSchema.safeParse(bad).success, false, JSON.stringify(bad));
});

test("customerChanges reports only fields that differ", () => {
  const before = { name: "Ada", email: "ada@example.com", phone: null };
  assert.equal(customerChanges(before, { name: "Ada", email: "ada@example.com", phone: null }), null);
  assert.deepEqual(customerChanges(before, { name: "Ada L", email: "ada@example.com", phone: "0491704136" }), {
    before: { name: "Ada", phone: null },
    after: { name: "Ada L", phone: "0491704136" },
  });
});

// ---- server action harness: transpile the real action and stub its imports ----
const actionSource = readFileSync(new URL("../app/admin/(protected)/customers/actions.ts", import.meta.url), "utf8");
const actionJs = ts.transpileModule(actionSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

function actionHarness({ session = { userId: "owner-1" }, existing, duplicate = null, auditOk = true, writeError = false } = {}) {
  const calls = [];
  const push = (...entry) => calls.push(clone(entry));
  const exports = {};
  vm.runInNewContext(actionJs, { exports, console: { error() {} } , Object, JSON, Promise,
    require: (id) => {
      if (id === "next/cache") return { revalidatePath: (path) => push("revalidate", path) };
      if (id.includes("supabase-ssr")) return { getStaffSession: async () => { push("session"); return session; } };
      if (id.includes("lib/customers")) return customersLib;
      if (id.includes("customer-repo")) return {
        getCustomerRecord: async (id) => { push("get", id); return existing ?? null; },
        findOtherCustomerWithEmail: async (email, exclude) => { push("dup", email, exclude); return duplicate; },
        updateCustomerRecord: async (id, patch) => { push("update", id, patch); if (writeError) throw new Error("db down"); },
        writeAdminAudit: async (entry) => { push("audit", entry); return auditOk; },
      };
      return require(id);
    },
  });
  return { calls, run: async (input) => clone(await exports.updateCustomerAction(input)) };
}

const stored = { id: ID, name: "Ada", email: "ada@example.com", phone: "0491 704 136", createdAt: "2026-01-01T00:00:00Z" };
const edit = { id: ID, name: "Ada Lovelace", email: "ada@example.com", phone: "0491 704 136" };

test("updateCustomerAction: unauthenticated callers are refused before any data access", async () => {
  const h = actionHarness({ session: null, existing: stored });
  await assert.rejects(h.run(edit), /Not authorized/);
  assert.deepEqual(h.calls, [["session"]]);
});

test("updateCustomerAction: invalid input is rejected without touching the database", async () => {
  const h = actionHarness({ existing: stored });
  const bad = await h.run({ ...edit, email: "nope" });
  assert.match(bad.error, /valid email/i);
  const short = await h.run({ ...edit, phone: "12" });
  assert.match(short.error, /valid phone/i);
  assert.equal(h.calls.some(([name]) => name === "get" || name === "update"), false);
});

test("updateCustomerAction: unknown customer returns a not-found error and writes nothing", async () => {
  const h = actionHarness({ existing: null });
  assert.deepEqual(await h.run(edit), { error: "Customer not found." });
  assert.equal(h.calls.some(([name]) => name === "update" || name === "audit"), false);
});

test("updateCustomerAction: happy path updates the customer, audits the diff and revalidates", async () => {
  const h = actionHarness({ existing: stored });
  const result = await h.run({ ...edit, email: " ADA.L@Example.com " });
  assert.deepEqual(result, { ok: true, changed: true });
  const update = h.calls.find(([name]) => name === "update");
  assert.deepEqual(update.slice(1), [ID, { name: "Ada Lovelace", email: "ada.l@example.com", phone: "0491 704 136" }]);
  const audit = h.calls.find(([name]) => name === "audit")[1];
  assert.equal(audit.actor, "owner-1");
  assert.equal(audit.action, "customer.update");
  assert.equal(audit.entityId, ID);
  assert.deepEqual({ ...audit.before }, { name: "Ada", email: "ada@example.com" });
  assert.deepEqual({ ...audit.after }, { name: "Ada Lovelace", email: "ada.l@example.com" });
  assert.deepEqual(h.calls.filter(([name]) => name === "revalidate").map(([, path]) => path), ["/admin/customers", `/admin/customers/${ID}`]);
});

test("updateCustomerAction: no-op edits write nothing", async () => {
  const h = actionHarness({ existing: stored });
  assert.deepEqual(await h.run({ ...edit, name: "Ada" }), { ok: true, changed: false });
  assert.equal(h.calls.some(([name]) => name === "update" || name === "audit"), false);
});

test("updateCustomerAction: an email already used by another customer is refused", async () => {
  const h = actionHarness({ existing: stored, duplicate: OTHER });
  const result = await h.run({ ...edit, email: "grace@example.com" });
  assert.match(result.error, /already uses that email/);
  assert.equal(h.calls.some(([name]) => name === "update"), false);
});

test("updateCustomerAction: a missing audit table warns but does not lose the edit; database failure is generic", async () => {
  const warned = await actionHarness({ existing: stored, auditOk: false }).run(edit);
  assert.equal(warned.ok, true);
  assert.match(warned.warning, /migration 0022/);
  const failed = await actionHarness({ existing: stored, writeError: true }).run(edit);
  assert.match(failed.error, /temporarily unavailable/);
  assert.doesNotMatch(failed.error, /db down/);
});

test("customers pages re-check authorization and migration 0022 is owner-only", () => {
  for (const path of ["../app/admin/(protected)/customers/page.tsx", "../app/admin/(protected)/customers/[id]/page.tsx"]) {
    assert.match(readFileSync(new URL(path, import.meta.url), "utf8"), /await requireAdmin\(\)/, path);
  }
  const sql = readFileSync(new URL("../supabase/migrations/0022_admin_audit.sql", import.meta.url), "utf8");
  assert.match(sql, /enable row level security/);
  assert.match(sql, /internal\.is_staff\(\)/);
  assert.match(sql, /revoke all on public\.admin_audit from public, anon, authenticated/);
  assert.doesNotMatch(sql, /grant [^;]* to (anon|authenticated)/i);
  const layout = readFileSync(new URL("../app/admin/(protected)/layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /href: "\/admin\/customers", label: "Customers"/);
});
