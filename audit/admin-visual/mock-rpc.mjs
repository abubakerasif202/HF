// JavaScript stand-ins for the migration-0019 SQL functions, used ONLY by the synthetic mock Supabase
// so the Playwright workflow can run without a database. The real SQL is exercised separately against
// real PostgreSQL in tests/booking-finder-database.test.mjs and tests/invoice-database.test.mjs.
import { computeInvoiceTotals, lineAmountCents } from "../../lib/invoice.ts";

const fail = (message, code = "55000", detail = null, status = 409) => ({ status, body: { code, message, details: detail, hint: null } });
const todayAdelaide = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Adelaide", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const addDays = (ymd, days) => new Date(Date.parse(`${ymd}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

function normalizePhone(value) {
  const d = String(value ?? "").replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("0061")) return `0${d.slice(4)}`;
  if (d.startsWith("61") && d.length === 11) return `0${d.slice(2)}`;
  return d;
}
const addressText = (a) => (!a ? "" : typeof a === "string" ? a : [a.formattedAddress, a.addressLine, a.suburb].filter(Boolean).join(" "));

function search(args, db) {
  const { p_tokens = [], p_reference = null, p_phone = null, p_from = null, p_to = null, p_status = null, p_crew_id = null, p_vehicle_id = null, p_limit = 20, p_offset = 0 } = args;
  const rows = db.bookings.map((b) => {
    const customer = db.customers.find((c) => c.id === b.customer_id) ?? {};
    const phoneNorm = normalizePhone(customer.phone);
    const refAlnum = String(b.booking_number).toUpperCase().replace(/[^A-Z0-9]/g, "");
    const haystack = [b.booking_number, String(b.booking_number).replace(/[^A-Za-z0-9]/g, ""), customer.name, customer.email, customer.phone, phoneNorm, addressText(b.pickup_address), addressText(b.destination_address)].filter(Boolean).join(" ").toLowerCase();
    const rank = p_reference && refAlnum === p_reference ? 0 : p_phone && phoneNorm === p_phone ? 1 : p_reference && p_reference.length >= 3 && refAlnum.includes(p_reference) ? 2 : 3;
    return { b, customer, phoneNorm, haystack, rank };
  }).filter(({ b, phoneNorm, haystack }) =>
    (!p_from || Date.parse(b.starts_at) >= Date.parse(p_from)) && (!p_to || Date.parse(b.starts_at) < Date.parse(p_to))
    && (!p_status || b.booking_status === p_status) && (!p_crew_id || b.crew_id === p_crew_id)
    && (!p_vehicle_id || b.vehicle_id === p_vehicle_id || (b.dispatch_additional_vehicle_ids ?? []).includes(p_vehicle_id))
    && (!p_phone || (phoneNorm ?? "").includes(p_phone))
    && p_tokens.every((t) => !t || haystack.includes(t)));
  rows.sort((x, y) => x.rank - y.rank || Date.parse(y.b.starts_at) - Date.parse(x.b.starts_at) || x.b.id.localeCompare(y.b.id));
  const total = rows.length;
  const limit = Math.max(1, Math.min(p_limit ?? 20, 50));
  return rows.slice(Math.max(0, p_offset ?? 0), Math.max(0, p_offset ?? 0) + limit).map(({ b, customer, rank }) => ({
    id: b.id, booking_number: b.booking_number, booking_status: b.booking_status, starts_at: b.starts_at, ends_at: b.ends_at,
    estimated_duration_minutes: b.estimated_duration_minutes, crew_id: b.crew_id, crew_name: db.crews.find((c) => c.id === b.crew_id)?.name ?? null,
    vehicle_id: b.vehicle_id, vehicle_name: db.vehicles.find((v) => v.id === b.vehicle_id)?.name ?? null,
    dispatch_additional_vehicle_ids: b.dispatch_additional_vehicle_ids ?? [], customer_name: customer.name ?? null, customer_email: customer.email ?? null,
    customer_phone: customer.phone ?? null, pickup_address: b.pickup_address, destination_address: b.destination_address, match_rank: rank, total_count: total,
  }));
}

