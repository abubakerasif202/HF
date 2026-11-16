-- Fail safely rather than holding up production booking traffic indefinitely.
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Dispatch metadata remains separate from the booking price calculation.
-- Existing bookings are left unchanged; unknown values stay NULL.
alter table public.bookings
  add column if not exists dispatch_truck_count integer,
  add column if not exists dispatch_additional_vehicle_ids uuid[] not null default '{}',
  add column if not exists dispatch_travel_minutes integer,
  add column if not exists dispatch_overnight boolean,
  add column if not exists dispatch_truck_left_onsite boolean,
  add column if not exists dispatch_pricing_type text,
  add column if not exists dispatch_fixed_price_cents integer,
  add column if not exists dispatch_customer_requirements jsonb not null default '[]'::jsonb,
  add column if not exists dispatch_checklist jsonb not null default '[]'::jsonb;

alter table public.bookings
  add constraint bookings_dispatch_truck_count_check
    check (dispatch_truck_count is null or dispatch_truck_count between 1 and 4),
  add constraint bookings_dispatch_travel_minutes_check
    check (dispatch_travel_minutes is null or dispatch_travel_minutes between 0 and 1440),
  add constraint bookings_dispatch_pricing_type_check
    check (dispatch_pricing_type is null or dispatch_pricing_type in ('fixed', 'hourly')),
  add constraint bookings_dispatch_fixed_price_check
    check (dispatch_fixed_price_cents is null or dispatch_fixed_price_cents >= 0);

comment on column public.bookings.dispatch_truck_count is 'Dispatch truck requirement; NULL means not recorded.';
comment on column public.bookings.dispatch_additional_vehicle_ids is 'Additional assigned trucks beyond bookings.vehicle_id.';
comment on column public.bookings.dispatch_travel_minutes is 'Recorded travel time in minutes; not included in job duration or pricing.';
comment on column public.bookings.dispatch_pricing_type is 'Operational pricing label only; does not change the frozen booking quote.';

