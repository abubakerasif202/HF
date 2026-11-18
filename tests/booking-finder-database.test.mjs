import assert from "node:assert/strict";
import test from "node:test";
import { buildFinderArgs } from "../lib/booking-finder.ts";
import { postgresAvailable, withMigratedPostgres } from "./helpers/postgres.mjs";

// Real isolated PostgreSQL with the REAL migration chain (0001-0019); never the app database.
const quote = (value) => (value === null || value === undefined ? "null" : `'${String(value).replaceAll("'", "''")}'`);

function searchSql(args) {
  const tokens = `array[${args.p_tokens.map(quote).join(",")}]::text[]`;
  return `select booking_number, match_rank, total_count from public.admin_search_bookings(
    p_tokens => ${tokens}, p_reference => ${quote(args.p_reference)}, p_phone => ${quote(args.p_phone)},
    p_from => ${quote(args.p_from)}::timestamptz, p_to => ${quote(args.p_to)}::timestamptz, p_status => ${quote(args.p_status)},
    p_crew_id => ${quote(args.p_crew_id)}::uuid, p_vehicle_id => ${quote(args.p_vehicle_id)}::uuid,
    p_limit => ${args.p_limit}, p_offset => ${args.p_offset})`;
}

const SEED = `
  insert into crews (id, name) values ('c0000000-0000-4000-8000-00000000000a','Crew A'),('c0000000-0000-4000-8000-00000000000b','Crew B');
  insert into vehicles (id, name) values ('d0000000-0000-4000-8000-000000000001','Truck 1'),('d0000000-0000-4000-8000-000000000002','Truck 2');
  insert into customers (id, name, email, phone) values
    ('a0000000-0000-4000-8000-000000000001','Sample Customer 01','sample01@example.invalid','0491 704 136'),
    ('a0000000-0000-4000-8000-000000000002','Sample Customer 02','sample02@example.invalid','+61 412 345 678'),
    ('a0000000-0000-4000-8000-000000000003','Sample Customer 03','sample03@example.invalid',null);
  -- Legacy-shaped: no pricing_snapshot, historical $100 deposit, string addresses, null phone.
  insert into bookings (id, booking_number, customer_id, starts_at, ends_at, estimated_duration_minutes, crew_size, vehicle_id, crew_id,
      pickup_address, destination_address, booking_status, deposit_paid_cents, subtotal_cents, balance_due_cents) values
    ('b0000000-0000-4000-8000-000000000001','HF-2025-00001','a0000000-0000-4000-8000-000000000001','2025-06-09 23:30:00+00','2025-06-10 03:30:00+00',240,2,
      'd0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-00000000000a',
      '{"suburb":"Salisbury","addressLine":"12 Example St","formattedAddress":"12 Example St, Salisbury SA 5108"}','{"suburb":"Glenelg"}','completed',10000,45000,35000),
    ('b0000000-0000-4000-8000-000000000002','HF-2026-00042','a0000000-0000-4000-8000-000000000002','2026-11-19 22:00:00+00','2026-11-20 02:00:00+00',240,2,
      'd0000000-0000-4000-8000-000000000002',null,
      '"Unit 4, 9 Test Rd, Norwood SA 5067"',null,'confirmed',0,0,0),
    ('b0000000-0000-4000-8000-000000000003','HF-2026-00043','a0000000-0000-4000-8000-000000000003','2026-11-21 22:00:00+00','2026-11-22 01:00:00+00',180,3,
      null,'c0000000-0000-4000-8000-00000000000b','{"suburb":"Salisbury"}','{"suburb":"Gawler"}','pending_payment',0,0,0),
    ('b0000000-0000-4000-8000-000000000004','HF-2026-00044','a0000000-0000-4000-8000-000000000001','2026-12-01 00:00:00+00','2026-12-01 03:00:00+00',180,2,
      null,null,'{"suburb":"Marion"}','{"suburb":"Salisbury"}','cancelled',0,0,0);
  update bookings set dispatch_additional_vehicle_ids = array['d0000000-0000-4000-8000-000000000001']::uuid[] where booking_number = 'HF-2026-00043';
`;

