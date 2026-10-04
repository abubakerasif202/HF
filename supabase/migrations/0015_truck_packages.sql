-- Truck packages: HR (16t) / MR (12t) / Small (8t), all with a 2-man crew.
--
-- Until now pricing_rules was keyed on crew_size, which cannot tell the three
-- truck options apart (they all have crew_size = 2 but different rates). This
-- migration keys pricing on a stable package_id instead and records which
-- package/truck a booking was made for so vehicle allocation can respect it.
--
-- Backwards compatible:
--   * existing rows keep their rates and are tagged '2-men' / '3-men'
--     (the retired 2-mover package stays so historical/in-flight bookings that
--     have no package_id still resolve a rate; the app never offers it);
--   * bookings.package_id / truck_class are nullable — historical bookings stay
--     null and keep pricing from their own frozen pricing_snapshot;
--   * create_booking_hold keeps working for callers that don't pass the new
--     arguments (they default to null).
--
-- The rates below must match lib/site-data.ts `truckPackages`
-- (tests/pricing-source.test.mjs keeps the two in step).

alter table pricing_rules add column if not exists package_id text;
alter table pricing_rules add column if not exists truck_class text;
alter table pricing_rules add column if not exists tonnage integer;

alter table pricing_rules drop constraint if exists pricing_rules_truck_class_check;
alter table pricing_rules
  add constraint pricing_rules_truck_class_check check (truck_class is null or truck_class in ('HR', 'MR', 'Small'));

update pricing_rules set package_id = '2-men' where package_id is null and crew_size = 2;
update pricing_rules set package_id = '3-men' where package_id is null and crew_size = 3;
-- Any other legacy crew size keeps a deterministic id so the NOT NULL below holds.
update pricing_rules set package_id = crew_size::text || '-men' where package_id is null;

alter table pricing_rules alter column package_id set not null;

-- Several packages now share a crew size, so crew_size can no longer be unique.
alter table pricing_rules drop constraint if exists pricing_rules_crew_size_key;
alter table pricing_rules
  add constraint pricing_rules_package_id_key unique (package_id);

insert into pricing_rules (package_id, truck_class, tonnage, crew_size, rate_per_30_min_cents, minimum_billable_minutes) values
  ('hr-16t-2men',   'HR',    16, 2, 7900, 60),
  ('mr-12t-2men',   'MR',    12, 2, 7400, 60),
  ('small-8t-2men', 'Small',  8, 2, 6900, 60)
on conflict (package_id) do nothing;

comment on column pricing_rules.package_id is 'Stable package identity (lib/site-data.ts). The pricing key — crew_size is NOT unique any more.';

-- ---------------------------------------------------------------------------
-- bookings: remember the package / truck class that was booked.
-- ---------------------------------------------------------------------------

alter table bookings add column if not exists package_id text;
alter table bookings add column if not exists truck_class text;

alter table bookings drop constraint if exists bookings_truck_class_check;
alter table bookings
  add constraint bookings_truck_class_check check (truck_class is null or truck_class in ('HR', 'MR', 'Small'));

-- ---------------------------------------------------------------------------
-- create_booking_hold: also store package_id / truck_class. The two new
-- parameters are last and default to null so older callers still work.
-- The old 13-argument signature is dropped to avoid an ambiguous overload.
-- ---------------------------------------------------------------------------

drop function if exists create_booking_hold(text, uuid, uuid, timestamptz, timestamptz, integer, integer, uuid, jsonb, jsonb, jsonb, text, integer);

create or replace function create_booking_hold(
  p_booking_number text,
  p_customer_id uuid,
  p_service_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_estimated_duration_minutes integer,
  p_crew_size integer,
  p_vehicle_id uuid,
  p_pickup_address jsonb,
  p_destination_address jsonb,
  p_move_details jsonb,
  p_customer_notes text,
  p_hold_minutes integer,
  p_package_id text default null,
  p_truck_class text default null
)
returns bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  result bookings;
begin
  perform expire_stale_holds();

  insert into bookings (
    booking_number, customer_id, service_id, starts_at, ends_at,
    estimated_duration_minutes, crew_size, vehicle_id,
    pickup_address, destination_address, move_details, customer_notes,
    booking_status, hold_expires_at, package_id, truck_class
  ) values (
    p_booking_number, p_customer_id, p_service_id, p_starts_at, p_ends_at,
    p_estimated_duration_minutes, p_crew_size, p_vehicle_id,
    p_pickup_address, p_destination_address, p_move_details, p_customer_notes,
    'held', now() + make_interval(mins => p_hold_minutes), p_package_id, p_truck_class
  )
  returning * into result;

  insert into booking_events (booking_id, event, actor, metadata)
  values (result.id, 'hold_created', 'system', jsonb_build_object('vehicle_id', p_vehicle_id, 'package_id', p_package_id, 'truck_class', p_truck_class));

  return result;
exception
  when exclusion_violation then
    raise exception 'slot_unavailable' using errcode = '23P01';
end;
$$;

revoke execute on function create_booking_hold(text, uuid, uuid, timestamptz, timestamptz, integer, integer, uuid, jsonb, jsonb, jsonb, text, integer, text, text) from public, anon, authenticated;
grant execute on function create_booking_hold(text, uuid, uuid, timestamptz, timestamptz, integer, integer, uuid, jsonb, jsonb, jsonb, text, integer, text, text) to service_role;