const event = (db, invoiceId, name, actor, metadata = {}) => db.invoice_events.push({ id: crypto.randomUUID(), invoice_id: invoiceId, event: name, actor, metadata, created_at: new Date().toISOString() });
const paidOf = (db, id) => db.invoice_payments.filter((p) => p.invoice_id === id).reduce((s, p) => s + (p.kind === "reversal" ? -p.amount_cents : p.amount_cents), 0);

function applyPayload(db, invoiceId, payload) {
  if (payload.lines) {
    db.invoice_lines = db.invoice_lines.filter((l) => l.invoice_id !== invoiceId);
    payload.lines.forEach((l, position) => db.invoice_lines.push({ id: crypto.randomUUID(), invoice_id: invoiceId, position, kind: l.kind, description: l.description, quantity_milli: l.quantityMilli, unit_price_cents: l.unitPriceCents }));
  }
  if (payload.payments) {
    db.invoice_payments = db.invoice_payments.filter((p) => p.invoice_id !== invoiceId);
    for (const p of payload.payments) db.invoice_payments.push({ id: crypto.randomUUID(), invoice_id: invoiceId, kind: p.kind, amount_cents: p.amountCents, received_on: p.receivedOn, method: p.method || null, reference: p.reference || null, source: p.source ?? "manual", reverses_payment_id: null, idempotency_key: null, recorded_by: null, created_at: new Date().toISOString() });
  }
}

const liveInvoice = (db, bookingId) => db.invoices.find((i) => i.booking_id === bookingId && i.status !== "void");

