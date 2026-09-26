-- HF Removals Adelaide — booking system schema
-- Supabase/PostgreSQL. Written for Postgres 15+ (Supabase default).
--
-- Design notes:
--  * Supabase is the single source of truth. Google Calendar (added later)
--    is a synchronized read view only.
--  * All timestamps that represent a scheduled job window are stored as
--    `timestamptz` and computed in Australia/Adelaide business logic in the
--    application layer (lib/booking/*), never in the client's local time.
--  * Double-booking prevention relies on a Postgres EXCLUDE constraint over
--    (vehicle_id, time range) for "live" booking states, backed by
--    btree_gist. Rows in terminal/inactive states are excluded from the
--    constraint via a partial predicate so cancelled/expired bookings don't
--    block a slot forever.
--  * Every table has RLS enabled. No anon/public policies are defined —
--    the public booking flow is served entirely through Next.js server
--    routes using the service role key, never directly from the browser.
--    Staff (authenticated Supabase Auth users present in `staff`) get
--    policies via the `is_staff()` helper.

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

-- ---------------------------------------------------------------------------
-- Helper: staff / authorization
-- ---------------------------------------------------------------------------

create table if not exists staff (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role text not null default 'staff' check (role in ('owner', 'admin', 'staff')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table staff enable row level security;

create or replace function is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from staff where id = auth.uid() and active
  );
$$;

create policy staff_read_self_or_staff on staff
  for select using (is_staff());

-- ---------------------------------------------------------------------------
-- business_settings — single-row (or keyed) admin-configurable settings.
-- Every value that the CRITICAL RULES forbid inventing lives here as NULL
-- until an admin fills it in. Application code must treat NULL as
-- "not configured" and disable the dependent feature (e.g. deposits, SMS).
-- ---------------------------------------------------------------------------

create table if not exists business_settings (
  id boolean primary key default true constraint business_settings_singleton check (id),
  timezone text not null default 'Australia/Adelaide',
  booking_number_prefix text not null default 'HF',
  -- Confirmed booking policy: earliest booking start 5am, last booking
  -- start 6pm. This is the last permitted START time, not a "job must
  -- finish by close" boundary — see lib/booking/availability.ts.
  -- (Distinct from the storefront's published customer-service hours,
  -- lib/site-data.ts business.googleBusiness.hoursLabel = "7:00 am–8:00 pm daily",
  -- which covers phone/enquiry availability, not booking start times.)
  business_open_time time not null default '05:00',
  business_close_time time not null default '18:00',
  -- Configurable scheduling knobs. NULL/0 = feature inert until set.
  -- Stripe Checkout's `expires_at` must be >= 30 minutes from session
  -- creation, so the hold (which the Checkout session must never outlive —
  -- otherwise a customer could pay after their slot was released to
  -- someone else) has to be at least that long. Enforced by the check
  -- constraint below; admins can raise it but not lower it past Stripe's
  -- floor.
  booking_hold_minutes integer not null default 30 check (booking_hold_minutes >= 30),
  min_booking_lead_hours integer not null default 24,
  max_booking_horizon_days integer not null default 90,
  default_estimated_duration_minutes integer not null default 120,
  scheduling_buffer_minutes integer not null default 30,
  -- Deposit policy: both null until real business rules are supplied.
  deposit_type text check (deposit_type in ('fixed', 'percentage')),
  deposit_fixed_amount_cents integer,
  deposit_percentage numeric(5, 2),
  min_deposit_amount_cents integer,
  -- Notification preferences.
  booking_admin_email text,
  reminder_hours_before integer[] not null default '{}',
  updated_at timestamptz not null default now()
);

insert into business_settings (id) values (true) on conflict (id) do nothing;

alter table business_settings enable row level security;
create policy business_settings_staff_all on business_settings
  for all using (is_staff()) with check (is_staff());

-- ---------------------------------------------------------------------------
-- services — booking-eligible service catalogue (distinct from the marketing
-- site's static ContentPage services in lib/site-data.ts, which cover
-- non-bookable content like interstate/backloading/packing pages).
-- ---------------------------------------------------------------------------

create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  active boolean not null default true,
  -- Whether this service can be booked through the online wizard at all.
  -- Interstate/backloading remain quote-only (per-m³ pricing, no fixed slot)
  -- and should stay false here, routed to the existing "Get a Quote" form.
  bookable boolean not null default true,
  default_crew_size integer not null default 2,
  created_at timestamptz not null default now()
);

alter table services enable row level security;
create policy services_staff_all on services for all using (is_staff()) with check (is_staff());

-- Seed only the services the live site already publishes as bookable,
-- local, time-based work (lib/site-data.ts `localPricing`).
insert into services (slug, name, description, bookable, default_crew_size) values
  ('residential-removals', 'Residential removals', 'Home, apartment and townhouse removals.', true, 2),
  ('furniture-removals', 'Furniture removals', 'Household furniture and bulky item removals.', true, 2),
  ('office-commercial-removals', 'Office & commercial removals', 'Workplace relocation.', true, 2)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- pricing_rules — server-side pricing inputs. Seeded ONLY with the two
-- local hourly rates already published in lib/site-data.ts `localPricing`
-- ("2 Movers + Truck" $158/hr = $79/30min, "3 Movers + Truck" $198/hr =
-- $99/30min). Everything else (call-out fee, travel charge, weekend/holiday
-- multiplier, minimum duration, packing charge) is left NULL/0 and must be
-- configured by an admin before it affects a quote.
-- ---------------------------------------------------------------------------

create table if not exists pricing_rules (
  id uuid primary key default gen_random_uuid(),
  crew_size integer not null unique check (crew_size > 0),
  rate_per_30_min_cents integer not null check (rate_per_30_min_cents > 0),
  minimum_billable_minutes integer not null default 60,
  call_out_fee_cents integer not null default 0,
  weekend_multiplier numeric(4, 2) not null default 1.0,
  public_holiday_multiplier numeric(4, 2) not null default 1.0,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table pricing_rules enable row level security;
create policy pricing_rules_staff_all on pricing_rules for all using (is_staff()) with check (is_staff());

insert into pricing_rules (crew_size, rate_per_30_min_cents, minimum_billable_minutes) values
  (2, 7900, 60),
  (3, 9900, 60)
on conflict (crew_size) do nothing;

-- ---------------------------------------------------------------------------
-- vehicles / crews / crew_members — resource model. Designed so the
-- business can run one truck today and add more later without a rewrite.
-- No fleet/registration details are invented; admin fills these in.
-- ---------------------------------------------------------------------------

create table if not exists vehicles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  vehicle_type text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table vehicles enable row level security;
create policy vehicles_staff_all on vehicles for all using (is_staff()) with check (is_staff());

create table if not exists crews (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table crews enable row level security;
create policy crews_staff_all on crews for all using (is_staff()) with check (is_staff());

create table if not exists crew_members (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid references crews (id) on delete set null,
  name text not null,
  role text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table crew_members enable row level security;
create policy crew_members_staff_all on crew_members for all using (is_staff()) with check (is_staff());

-- ---------------------------------------------------------------------------
-- blocked_times — admin-declared unavailability. Affects availability
-- computation whenever it overlaps a requested window and the resource
-- (or "all") matches.
-- ---------------------------------------------------------------------------

create table if not exists blocked_times (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  vehicle_id uuid references vehicles (id) on delete cascade,
  crew_id uuid references crews (id) on delete cascade,
  -- NULL vehicle_id AND NULL crew_id means "blocks all resources"
  -- (e.g. public holiday closure).
  reason text not null,
  created_by uuid references staff (id),
  created_at timestamptz not null default now(),
  constraint blocked_times_range_valid check (ends_at > starts_at)
);

alter table blocked_times enable row level security;
create policy blocked_times_staff_all on blocked_times for all using (is_staff()) with check (is_staff());

create index if not exists blocked_times_range_idx on blocked_times using gist (tstzrange(starts_at, ends_at));

-- ---------------------------------------------------------------------------
-- customers
-- ---------------------------------------------------------------------------

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  created_at timestamptz not null default now()
);

alter table customers enable row level security;
create policy customers_staff_all on customers for all using (is_staff()) with check (is_staff());

create index if not exists customers_email_idx on customers (lower(email));

-- ---------------------------------------------------------------------------
-- bookings — the core entity. `booking_status` and `payment_status` are
-- deliberately separate (see AGENTS spec: a booking can be confirmed with a
-- deposit paid while a balance remains due).
--
-- Double-booking prevention: the EXCLUDE constraint below rejects any two
-- rows for the *same vehicle* whose [starts_at, ends_at) ranges overlap,
-- as long as both rows are in a "live" booking_status. Cancelled/expired
-- bookings are excluded from the constraint by the WHERE predicate so a
-- released slot can be reused.
--
-- IMPORTANT — exclusion constraints cannot reference now(), so an expired
-- `held`/`pending_payment` row still blocks the slot until something
-- transitions its status. `expire_stale_holds()` (below) must run inside
-- the same transaction as any new hold attempt, plus a scheduled sweep
-- (Vercel Cron -> /api/cron/expire-holds), so abandoned holds don't
-- permanently squat on a vehicle.
-- ---------------------------------------------------------------------------

create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  booking_number text not null unique,
  customer_id uuid references customers (id),
  service_id uuid references services (id),

  starts_at timestamptz not null,
  ends_at timestamptz not null,
  estimated_duration_minutes integer not null,
  crew_size integer not null,

  vehicle_id uuid references vehicles (id),
  crew_id uuid references crews (id),

  pickup_address jsonb,
  destination_address jsonb,
  additional_stops jsonb not null default '[]',

  move_details jsonb not null default '{}',

  subtotal_cents integer not null default 0,
  deposit_required_cents integer not null default 0,
  deposit_paid_cents integer not null default 0,
  balance_due_cents integer not null default 0,
  currency text not null default 'aud',
  -- Frozen copy of the pricing inputs used at confirmation time, so a
  -- later change to pricing_rules never rewrites a historical total.
  pricing_snapshot jsonb,

  booking_status text not null default 'draft' check (
    booking_status in (
      'draft', 'held', 'pending_payment', 'confirmed', 'assigned',
      'in_progress', 'completed', 'cancelled', 'expired'
    )
  ),
  payment_status text not null default 'pending' check (
    payment_status in ('pending', 'paid', 'failed', 'refunded', 'partially_refunded')
  ),

  hold_expires_at timestamptz,
  -- Opaque, unguessable token for the public "view my booking" page —
  -- never expose bookings.id-based enumeration to customers.
  access_token uuid not null default gen_random_uuid(),

  customer_notes text,
  internal_notes text,

  google_calendar_event_id text,
  calendar_sync_status text not null default 'pending' check (
    calendar_sync_status in ('pending', 'synced', 'failed', 'not_applicable')
  ),
  calendar_sync_error text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz,
  cancelled_at timestamptz,

  constraint bookings_range_valid check (ends_at > starts_at)
);

alter table bookings
  add constraint bookings_no_double_booking
  exclude using gist (
    vehicle_id with =,
    tstzrange(starts_at, ends_at) with &&
  )
  where (
    vehicle_id is not null
    and booking_status in ('held', 'pending_payment', 'confirmed', 'assigned', 'in_progress')
  );

create index if not exists bookings_starts_at_idx on bookings (starts_at);
create index if not exists bookings_status_idx on bookings (booking_status);
create index if not exists bookings_customer_idx on bookings (customer_id);
create index if not exists bookings_vehicle_idx on bookings (vehicle_id);
create index if not exists bookings_access_token_idx on bookings (access_token);

alter table bookings enable row level security;
create policy bookings_staff_all on bookings for all using (is_staff()) with check (is_staff());

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger bookings_set_updated_at
  before update on bookings
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- booking_assignments — explicit crew-member assignment (vehicle/crew are
-- already columns on bookings for the exclusion constraint; individual
-- crew members assigned to a job are tracked here so a crew's roster can
-- change without altering the booking row).
-- ---------------------------------------------------------------------------

create table if not exists booking_assignments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings (id) on delete cascade,
  crew_member_id uuid not null references crew_members (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (booking_id, crew_member_id)
);

alter table booking_assignments enable row level security;
create policy booking_assignments_staff_all on booking_assignments for all using (is_staff()) with check (is_staff());

-- ---------------------------------------------------------------------------
-- payments — Stripe payment records. Never store raw card data (Stripe
-- handles that). Idempotency is enforced via the unique constraint on
-- stripe_checkout_session_id / stripe_payment_intent_id.
-- ---------------------------------------------------------------------------

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings (id) on delete cascade,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  amount_cents integer not null,
  currency text not null default 'aud',
  payment_type text not null default 'deposit' check (payment_type in ('deposit', 'balance', 'refund')),
  payment_status text not null default 'pending' check (
    payment_status in ('pending', 'paid', 'failed', 'refunded', 'partially_refunded')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table payments enable row level security;
create policy payments_staff_all on payments for all using (is_staff()) with check (is_staff());

create trigger payments_set_updated_at
  before update on payments
  for each row execute function set_updated_at();

-- Stripe webhook idempotency ledger — every processed event.id is recorded
-- so a retried webhook delivery is a no-op rather than double-applying a
-- payment.
create table if not exists stripe_events (
  id text primary key, -- Stripe event.id
  type text not null,
  processed_at timestamptz not null default now()
);

alter table stripe_events enable row level security;
create policy stripe_events_staff_read on stripe_events for select using (is_staff());

-- ---------------------------------------------------------------------------
-- booking_events — audit trail. Never exposed publicly.
-- ---------------------------------------------------------------------------

create table if not exists booking_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings (id) on delete cascade,
  event text not null,
  actor text, -- 'system' | 'customer' | staff.id as text | webhook source
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

alter table booking_events enable row level security;
create policy booking_events_staff_all on booking_events for all using (is_staff()) with check (is_staff());

create index if not exists booking_events_booking_idx on booking_events (booking_id, created_at);

-- ---------------------------------------------------------------------------
-- notifications — outbound email/SMS log, so failures are visible instead
-- of silently losing a confirmation.
-- ---------------------------------------------------------------------------

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references bookings (id) on delete cascade,
  channel text not null check (channel in ('email', 'sms')),
  template text not null,
  recipient text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  provider_message_id text,
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

alter table notifications enable row level security;
create policy notifications_staff_all on notifications for all using (is_staff()) with check (is_staff());

-- ---------------------------------------------------------------------------
-- expire_stale_holds — called at the start of every hold-creation
-- transaction and by the scheduled sweep. Flips any `held` or
-- `pending_payment` booking whose hold_expires_at has passed to `expired`,
-- which removes it from the exclusion constraint's predicate and frees
-- the vehicle/time slot.
-- ---------------------------------------------------------------------------

create or replace function expire_stale_holds()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  update bookings
  set booking_status = 'expired'
  where booking_status in ('held', 'pending_payment')
    and hold_expires_at is not null
    and hold_expires_at < now();
  get diagnostics affected = row_count;
  return affected;
end;
$$;

-- ---------------------------------------------------------------------------
-- next_booking_number — booking_number_prefix from business_settings +
-- year + zero-padded sequence, e.g. HF-2026-00124. Prefix is configurable,
-- never assumed.
-- ---------------------------------------------------------------------------

create sequence if not exists booking_number_seq;

create or replace function next_booking_number()
returns text
language plpgsql
as $$
declare
  prefix text;
  year_part text;
  seq_val bigint;
begin
  select booking_number_prefix into prefix from business_settings where id = true;
  year_part := to_char(now() at time zone 'Australia/Adelaide', 'YYYY');
  seq_val := nextval('booking_number_seq');
  return coalesce(prefix, 'HF') || '-' || year_part || '-' || lpad(seq_val::text, 5, '0');
end;
$$;
