import assert from "node:assert/strict";
import test from "node:test";
import { computeInvoiceTotals, prefillInvoiceFromBooking } from "../lib/invoice.ts";
import { postgresAvailable, withMigratedPostgres } from "./helpers/postgres.mjs";

// Real isolated PostgreSQL with the REAL migration chain; never the app database.
const j = (value) => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
const uuid = (n) => `b0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const SEED = `
  insert into customers (id, name, email, phone) values
    ('a0000000-0000-4000-8000-000000000001','Sample Customer 01','sample01@example.invalid','0491 704 136'),
    ('a0000000-0000-4000-8000-000000000002','Sample Customer 02','sample02@example.invalid',null);
  -- Legacy finalised booking with the historical $100 confirmation payment and a frozen $79/30min snapshot.
  insert into bookings (id, booking_number, customer_id, starts_at, ends_at, estimated_duration_minutes, crew_size, booking_status,
      pricing_snapshot, deposit_paid_cents, subtotal_cents, balance_due_cents, finalised_at, actual_duration_minutes,
      billable_duration_minutes, service_charge_cents, callout_fee_cents, final_total_cents, confirmed_at) values
    ('${uuid(1)}','HF-2025-00001','a0000000-0000-4000-8000-000000000001','2025-06-09 23:30:00+00','2025-06-10 03:30:00+00',240,2,'completed',
      '{"package":"HR truck + 2 movers","ratePer30MinCents":7900,"minimumBookingMinutes":180,"calloutMinutes":60}',10000,53800,43800,now(),200,210,55300,15800,71100,'2025-05-20 01:00:00+00'),
    -- No snapshot and no price at all (oldest shape).
    ('${uuid(2)}','HF-2024-00007','a0000000-0000-4000-8000-000000000002','2024-03-01 00:00:00+00','2024-03-01 03:00:00+00',180,2,'completed',
      null,0,0,0,null,null,null,null,null,null,null);
  insert into bookings (id, booking_number, customer_id, starts_at, ends_at, estimated_duration_minutes, crew_size, booking_status, subtotal_cents) values
    ('${uuid(3)}','HF-2026-00100','a0000000-0000-4000-8000-000000000001','2026-11-01 00:00:00+00','2026-11-01 03:00:00+00',180,2,'completed',20000),
    ('${uuid(4)}','HF-2026-00101','a0000000-0000-4000-8000-000000000002','2026-11-02 00:00:00+00','2026-11-02 03:00:00+00',180,2,'completed',30000);
