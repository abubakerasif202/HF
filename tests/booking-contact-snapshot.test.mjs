import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { applyContactSnapshot, resolveBookingContact } from "../lib/booking/contact.ts";
import { postgresAvailable, withMigratedPostgres } from "./helpers/postgres.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("resolveBookingContact prefers the booking snapshot and falls back to the customer row", () => {
  const customers = { name: "Old Name", email: "pat@example.invalid", phone: "0400 000 000" };
  assert.deepEqual(
    resolveBookingContact({ contact_name: "Pat New", contact_email: "pat@example.invalid", contact_phone: "0411 111 111", customers }),
    { name: "Pat New", email: "pat@example.invalid", phone: "0411 111 111" },
  );
  // Joined rows can arrive as arrays.
  assert.equal(resolveBookingContact({ customers: [customers] })?.phone, "0400 000 000");
  // No snapshot at all (pre-migration row): the customer row is used.
  assert.deepEqual(resolveBookingContact({ contact_name: null, contact_email: null, contact_phone: null, customers }), customers);
  // A snapshot is authoritative as a whole: a blank phone is not replaced by an older number.
  assert.deepEqual(
    resolveBookingContact({ contact_name: "Pat New", contact_email: "pat@example.invalid", contact_phone: "  ", customers }),
    { name: "Pat New", email: "pat@example.invalid", phone: null },
  );
  assert.equal(resolveBookingContact({ customers: null }), null);
  assert.equal(applyContactSnapshot({ id: 1, contact_phone: "0411 111 111", contact_name: "Pat", customers }).customers?.phone, "0411 111 111");
});

test("the hold route stores the submitted contact and never writes to customers", () => {
  const route = read("app/api/booking/hold/route.ts");
  assert.match(route, /contact:\s*\{\s*name:\s*input\.customer\.name,\s*email:\s*normalizedEmail,\s*phone:\s*input\.customer\.phone\s*\}/);
  const repo = read("lib/server/booking-repo.ts");
  const fn = repo.slice(repo.indexOf("export async function findOrCreateCustomer"), repo.indexOf("export async function generateBookingNumber"));
  assert.doesNotMatch(fn, /\.update\(|\.upsert\(/, "a public request must not overwrite an existing customer row");
  assert.match(repo, /p_contact_phone:\s*input\.contact\.phone/);
});

test("every place that shows or uses a booking contact prefers the snapshot", () => {
  const files = [
    "app/admin/(protected)/bookings/page.tsx",
    "app/admin/(protected)/bookings/[id]/page.tsx",
    "app/admin/(protected)/page.tsx",
    "app/admin/(protected)/calendar/page.tsx",
    "app/api/admin/dispatch/route.ts",
    "app/api/admin/dispatch/queues/route.ts",
    "lib/server/google-calendar.ts",
    "lib/server/invoice-repo.ts",
    "lib/server/booking-conflicts.ts",
    "lib/server/booking-repo.ts",
  ];
  for (const file of files) {
    assert.match(read(file), /resolveBookingContact|applyContactSnapshot/, `${file} must resolve the booking contact snapshot`);
  }
  assert.match(read("lib/server/notifications.ts"), /booking\.contact_email/, "the confirmation email goes to the address typed on the booking");
});

const SEED = `
  insert into services (id, slug, name) values ('e0000000-0000-4000-8000-000000000001','removals','Removals');
  insert into vehicles (id, name) values ('d0000000-0000-4000-8000-000000000001','Truck 1');
  insert into customers (id, name, email, phone) values
    ('a0000000-0000-4000-8000-000000000001','Pat Old','pat@example.invalid','0400 000 000');
  insert into bookings (id, booking_number, customer_id, starts_at, ends_at, estimated_duration_minutes, crew_size, booking_status)
    values ('b0000000-0000-4000-8000-000000000001','HF-2026-00001','a0000000-0000-4000-8000-000000000001','2026-12-01 00:00:00+00','2026-12-01 03:00:00+00',180,2,'confirmed');
`;

const HOLD = (number, startsAt, contact) => `
  select (create_booking_hold(
    p_booking_number => '${number}', p_customer_id => 'a0000000-0000-4000-8000-000000000001',
    p_service_id => 'e0000000-0000-4000-8000-000000000001', p_starts_at => '${startsAt}', p_ends_at => '${startsAt}'::timestamptz + interval '3 hours',
    p_estimated_duration_minutes => 180, p_crew_size => 2, p_vehicle_id => 'd0000000-0000-4000-8000-000000000001',
    p_pickup_address => '{}'::jsonb, p_destination_address => '{}'::jsonb, p_move_details => '{}'::jsonb,
    p_customer_notes => null, p_hold_minutes => 15${contact}
  )).id`;

test("an existing customer who books with a new phone gets that phone on the booking; the customer row is unchanged", { timeout: 120000 }, async (t) => {
  if (!postgresAvailable()) { t.skip("Local PostgreSQL binaries unavailable"); return; }
  await withMigratedPostgres({ upTo: "0019" }, async ({ sql, applyFile }) => {
    sql(SEED);
    const customerFingerprint = () => sql("select md5(string_agg(c::text, '|' order by id)) from customers c");
    const before = customerFingerprint();

    applyFile("0020_booking_contact_snapshot.sql");
    // Backfill: existing rows get the contact currently on their customer.
    assert.equal(sql("select contact_name || '|' || contact_phone || '|' || contact_email from bookings where booking_number = 'HF-2026-00001'"), "Pat Old|0400 000 000|pat@example.invalid");

    // Same email, new name and phone (what the public form now submits).
    const id = sql(HOLD("HF-2026-00002", "2026-12-05 00:00:00+00", `,
      p_contact_name => '  Pat New ', p_contact_phone => '0411 111 111', p_contact_email => ' PAT@Example.invalid '`));
    assert.equal(sql(`select contact_name || '|' || contact_phone || '|' || contact_email from bookings where id = '${id.split("\n")[0]}'`), "Pat New|0411 111 111|pat@example.invalid");
    assert.equal(customerFingerprint(), before, "the customers row must not change from a public booking");
    assert.equal(sql("select phone from customers where email = 'pat@example.invalid'"), "0400 000 000");

    // Callers that omit the contact still work (the app falls back to the customer row).
    const legacy = sql(HOLD("HF-2026-00003", "2026-12-09 00:00:00+00", ""));
    assert.ok(legacy);
    assert.equal(sql("select count(*) from bookings where booking_number = 'HF-2026-00003' and contact_phone is null"), "1");

    // Still service_role only.
    assert.equal(sql("select has_function_privilege('service_role', 'create_booking_hold(text,uuid,uuid,timestamptz,timestamptz,integer,integer,uuid,jsonb,jsonb,jsonb,text,integer,text,text,text,text,text)', 'execute')"), "t");
    assert.equal(sql("select has_function_privilege('anon', 'create_booking_hold(text,uuid,uuid,timestamptz,timestamptz,integer,integer,uuid,jsonb,jsonb,jsonb,text,integer,text,text,text,text,text)', 'execute')"), "f");
    assert.equal(sql("select count(*) from pg_proc where proname = 'create_booking_hold'"), "1", "no ambiguous overload");
  });
});