test("finder migration is additive and the search ranks, filters and paginates legacy bookings", { timeout: 120000 }, async (t) => {
  if (!postgresAvailable()) { t.skip("Local PostgreSQL binaries unavailable"); return; }
  await withMigratedPostgres({ upTo: "0018" }, async ({ sql, applyFile }) => {
    sql(SEED);
    const fingerprint = () => sql("select md5(string_agg(b::text, '|' order by id)) from bookings b");
    const before = fingerprint();
    applyFile("0019_booking_finder_and_invoicing.sql");
    assert.equal(fingerprint(), before, "migration must not rewrite any existing booking");
    assert.equal(sql("select count(*) from bookings"), "4");

    const tz = "Australia/Adelaide";
    const run = (filters) => {
      const built = buildFinderArgs(filters, tz);
      assert.equal(built.ok, true, JSON.stringify(built));
      return sql(searchSql(built.args)).split("\n").filter(Boolean).map((line) => line.split("|"));
    };

    // Exact reference first (rank 0), with or without punctuation, any case.
    assert.deepEqual(run({ q: "hf-2026-00042" })[0].slice(0, 2), ["HF-2026-00042", "0"]);
    assert.equal(run({ q: "HF202600042" })[0][0], "HF-2026-00042");
    // Partial reference matches both 2026 bookings but ranks nothing exact.
    assert.deepEqual(run({ q: "2026-0004" }).map((row) => row[0]).sort(), ["HF-2026-00042", "HF-2026-00043", "HF-2026-00044"]);

    // AU mobile numbers: local, spaced, +61 and bare 61 all find the same booking at rank 1.
    for (const q of ["0491 704 136", "0491704136", "+61 491 704 136", "61491704136", "+61412345678"]) {
      const rows = run({ q });
      assert.equal(rows[0][1], "1", `exact phone rank for ${q}`);
      assert.equal(rows[0][0], q.includes("412") ? "HF-2026-00042" : rows[0][0]);
    }
    assert.deepEqual(run({ q: "0491 704 136" }).map((row) => row[0]).sort(), ["HF-2025-00001", "HF-2026-00044"]);
    // Partial phone and a customer with no phone at all (null-safe).
    assert.deepEqual(run({ q: "+61 412 345" }).map((row) => row[0]), ["HF-2026-00042"]);
    assert.equal(run({ q: "sample03" }).length, 1);

    // Name, email, suburb, street (formatted and legacy string) with partial and multi-word matches.
    assert.deepEqual(run({ q: "customer 03" }).map((row) => row[0]), ["HF-2026-00043"]);
    assert.deepEqual(run({ q: "sample02@example" }).map((row) => row[0]), ["HF-2026-00042"]);
    assert.equal(run({ q: "sample01@example" }).length, 2);
    assert.deepEqual(run({ q: "salisbury" }).map((row) => row[0]).sort(), ["HF-2025-00001", "HF-2026-00043", "HF-2026-00044"]);
    assert.deepEqual(run({ q: "example st, salisbury" }).map((row) => row[0]), ["HF-2025-00001"]);
    assert.equal(run({ q: "test rd norwood" })[0][0], "HF-2026-00042");
    assert.equal(run({ q: "glenel" })[0][0], "HF-2025-00001");
    assert.equal(run({ q: "no such place" }).length, 0);
    // Wildcard characters are literal (no LIKE injection).
    assert.equal(run({ q: "%" }).length, 0);
    assert.equal(run({ q: "_" }).length, 0);

    // Filters: status, crew, truck (primary and additional), date range (Adelaide days).
    assert.deepEqual(run({ status: "cancelled" }).map((row) => row[0]), ["HF-2026-00044"]);
    assert.deepEqual(run({ crewId: "c0000000-0000-4000-8000-00000000000b" }).map((row) => row[0]), ["HF-2026-00043"]);
    assert.deepEqual(run({ vehicleId: "d0000000-0000-4000-8000-000000000001" }).map((row) => row[0]).sort(), ["HF-2025-00001", "HF-2026-00043"]);
    // HF-2026-00042 starts 2026-11-20 08:30 Adelaide; that local day matches, the previous and next do not.
    assert.deepEqual(run({ from: "2026-11-20", to: "2026-11-20" }).map((row) => row[0]), ["HF-2026-00042"]);
    // HF-2026-00043 starts 2026-11-22 08:30 Adelaide, so the 21st is empty and the 22nd matches.
    assert.equal(run({ from: "2026-11-21", to: "2026-11-21" }).length, 0);
    assert.deepEqual(run({ from: "2026-11-22", to: "2026-11-22" }).map((row) => row[0]), ["HF-2026-00043"]);
    assert.equal(run({ from: "2026-11-23", to: "2026-11-30" }).length, 0);
    // 2025-06-10 09:00 Adelaide (ACST) is 2025-06-09 23:30 UTC: still the 10th locally.
    assert.deepEqual(run({ from: "2025-06-10", to: "2025-06-10" }).map((row) => row[0]), ["HF-2025-00001"]);
    assert.equal(run({ from: "2025-06-09", to: "2025-06-09" }).length, 0);
    // Query + filter combine.
    assert.deepEqual(run({ q: "salisbury", status: "pending_payment" }).map((row) => row[0]), ["HF-2026-00043"]);

    // Pagination: stable order, total_count is the full match count on every page.
    const page1 = run({ pageSize: 3, page: 1 });
    const page2 = run({ pageSize: 3, page: 2 });
    assert.equal(page1.length, 3);
    assert.equal(page2.length, 1);
    assert.equal(page1[0][2], "4");
    assert.equal(page2[0][2], "4");
    assert.equal(new Set([...page1, ...page2].map((row) => row[0])).size, 4);

    // Only the server-side service role may call the search.
    assert.equal(sql("select has_function_privilege('anon','public.admin_search_bookings(text[],text,text,timestamptz,timestamptz,text,uuid,uuid,integer,integer)','execute')"), "f");
    assert.equal(sql("select has_function_privilege('authenticated','public.admin_search_bookings(text[],text,text,timestamptz,timestamptz,text,uuid,uuid,integer,integer)','execute')"), "f");
    assert.equal(sql("select has_function_privilege('service_role','public.admin_search_bookings(text[],text,text,timestamptz,timestamptz,text,uuid,uuid,integer,integer)','execute')"), "t");
  });
});
