import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

// Real isolated PostgreSQL; never uses the application's database or credentials.
test("dispatch migration preserves inactive availability and commits assignment history atomically", { timeout: 60000 }, (t) => {
  try { execFileSync("initdb", ["--version"], { stdio: "ignore" }); } catch { t.skip("Local PostgreSQL binaries unavailable"); return; }
  const root = mkdtempSync(join(tmpdir(), "hf-dispatch-pg-"));
  const data = join(root, "data");
  const port = 55439;
  const sql = (query) => execFileSync("psql", ["-h", "127.0.0.1", "-p", String(port), "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-Atc", query], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  let started = false;
  try {
    execFileSync("initdb", ["-D", data, "-U", "postgres", "-A", "trust", "--no-locale", "-E", "UTF8"], { stdio: "ignore" });
    execFileSync("pg_ctl", ["-D", data, "-l", join(root, "server.log"), "-o", `-h 127.0.0.1 -p ${port}`, "-w", "start"], { stdio: "ignore" });
    started = true;
    sql(`create extension btree_gist; create role anon; create role authenticated; create role service_role;
      create schema internal; create function internal.is_staff() returns boolean language sql as 'select false';
      create table public.crews(id uuid primary key default gen_random_uuid(),name text);
      create table public.vehicles(id uuid primary key);
      create table public.bookings(id uuid primary key, vehicle_id uuid references vehicles, crew_id uuid references crews,
        starts_at timestamptz not null, ends_at timestamptz not null, booking_status text not null,
        estimated_duration_minutes integer, customer_notes text, internal_notes text);
      create table public.booking_events(booking_id uuid,event text,actor text,metadata jsonb);
      insert into vehicles values ('00000000-0000-0000-0000-000000000001');
      insert into bookings(id,vehicle_id,starts_at,ends_at,booking_status)
      select ('00000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'00000000-0000-0000-0000-000000000001',
        '2026-11-20 00:00Z'::timestamptz + n*interval '2 hours','2026-11-20 01:00Z'::timestamptz+n*interval '2 hours',status
      from unnest(array['draft','completed','cancelled','expired','held','pending_payment','confirmed','assigned','in_progress']) with ordinality as x(status,n);`);
    sql(readFileSync(new URL("../supabase/migrations/0018_dispatch_google_calendar.sql", import.meta.url), "utf8"));
    assert.equal(sql("select count(*) from booking_vehicle_reservations where active"), "5");
    assert.equal(sql("select count(*) from booking_vehicle_reservations where not active"), "4");
    // Trigger updates must use exactly the same status allowlist as the backfill.
    for (const status of ["draft", "completed", "cancelled", "expired", "held", "pending_payment", "confirmed", "assigned", "in_progress"]) {
      sql(`update bookings set booking_status='${status}' where id='00000000-0000-0000-0000-000000000001'`);
      assert.equal(sql("select active from booking_vehicle_reservations where booking_id='00000000-0000-0000-0000-000000000001'"), ["held", "pending_payment", "confirmed", "assigned", "in_progress"].includes(status) ? "t" : "f");
    }
    sql("update bookings set booking_status='draft' where id='00000000-0000-0000-0000-000000000001'");
    // Additional trucks share the exclusion constraint with primary assignments.
    sql("insert into bookings(id,starts_at,ends_at,booking_status) values('00000000-0000-0000-0000-000000000020','2026-11-20 10:00Z','2026-11-20 11:00Z','confirmed')");
    assert.throws(() => sql(`select update_dispatch_booking('00000000-0000-0000-0000-000000000020','{"dispatch_additional_vehicle_ids":["00000000-0000-0000-0000-000000000001"]}','owner')`));
    assert.equal(sql("select cardinality(dispatch_additional_vehicle_ids) from bookings where id='00000000-0000-0000-0000-000000000020'"), "0");
    const batch = JSON.stringify([{event_id:"external-1",summary:null,starts_at:"2026-11-20T00:00:00Z",ends_at:"2026-11-20T01:00:00Z",event_status:"confirmed"}]);
    sql(`select apply_google_calendar_import_batch('calendar','2026-11-20T02:00:00Z','${batch}')`);
    const cancelled = JSON.stringify([{event_id:"external-1",event_status:"cancelled"}]);
    sql(`select apply_google_calendar_import_batch('calendar','2026-11-20T01:00:00Z','${cancelled}')`);
    assert.equal(sql("select event_status from google_calendar_imports where event_id='external-1'"), "confirmed");
    sql(`select apply_google_calendar_import_batch('calendar','2026-11-20T03:00:00Z','${cancelled}')`);
    assert.equal(sql("select event_status from google_calendar_imports where event_id='external-1'"), "cancelled");
    const id = "00000000-0000-0000-0000-000000000001";
    sql(`select public.update_dispatch_booking('${id}', '{"internal_notes":"checked"}', 'owner')`);
    const crew = sql("select id from crews where name='QASim SUBY'");
    sql(`select public.update_dispatch_booking('${id}', '{"crew_id":"${crew}"}', 'owner')`);
    assert.equal(sql("select count(*) from booking_events where event='crew_assigned'"), "1");
    sql("alter table booking_events add constraint reject_history check (false) not valid");
    assert.throws(() => sql(`select public.update_dispatch_booking('${id}', '{"crew_id":null}', 'owner')`));
    assert.equal(sql(`select crew_id from bookings where id='${id}'`), crew);
    assert.throws(() => sql(`select public.update_dispatch_booking('${id}', '{"booking_status":"confirmed"}', 'owner')`));
    assert.equal(sql(`select booking_status from bookings where id='${id}'`), "draft");
    assert.equal(sql("select has_function_privilege('anon','public.update_dispatch_booking(uuid,jsonb,text)','execute')"), "f");
    assert.equal(sql("select has_function_privilege('service_role','public.update_dispatch_booking(uuid,jsonb,text)','execute')"), "t");
  } finally {
    if (started) execFileSync("pg_ctl", ["-D", data, "-m", "immediate", "-w", "stop"], { stdio: "ignore" });
    rmSync(root, { recursive: true, force: true });
  }
});