`;

const settingsSql = `update invoice_settings set abn='51824753556', gst_registered=true, rates_include_gst=true,
  invoice_prefix='INV-', payment_instructions='Pay to the account on the invoice.', payment_terms_days=14`;

const bookingRow = (id) => ({ id });

test("invoice migration: issuance is atomic, retry-safe, immutable and auditable", { timeout: 180000 }, async (t) => {
  if (!postgresAvailable()) { t.skip("Local PostgreSQL binaries unavailable"); return; }
  await withMigratedPostgres({ upTo: "0018" }, async ({ sql, sqlAsync, applyFile }) => {
    sql(SEED);
    const fingerprint = () => sql("select md5(string_agg(b::text, '|' order by id)) from bookings b");
    const before = fingerprint();
    applyFile("0019_booking_finder_and_invoicing.sql");
    assert.equal(fingerprint(), before, "additive migration must not touch any booking");
    // Re-applying is a no-op for data (idempotent object creation), never destructive.
    assert.equal(sql("select count(*) from invoice_settings"), "1");
    assert.equal(sql("select abn is null and gst_registered is null and invoice_prefix is null from invoice_settings"), "t");

    // ---- draft creation from a legacy booking (historical deposit, frozen rate) ----
    const legacyBooking = {
      booking_number: "HF-2025-00001", starts_at: "2025-06-09T23:30:00Z", estimated_duration_minutes: 240,
      pricing_snapshot: { package: "HR truck + 2 movers", ratePer30MinCents: 7900, minimumBookingMinutes: 180, calloutMinutes: 60 },
      deposit_paid_cents: 10000, confirmed_at: "2025-05-20T01:00:00Z", finalised_at: "2025-06-10T04:00:00Z",
      billable_duration_minutes: 210, service_charge_cents: 55300, callout_fee_cents: 15800, final_total_cents: 71100,
      customers: { name: "Sample Customer 01", email: "sample01@example.invalid", phone: "0491 704 136" },
    };
    const draft = prefillInvoiceFromBooking(legacyBooking, null);
    assert.equal(draft.pricingSource, "final_billing");
    const created = JSON.parse(sql(`select public.create_invoice_draft('${uuid(1)}', 'owner', ${j(draft)})`));
    assert.equal(created.created, true);
    const again = JSON.parse(sql(`select public.create_invoice_draft('${uuid(1)}', 'owner', ${j(draft)})`));
    assert.deepEqual([again.created, again.id], [false, created.id], "creating twice must return the same draft");
    assert.equal(sql(`select count(*) from invoices where booking_id='${uuid(1)}'`), "1");
    assert.equal(sql(`select count(*) from invoice_payments where invoice_id='${created.id}' and source='booking_deposit' and amount_cents=10000`), "1");
    const invoiceId = created.id;
    const snapshotOf = (id) => sql(`select snapshot::text from invoices where id='${id}'`);

    // ---- settings missing => issuance blocked, counter untouched ----
    const issue = (id, key, version, claimed) => `select public.issue_invoice('${id}','${key}',${version},${j({ seller: { legalName: "HF REMOVALS PTY LTD" }, totals: claimed })},'owner')`;
    assert.throws(() => sql(issue(invoiceId, "key-00000001", 1, null)), /invoice_settings_incomplete/);
    assert.equal(sql("select next_invoice_number from invoice_settings"), "1");
    sql(settingsSql);
    // GST registered but the amount mode was never chosen.
    sql(`update invoices set amounts_include_gst = null where id='${invoiceId}'`);
    assert.throws(() => sql(issue(invoiceId, "key-00000001", 1, null)), /gst_mode_required/);
    // Stale version (someone edited the draft after the snapshot was prepared).
    const saved = JSON.parse(sql(`select public.save_invoice_draft('${invoiceId}', 1, 'owner', ${j({ amountsIncludeGst: true })})`));
    assert.equal(saved.version, 2);
    assert.throws(() => sql(issue(invoiceId, "key-00000001", 1, null)), /invoice_changed/);
    assert.throws(() => sql(issue(invoiceId, "short", 2, null)), /idempotency_key_required/);
    // The client's claimed totals must match the database's own recomputation.
    assert.throws(() => sql(issue(invoiceId, "key-00000001", 2, { totalCents: 1 })), /totals_mismatch/);
    assert.equal(sql("select next_invoice_number from invoice_settings"), "1");

    // ---- issue, then retry with the same key: same number, counter moved once ----
    const claimed = computeInvoiceTotals({ lines: draft.lines, gstRegistered: true, amountsIncludeGst: true });
    const first = JSON.parse(sql(issue(invoiceId, "key-00000001", 2, claimed)));
    assert.deepEqual([first.invoiceNumber, first.replayed], ["INV-00001", false]);
    const retry = JSON.parse(sql(issue(invoiceId, "key-00000001", 2, claimed)));
    assert.deepEqual([retry.invoiceNumber, retry.replayed], ["INV-00001", true]);
    assert.equal(sql("select next_invoice_number from invoice_settings"), "2");
    // A different key on an already-issued invoice is refused, not renumbered.
    assert.throws(() => sql(issue(invoiceId, "key-00000002", 3, claimed)), /invoice_not_draft/);
    assert.equal(sql(`select invoice_number from invoices where id='${invoiceId}'`), "INV-00001");

    // Snapshot content and TS/SQL agreement on the money.
    const snap = JSON.parse(snapshotOf(invoiceId));
    assert.equal(snap.title, "Tax invoice");
    assert.equal(snap.totals.totalCents, 71100);
    assert.equal(snap.totals.gstCents, 6464); // 71100 / 11 = 6463.63 -> 6464
    assert.equal(snap.totals.subtotalCents, 64636);
    assert.equal(snap.totals.paidCents, 10000);
    assert.equal(snap.totals.balanceDueCents, 61100);
    assert.equal(snap.seller.abn, "51824753556");
    assert.equal(snap.lines.length, 2);
    assert.equal(sql(`select count(*) from booking_events where booking_id='${uuid(1)}' and event='invoice_issued'`), "1");

    // ---- immutability: later edits can't change an issued invoice ----
    const frozen = snapshotOf(invoiceId);
    sql(`update bookings set subtotal_cents = 99999, final_total_cents = 99999, pricing_snapshot = '{"ratePer30MinCents":1}' where id='${uuid(1)}'`);
    sql(`update customers set name = 'Renamed Customer' where id='a0000000-0000-4000-8000-000000000001'`);
    assert.equal(snapshotOf(invoiceId), frozen, "booking/customer edits must not alter the issued snapshot");
    for (const statement of [
      `update invoices set total_cents = 1 where id='${invoiceId}'`,
      `update invoices set snapshot = '{}' where id='${invoiceId}'`,
      `update invoices set invoice_number = 'INV-99999' where id='${invoiceId}'`,
      `delete from invoices where id='${invoiceId}'`,
      `update invoice_lines set unit_price_cents = 1 where invoice_id='${invoiceId}'`,
      `delete from invoice_lines where invoice_id='${invoiceId}'`,
      `insert into invoice_lines(invoice_id, position, kind, description, quantity_milli, unit_price_cents) values ('${invoiceId}', 9, 'other', 'x', 1000, 1)`,
    ]) assert.throws(() => sql(statement), /invoice_immutable/, statement);
    assert.throws(() => sql(`select public.save_invoice_draft('${invoiceId}', 3, 'owner', ${j({ notes: "late edit" })})`), /invoice_not_draft/);

    // ---- payments after issue: separate, retry-safe, bounded, reversible ----
    const pay = (amount, key) => `select public.record_invoice_payment('${invoiceId}','payment',${amount},'2026-11-18','Bank transfer','TX-1',null,'${key}','owner')`;
    const paid = JSON.parse(sql(pay(20000, "pay-key-0001")));
    assert.equal(paid.balanceDueCents, 41100);
    const replay = JSON.parse(sql(pay(20000, "pay-key-0001")));
    assert.deepEqual([replay.replayed, replay.balanceDueCents], [true, 41100]);
    assert.equal(sql(`select count(*) from invoice_payments where invoice_id='${invoiceId}' and kind='payment'`), "1");
    assert.throws(() => sql(pay(999999, "pay-key-0002")), /payment_exceeds_balance/);
    assert.equal(JSON.parse(snapshotOf(invoiceId)).totals.paidCents, 10000, "snapshot stays as at issue");
    const paymentId = sql(`select id from invoice_payments where invoice_id='${invoiceId}' and kind='payment'`);
    assert.throws(() => sql(`update invoice_payments set amount_cents = 1 where id='${paymentId}'`), /invoice_immutable/);
    assert.throws(() => sql(`delete from invoice_payments where id='${paymentId}'`), /invoice_immutable/);
    assert.throws(() => sql(`select public.record_invoice_payment('${invoiceId}','reversal',500,'2026-11-18',null,null,'${paymentId}','rev-key-0001','owner')`), /reversal_amount_mismatch/);
    const reversal = JSON.parse(sql(`select public.record_invoice_payment('${invoiceId}','reversal',20000,'2026-11-19','Keyed in error',null,'${paymentId}','rev-key-0002','owner')`));
    assert.equal(reversal.balanceDueCents, 61100);

    // ---- void and reissue: audited, number never reused, history preserved ----
    assert.throws(() => sql(`select public.void_invoice('${invoiceId}', ' ', true, 'owner')`), /void_reason_required/);
    const voided = JSON.parse(sql(`select public.void_invoice('${invoiceId}', 'Wrong call-out hours', true, 'owner')`));
    assert.equal(sql(`select status || ':' || void_reason from invoices where id='${invoiceId}'`), "void:Wrong call-out hours");
    assert.equal(sql(`select invoice_number from invoices where id='${invoiceId}'`), "INV-00001");
    assert.equal(sql(`select replaces_invoice_id from invoices where id='${voided.newDraftId}'`), invoiceId);
    assert.equal(sql(`select count(*) from invoice_payments where invoice_id='${voided.newDraftId}' and amount_cents=10000`), "1");
    assert.equal(sql(`select count(*) from invoice_payments where invoice_id='${voided.newDraftId}'`), "1", "reversed payment is not carried over");
    assert.throws(() => sql(`update invoices set status='issued' where id='${invoiceId}'`), /invoice_immutable/);
    assert.throws(() => sql(`select public.void_invoice('${invoiceId}', 'again', false, 'owner')`), /invoice_not_issued/);
    assert.equal(sql(`select count(*) from invoice_events where invoice_id='${invoiceId}' and event='invoice_voided'`), "1");
    sql(`select public.save_invoice_draft('${voided.newDraftId}', 1, 'owner', ${j({ lines: [
      { kind: "service", description: "Removal service", quantityMilli: 3500, unitPriceCents: 15800 },
      { kind: "call_out", description: "Call-out", quantityMilli: 1000, unitPriceCents: 15800 },
      { kind: "discount", description: "Goodwill discount", quantityMilli: 1000, unitPriceCents: 3300 },
    ] })})`);
    const reissued = JSON.parse(sql(`select public.issue_invoice('${voided.newDraftId}','key-reissue-1',2,'{}'::jsonb,'owner')`));
    assert.equal(reissued.invoiceNumber, "INV-00002");
    // 55300 + 15800 - 3300 = 67800 incl GST -> GST 6164 (67800/11 = 6163.6)
    assert.equal(sql(`select total_cents || ',' || gst_cents || ',' || subtotal_cents from invoices where id='${voided.newDraftId}'`), "67800,6164,61636");
    // One live invoice per booking: a duplicate draft for an invoiced booking returns the live one.
    const dupe = JSON.parse(sql(`select public.create_invoice_draft('${uuid(1)}', 'owner', ${j(draft)})`));
    assert.deepEqual([dupe.created, dupe.id], [false, voided.newDraftId]);

    // ---- concurrency: parallel issues get distinct, gapless numbers; same-key races collapse ----
    for (const [n, booking] of [[3, uuid(3)], [4, uuid(4)]]) {
      const lines = [{ kind: "service", description: "Fixed-price move", quantityMilli: 1000, unitPriceCents: 20000 * (n - 2) }];
      sql(`select public.create_invoice_draft('${booking}', 'owner', ${j({ pricingMode: "fixed", pricingSource: "recorded_total", amountsIncludeGst: true, customer: { name: "Sample" }, bookingReference: `HF-${n}`, serviceDate: "2026-11-01", lines, payments: [] })})`);
    }
    const ids = sql(`select id from invoices where booking_id in ('${uuid(3)}','${uuid(4)}') order by booking_id`).split("\n");
    const results = await Promise.all([
      sqlAsync(issue(ids[0], "race-key-A001", 1, null)), sqlAsync(issue(ids[0], "race-key-A001", 1, null)),
      sqlAsync(issue(ids[1], "race-key-B001", 1, null)), sqlAsync(issue(ids[1], "race-key-B001", 1, null)),
    ]);
    const numbers = results.map((r) => JSON.parse(r).invoiceNumber);
    assert.equal(numbers[0], numbers[1]);
    assert.equal(numbers[2], numbers[3]);
    assert.deepEqual([numbers[0], numbers[2]].sort(), ["INV-00003", "INV-00004"]);
    assert.equal(sql("select next_invoice_number from invoice_settings"), "5");
    assert.equal(sql("select count(distinct invoice_number) || '/' || count(*) from invoices where status <> 'draft'"), "4/4");

    // The counter can never move backwards (which would re-issue a number).
    assert.throws(() => sql("update invoice_settings set next_invoice_number = 1"), /invoice_counter_cannot_decrease/);

    // ---- privileges: owner-only service role, nothing for anon/authenticated ----
    for (const role of ["anon", "authenticated"]) {
      for (const fn of ["issue_invoice(uuid,text,integer,jsonb,text)", "void_invoice(uuid,text,boolean,text)", "create_invoice_draft(uuid,text,jsonb)", "record_invoice_payment(uuid,text,integer,date,text,text,uuid,text,text)"]) {
        assert.equal(sql(`select has_function_privilege('${role}','public.${fn}','execute')`), "f", `${role} ${fn}`);
      }
      for (const table of ["invoices", "invoice_lines", "invoice_payments", "invoice_events", "invoice_settings"]) {
        assert.equal(sql(`select has_table_privilege('${role}','public.${table}','select')`), "f", `${role} ${table}`);
      }
    }
    assert.equal(sql("select has_function_privilege('service_role','public.issue_invoice(uuid,text,integer,jsonb,text)','execute')"), "t");
    assert.equal(sql("select relrowsecurity from pg_class where relname='invoices'"), "t");
    void bookingRow;
  });
});

test("SQL invoice totals match the TypeScript calculation for 150 generated invoices", { timeout: 180000 }, async (t) => {
  if (!postgresAvailable()) { t.skip("Local PostgreSQL binaries unavailable"); return; }
  await withMigratedPostgres({ upTo: "0019" }, async ({ sql }) => {
    sql(`insert into customers (id, name, email) values ('a0000000-0000-4000-8000-000000000001','S','s@example.invalid');
      insert into bookings (id, booking_number, customer_id, starts_at, ends_at, estimated_duration_minutes, crew_size, booking_status)
      values ('${uuid(1)}','HF-9','a0000000-0000-4000-8000-000000000001','2026-11-01 00:00:00+00','2026-11-01 03:00:00+00',180,2,'completed')`);
    let seed = 12345;
    const rand = (max) => { seed = (seed * 1664525 + 1013904223) % 4294967296; return Math.floor((seed / 4294967296) * max); };
    for (let n = 0; n < 150; n += 1) {
      const lines = Array.from({ length: 1 + rand(4) }, () => ({
        kind: ["service", "call_out", "travel", "packing", "surcharge", "discount", "other"][rand(7)],
        description: "Line", quantityMilli: 1 + rand(20000), unitPriceCents: rand(50000),
      }));
      const gst = rand(3) !== 0;
      const includes = rand(2) === 0;
      const expected = computeInvoiceTotals({ lines, gstRegistered: gst, amountsIncludeGst: includes });
      sql(`delete from invoices; insert into invoices (id, booking_id, pricing_mode, pricing_source, amounts_include_gst, booking_reference, service_date)
        values ('${uuid(99)}','${uuid(1)}','fixed','none',${includes},'HF-9','2026-11-01');
        insert into invoice_lines (invoice_id, position, kind, description, quantity_milli, unit_price_cents)
        values ${lines.map((l, i) => `('${uuid(99)}',${i},'${l.kind}','Line',${l.quantityMilli},${l.unitPriceCents})`).join(",")}`);
      const actual = JSON.parse(sql(`select public.invoice_totals('${uuid(99)}', ${gst})`));
      assert.deepEqual(actual, expected, JSON.stringify({ lines, gst, includes }));
    }
  });
});