-- All assigned trucks, including the legacy primary vehicle_id, participate
-- in one exclusion constraint so extra trucks cannot be double-booked.
create table if not exists public.booking_vehicle_reservations (
  booking_id uuid not null references public.bookings (id) on delete cascade,
  vehicle_id uuid not null references public.vehicles (id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  active boolean not null,
  primary key (booking_id, vehicle_id),
  constraint booking_vehicle_reservations_range_check check (ends_at > starts_at),
  constraint booking_vehicle_reservations_no_overlap
    exclude using gist (vehicle_id with =, tstzrange(starts_at, ends_at, '[)') with &&)
    where (active)
);

alter table public.booking_vehicle_reservations enable row level security;
create policy booking_vehicle_reservations_owner_all on public.booking_vehicle_reservations
  for all using (internal.is_staff()) with check (internal.is_staff());
revoke all on public.booking_vehicle_reservations from anon, authenticated;
grant all on public.booking_vehicle_reservations to service_role;

create or replace function public.sync_booking_vehicle_reservations()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  vehicle uuid;
  reservation_active boolean;
begin
  if tg_op = 'DELETE' then
    delete from public.booking_vehicle_reservations where booking_id = old.id;
    return old;
  end if;

  delete from public.booking_vehicle_reservations where booking_id = new.id;
  reservation_active := new.booking_status in ('held', 'pending_payment', 'confirmed', 'assigned', 'in_progress');

  if new.vehicle_id is not null then
    insert into public.booking_vehicle_reservations (booking_id, vehicle_id, starts_at, ends_at, active)
    values (new.id, new.vehicle_id, new.starts_at, new.ends_at, reservation_active);
  end if;

  foreach vehicle in array new.dispatch_additional_vehicle_ids loop
    if vehicle is null or vehicle = new.vehicle_id then
      raise exception 'invalid_additional_vehicle_assignment' using errcode = '23514';
    end if;
    insert into public.booking_vehicle_reservations (booking_id, vehicle_id, starts_at, ends_at, active)
    values (new.id, vehicle, new.starts_at, new.ends_at, reservation_active);
  end loop;
  return new;
end;
$$;

revoke all on function public.sync_booking_vehicle_reservations() from public, anon, authenticated;
create trigger bookings_sync_vehicle_reservations
  after insert or update of vehicle_id, dispatch_additional_vehicle_ids, starts_at, ends_at, booking_status or delete
  on public.bookings
  for each row execute function public.sync_booking_vehicle_reservations();

-- Backfill all current primary vehicle assignments through the same checks.
insert into public.booking_vehicle_reservations (booking_id, vehicle_id, starts_at, ends_at, active)
select id, vehicle_id, starts_at, ends_at, booking_status in ('held', 'pending_payment', 'confirmed', 'assigned', 'in_progress')
from public.bookings
where vehicle_id is not null
on conflict (booking_id, vehicle_id) do nothing;

-- Events copied from Google are separate from HF-authored bookings. This
-- prevents import/export loops and leaves unknown customer/job fields blank.
create table if not exists public.google_calendar_imports (
  id uuid primary key default gen_random_uuid(),
  calendar_id text not null,
  event_id text not null,
  summary text,
  starts_at timestamptz,
  ends_at timestamptz,
  all_day_start date,
  all_day_end date,
  location text,
  event_status text not null check (event_status in ('confirmed', 'tentative', 'cancelled')),
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (calendar_id, event_id),
  constraint google_calendar_imports_range_check
    check ((starts_at is null and ends_at is null) or (starts_at is not null and ends_at > starts_at)),
  constraint google_calendar_imports_all_day_check
    check ((all_day_start is null and all_day_end is null) or (all_day_start is not null and all_day_end > all_day_start))
);

alter table public.google_calendar_imports enable row level security;
create policy google_calendar_imports_owner_all on public.google_calendar_imports
  for all using (internal.is_staff()) with check (internal.is_staff());
revoke all on public.google_calendar_imports from anon, authenticated;
grant all on public.google_calendar_imports to service_role;

-- Provision the two named subcontractor crew slots without touching existing
-- crews or any booking assignments. This is safe to re-run.
insert into public.crews (name)
select names.name
from (values ('QASim SUBY'), ('Mubashir Sabi')) as names(name)
where not exists (
  select 1 from public.crews existing where lower(existing.name) = lower(names.name)
);

-- Lock and merge a dispatch update before validating or recording its history.
-- Invoker rights plus an explicit grant keep this endpoint service-role-only.
create or replace function public.update_dispatch_booking(p_booking_id uuid, p_patch jsonb, p_actor text)
returns boolean
language plpgsql
set search_path = public, pg_temp
as $$
declare
  prior public.bookings;
  merged public.bookings;
  allowed text[] := array['crew_id','vehicle_id','dispatch_additional_vehicle_ids','dispatch_truck_count',
    'dispatch_travel_minutes','dispatch_overnight','dispatch_truck_left_onsite','dispatch_pricing_type',
    'dispatch_fixed_price_cents','dispatch_customer_requirements','dispatch_checklist','customer_notes',
    'internal_notes','starts_at','ends_at','estimated_duration_minutes'];
  column_name text;
  assignments text := '';
  old_vehicles uuid[];
  new_vehicles uuid[];
begin
  if jsonb_typeof(p_patch) is distinct from 'object' or p_patch = '{}'::jsonb
    or exists (select 1 from jsonb_object_keys(p_patch) as k where not k = any(allowed)) then
    raise exception 'invalid_dispatch_patch' using errcode = '23514';
  end if;
  select * into prior from public.bookings where id = p_booking_id for update;
  if not found then return false; end if;
  merged := jsonb_populate_record(prior, p_patch);
  if merged.dispatch_truck_count is not null and
    (case when merged.vehicle_id is null then 0 else 1 end + cardinality(merged.dispatch_additional_vehicle_ids)) > merged.dispatch_truck_count then
    raise exception 'assigned_trucks_exceed_requirement' using errcode = '23514';
  end if;
  foreach column_name in array allowed loop
    if p_patch ? column_name then
      assignments := assignments || case when assignments = '' then '' else ', ' end || format('%I = r.%I', column_name, column_name);
    end if;
  end loop;
  execute 'update public.bookings b set ' || assignments ||
    ' from jsonb_populate_record(null::public.bookings, $1) r where b.id = $2'
    using to_jsonb(merged), p_booking_id;
  if prior.starts_at is distinct from merged.starts_at or prior.ends_at is distinct from merged.ends_at then
    insert into public.booking_events(booking_id,event,actor,metadata)
    values(p_booking_id,'rescheduled',p_actor,jsonb_build_object('from',jsonb_build_object('starts_at',prior.starts_at,'ends_at',prior.ends_at),
      'to',jsonb_build_object('starts_at',merged.starts_at,'ends_at',merged.ends_at)));
  end if;
  if prior.crew_id is distinct from merged.crew_id then
    insert into public.booking_events(booking_id,event,actor,metadata)
    values(p_booking_id,'crew_assigned',p_actor,jsonb_build_object('from',prior.crew_id,'to',merged.crew_id));
  end if;
  select coalesce(array_agg(v order by v), '{}') into old_vehicles
    from unnest(array_remove(array[prior.vehicle_id] || prior.dispatch_additional_vehicle_ids, null)) v;
  select coalesce(array_agg(v order by v), '{}') into new_vehicles
    from unnest(array_remove(array[merged.vehicle_id] || merged.dispatch_additional_vehicle_ids, null)) v;
  if old_vehicles is distinct from new_vehicles then
    insert into public.booking_events(booking_id,event,actor,metadata)
    values(p_booking_id,'vehicle_assignment_changed',p_actor,jsonb_build_object('from',old_vehicles,'to',new_vehicles));
  end if;
  return true;
end;
$$;
revoke all on function public.update_dispatch_booking(uuid,jsonb,text) from public, anon, authenticated;
grant execute on function public.update_dispatch_booking(uuid,jsonb,text) to service_role;

-- Serialize batch persistence and reject older runs that finish after newer ones.
create or replace function public.apply_google_calendar_import_batch(p_calendar_id text, p_started_at timestamptz, p_events jsonb)
returns integer
language plpgsql
set search_path = public, pg_temp
as $$
declare affected integer;
begin
  if p_calendar_id is null or p_started_at is null or jsonb_typeof(p_events) is distinct from 'array' then
    raise exception 'invalid_calendar_import_batch' using errcode = '23514';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_calendar_id, 0));
  insert into public.google_calendar_imports(calendar_id,event_id,summary,starts_at,ends_at,all_day_start,all_day_end,location,event_status,synced_at)
  select p_calendar_id, e.event_id, e.summary, e.starts_at, e.ends_at, e.all_day_start, e.all_day_end, e.location, e.event_status, p_started_at
  from jsonb_to_recordset(p_events) as e(event_id text,summary text,starts_at timestamptz,ends_at timestamptz,all_day_start date,all_day_end date,location text,event_status text)
  on conflict(calendar_id,event_id) do update set summary=excluded.summary, starts_at=excluded.starts_at,
    ends_at=excluded.ends_at, all_day_start=excluded.all_day_start, all_day_end=excluded.all_day_end,
    location=excluded.location,event_status=excluded.event_status,synced_at=excluded.synced_at
  where public.google_calendar_imports.synced_at <= excluded.synced_at;
  get diagnostics affected = row_count;
  return affected;
end;
$$;
revoke all on function public.apply_google_calendar_import_batch(text,timestamptz,jsonb) from public, anon, authenticated;
grant execute on function public.apply_google_calendar_import_batch(text,timestamptz,jsonb) to service_role;