export function mockRpc(fn, args, db) {
  switch (fn) {
    case "admin_search_bookings": return { status: 200, body: search(args, db) };
    case "create_invoice_draft": {
      const { p_booking_id: bookingId, p_actor: actor, p_draft: d } = args;
      if (!db.bookings.some((b) => b.id === bookingId)) return fail("booking_not_found", "P0002", null, 404);
      const existing = liveInvoice(db, bookingId);
      if (existing) return { status: 200, body: { id: existing.id, created: false } };
      const id = crypto.randomUUID();
      db.invoices.push({ id, booking_id: bookingId, status: "draft", invoice_number: null, invoice_sequence: null, pricing_mode: d.pricingMode, pricing_source: d.pricingSource, amounts_include_gst: d.amountsIncludeGst ?? null, customer: d.customer ?? {}, booking_reference: d.bookingReference, service_date: d.serviceDate, issue_date: null, due_date: null, notes: d.notes ?? null, version: 1, issue_idempotency_key: null, snapshot: null, subtotal_cents: null, gst_cents: null, total_cents: null, replaces_invoice_id: null, voided_at: null, voided_by: null, void_reason: null, created_by: actor, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
      applyPayload(db, id, d);
      event(db, id, "draft_created", actor, { pricingSource: d.pricingSource });
      return { status: 200, body: { id, created: true } };
    }
    case "save_invoice_draft": {
      const inv = db.invoices.find((i) => i.id === args.p_invoice_id);
      if (!inv) return fail("invoice_not_found", "P0002", null, 404);
      if (inv.status !== "draft") return fail("invoice_not_draft");
      if (inv.version !== args.p_expected_version) return fail("invoice_changed", "40001");
      const p = args.p_patch;
      if ("customer" in p) inv.customer = p.customer;
      if ("notes" in p) inv.notes = p.notes || null;
      if ("serviceDate" in p) inv.service_date = p.serviceDate;
      if ("amountsIncludeGst" in p) inv.amounts_include_gst = p.amountsIncludeGst;
      inv.version += 1;
      applyPayload(db, inv.id, p);
      event(db, inv.id, "draft_saved", args.p_actor, { version: inv.version });
      return { status: 200, body: { id: inv.id, version: inv.version } };
    }
    case "issue_invoice": {
      const inv = db.invoices.find((i) => i.id === args.p_invoice_id);
      if (!inv) return fail("invoice_not_found", "P0002", null, 404);
      if (inv.status === "issued" && inv.issue_idempotency_key === args.p_idempotency_key) return { status: 200, body: { id: inv.id, invoiceNumber: inv.invoice_number, issueDate: inv.issue_date, dueDate: inv.due_date, replayed: true } };
      if (inv.status !== "draft") return fail("invoice_not_draft");
      if (inv.version !== args.p_expected_version) return fail("invoice_changed", "40001");
      const s = db.invoice_settings[0];
      const missing = [["abn", s.abn == null], ["gst_registered", s.gst_registered == null], ["invoice_prefix", s.invoice_prefix == null], ["bank_account_name", !s.bank_account_name], ["bank_bsb", s.bank_bsb == null], ["bank_account_number", s.bank_account_number == null], ["payment_terms_days", s.payment_terms_days == null]].filter(([, m]) => m).map(([k]) => k);
      if (missing.length) return fail("invoice_settings_incomplete", "55000", missing.join(","));
      if (s.gst_registered && inv.amounts_include_gst == null) return fail("gst_mode_required");
      const lines = db.invoice_lines.filter((l) => l.invoice_id === inv.id).sort((a, b) => a.position - b.position);
      if (!lines.length) return fail("invoice_has_no_lines");
      const totals = computeInvoiceTotals({ lines: lines.map((l) => ({ kind: l.kind, quantityMilli: l.quantity_milli, unitPriceCents: l.unit_price_cents })), gstRegistered: s.gst_registered, amountsIncludeGst: inv.amounts_include_gst });
      const claimed = args.p_snapshot?.totals;
      if (claimed && typeof claimed === "object" && claimed.totalCents !== totals.totalCents) return fail("totals_mismatch");
      if (totals.totalCents <= 0) return fail("invoice_total_not_positive");
      const paid = paidOf(db, inv.id);
      if (paid > totals.totalCents) return fail("payments_exceed_total");
      const seq = s.next_invoice_number; s.next_invoice_number += 1;
      const number = `${s.invoice_prefix}${String(seq).padStart(6, "0")}`;
      const issueDate = todayAdelaide(); const dueDate = addDays(issueDate, s.payment_terms_days);
      const payments = db.invoice_payments.filter((p) => p.invoice_id === inv.id).map((p) => ({ kind: p.kind, amountCents: p.amount_cents, receivedOn: p.received_on, method: p.method, reference: p.reference, source: p.source }));
      Object.assign(inv, {
        status: "issued", invoice_number: number, invoice_sequence: seq, issue_date: issueDate, due_date: dueDate, issue_idempotency_key: args.p_idempotency_key,
        subtotal_cents: totals.subtotalCents, gst_cents: totals.gstCents, total_cents: totals.totalCents, version: inv.version + 1,
        snapshot: {
          ...args.p_snapshot, title: s.gst_registered ? "Tax invoice" : "Invoice", invoiceNumber: number, issueDate, dueDate, bookingReference: inv.booking_reference, serviceDate: inv.service_date,
          customer: inv.customer, notes: inv.notes, amountsIncludeGst: inv.amounts_include_gst,
          seller: { ...(args.p_snapshot?.seller ?? {}), abn: s.abn, gstRegistered: s.gst_registered, paymentInstructions: s.payment_instructions, bankAccountName: s.bank_account_name, bankBsb: s.bank_bsb, bankAccountNumber: s.bank_account_number, paymentTermsDays: s.payment_terms_days, footerNote: s.footer_note },
          lines: lines.map((l) => ({ kind: l.kind, description: l.description, quantityMilli: l.quantity_milli, unitPriceCents: l.unit_price_cents, amountCents: lineAmountCents({ kind: l.kind, quantityMilli: l.quantity_milli, unitPriceCents: l.unit_price_cents }) })),
          payments, totals: { ...totals, paidCents: paid, balanceDueCents: totals.totalCents - paid },
        },
      });
      event(db, inv.id, "invoice_issued", args.p_actor, { invoiceNumber: number });
      db.booking_events.push({ id: crypto.randomUUID(), booking_id: inv.booking_id, event: "invoice_issued", actor: args.p_actor, metadata: { invoiceNumber: number }, created_at: new Date().toISOString() });
      return { status: 200, body: { id: inv.id, invoiceNumber: number, issueDate, dueDate, replayed: false } };
    }
    case "record_invoice_payment": {
      const inv = db.invoices.find((i) => i.id === args.p_invoice_id);
      if (!inv) return fail("invoice_not_found", "P0002", null, 404);
      const dupe = db.invoice_payments.find((p) => p.idempotency_key === args.p_idempotency_key);
      if (dupe) return { status: 200, body: { id: dupe.id, replayed: true, balanceDueCents: inv.total_cents - paidOf(db, inv.id) } };
      if (inv.status !== "issued") return fail("invoice_not_issued");
      if (args.p_kind === "reversal") {
        const original = db.invoice_payments.find((p) => p.id === args.p_reverses_payment_id && p.invoice_id === inv.id && p.kind !== "reversal");
        if (!original) return fail("payment_not_found", "P0002", null, 404);
        if (original.amount_cents !== args.p_amount_cents) return fail("reversal_amount_mismatch");
      } else if (args.p_amount_cents > inv.total_cents - paidOf(db, inv.id)) return fail("payment_exceeds_balance");
      const row = { id: crypto.randomUUID(), invoice_id: inv.id, kind: args.p_kind, amount_cents: args.p_amount_cents, received_on: args.p_received_on, method: args.p_method || null, reference: args.p_reference || null, source: "manual", reverses_payment_id: args.p_reverses_payment_id ?? null, idempotency_key: args.p_idempotency_key, recorded_by: args.p_actor, created_at: new Date().toISOString() };
      db.invoice_payments.push(row);
      event(db, inv.id, args.p_kind === "reversal" ? "payment_reversed" : "payment_recorded", args.p_actor, { amountCents: args.p_amount_cents });
      return { status: 200, body: { id: row.id, replayed: false, balanceDueCents: inv.total_cents - paidOf(db, inv.id) } };
    }
    case "void_invoice": {
      const inv = db.invoices.find((i) => i.id === args.p_invoice_id);
      if (!inv) return fail("invoice_not_found", "P0002", null, 404);
      if (!args.p_reason || args.p_reason.trim().length < 3) return fail("void_reason_required", "22023", null, 400);
      if (inv.status !== "issued") return fail("invoice_not_issued");
      Object.assign(inv, { status: "void", voided_at: new Date().toISOString(), voided_by: args.p_actor, void_reason: args.p_reason.trim() });
      event(db, inv.id, "invoice_voided", args.p_actor, { reason: args.p_reason.trim(), invoiceNumber: inv.invoice_number });
      let newDraftId = null;
      if (args.p_reissue) {
        newDraftId = crypto.randomUUID();
        db.invoices.push({ ...inv, id: newDraftId, status: "draft", invoice_number: null, invoice_sequence: null, issue_date: null, due_date: null, issue_idempotency_key: null, snapshot: null, subtotal_cents: null, gst_cents: null, total_cents: null, version: 1, replaces_invoice_id: inv.id, voided_at: null, voided_by: null, void_reason: null, created_by: args.p_actor, created_at: new Date().toISOString() });
        for (const l of db.invoice_lines.filter((x) => x.invoice_id === inv.id)) db.invoice_lines.push({ ...l, id: crypto.randomUUID(), invoice_id: newDraftId });
        for (const p of db.invoice_payments.filter((x) => x.invoice_id === inv.id && x.kind !== "reversal" && !db.invoice_payments.some((r) => r.reverses_payment_id === x.id))) db.invoice_payments.push({ ...p, id: crypto.randomUUID(), invoice_id: newDraftId, idempotency_key: null, reverses_payment_id: null });
        event(db, newDraftId, "draft_created", args.p_actor, { replaces: inv.invoice_number });
      }
      return { status: 200, body: { voidedId: inv.id, newDraftId } };
    }
    default: return null;
  }
}
