-- Booking Finder + Invoice Generator (additive only).
--
-- * No existing table or column is altered; every object is created fresh, so
--   legacy bookings (null pricing_snapshot, null phone, historical $100
--   deposits, pending_payment rows) are read, never rewritten.
-- * All new tables are owner-only via internal.is_staff() and are reachable
--   only through the server-side service_role client.
-- * Money is integer cents everywhere. Quantities are thousandths of a unit.
-- * Nothing here is seeded with business facts: ABN, GST status, payment
--   details, invoice prefix and payment terms stay NULL until the owner
--   configures them, and issue_invoice() refuses to run while they are NULL.

-- ---------------------------------------------------------------------------
-- 1. Booking Finder
-- ---------------------------------------------------------------------------

-- Canonical Australian national digits: "+61 491 704 136", "61491704136" and
-- "0491 704 136" all become "0491704136". Non-AU shapes are returned as digits.
create or replace function public.normalize_au_phone(p text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when d = '' then null
    when d like '0061%' then '0' || substr(d, 5)
    when d like '61%' and length(d) = 11 then '0' || substr(d, 3)
    else d
  end
  from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') as d) s;
$$;

create or replace function public.address_search_text(a jsonb)
returns text
language sql
immutable
set search_path = public
as $$
  select case jsonb_typeof(a)
    when 'string' then a #>> '{}'
    when 'object' then concat_ws(' ', a ->> 'formattedAddress', a ->> 'addressLine', a ->> 'suburb')
    else ''
  end;
$$;

-- Ranked, paginated search. Every free-text token must appear somewhere in
-- the booking haystack (partial match). Exact reference = rank 0, exact phone
-- = rank 1, reference contains = rank 2, anything else = rank 3.
create or replace function public.admin_search_bookings(
  p_tokens text[] default '{}',
  p_reference text default null,
  p_phone text default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_status text default null,
  p_crew_id uuid default null,
  p_vehicle_id uuid default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  booking_number text,
  booking_status text,
  starts_at timestamptz,
  ends_at timestamptz,
  estimated_duration_minutes integer,
  crew_id uuid,
  crew_name text,
  vehicle_id uuid,
  vehicle_name text,
  dispatch_additional_vehicle_ids uuid[],
  customer_name text,
  customer_email text,
  customer_phone text,
  pickup_address jsonb,
  destination_address jsonb,
  match_rank integer,
  total_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with base as (
    select
      b.id, b.booking_number, b.booking_status, b.starts_at, b.ends_at,
      b.estimated_duration_minutes, b.crew_id, cr.name as crew_name,
      b.vehicle_id, v.name as vehicle_name, b.dispatch_additional_vehicle_ids,
      c.name as customer_name, c.email as customer_email, c.phone as customer_phone,
      b.pickup_address, b.destination_address,
      public.normalize_au_phone(c.phone) as phone_norm,
      regexp_replace(upper(b.booking_number), '[^A-Z0-9]', '', 'g') as ref_alnum,
      lower(concat_ws(' ',
        b.booking_number,
        regexp_replace(b.booking_number, '[^A-Za-z0-9]', '', 'g'),
        c.name, c.email, c.phone, public.normalize_au_phone(c.phone),
        public.address_search_text(b.pickup_address),
        public.address_search_text(b.destination_address)
      )) as haystack
    from public.bookings b
    left join public.customers c on c.id = b.customer_id
    left join public.crews cr on cr.id = b.crew_id
    left join public.vehicles v on v.id = b.vehicle_id
    where (p_from is null or b.starts_at >= p_from)
      and (p_to is null or b.starts_at < p_to)
      and (p_status is null or b.booking_status = p_status)
      and (p_crew_id is null or b.crew_id = p_crew_id)
      and (p_vehicle_id is null or b.vehicle_id = p_vehicle_id or p_vehicle_id = any (b.dispatch_additional_vehicle_ids))
  ), matched as (
    select base.*,
      case
        when p_reference is not null and base.ref_alnum = p_reference then 0
        when p_phone is not null and base.phone_norm = p_phone then 1
        when p_reference is not null and length(p_reference) >= 3 and position(p_reference in base.ref_alnum) > 0 then 2
        else 3
      end as match_rank
    from base
    where (p_phone is null or position(p_phone in coalesce(base.phone_norm, '')) > 0)
      and not exists (select 1 from unnest(coalesce(p_tokens, '{}')) t where t <> '' and position(t in base.haystack) = 0)
  )
  select m.id, m.booking_number, m.booking_status, m.starts_at, m.ends_at, m.estimated_duration_minutes,
         m.crew_id, m.crew_name, m.vehicle_id, m.vehicle_name, m.dispatch_additional_vehicle_ids,
         m.customer_name, m.customer_email, m.customer_phone, m.pickup_address, m.destination_address,
         m.match_rank, count(*) over () as total_count
  from matched m
  order by m.match_rank, m.starts_at desc, m.id
  limit greatest(1, least(coalesce(p_limit, 20), 50))
  offset greatest(0, coalesce(p_offset, 0));
$$;

revoke all on function public.normalize_au_phone(text) from public, anon, authenticated;
revoke all on function public.address_search_text(jsonb) from public, anon, authenticated;
revoke all on function public.admin_search_bookings(text[], text, text, timestamptz, timestamptz, text, uuid, uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.normalize_au_phone(text), public.address_search_text(jsonb) to service_role;
grant execute on function public.admin_search_bookings(text[], text, text, timestamptz, timestamptz, text, uuid, uuid, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- 2. Invoice settings (singleton, never seeded with business facts)
-- ---------------------------------------------------------------------------

create table if not exists public.invoice_settings (
  id boolean primary key default true constraint invoice_settings_singleton check (id),
  abn text constraint invoice_settings_abn_check check (abn is null or abn ~ '^[0-9]{11}$'),
  gst_registered boolean,
  rates_include_gst boolean,
  payment_instructions text constraint invoice_settings_payment_len check (payment_instructions is null or length(payment_instructions) <= 1000),
  payment_terms_days integer constraint invoice_settings_terms_check check (payment_terms_days is null or payment_terms_days between 0 and 365),
  invoice_prefix text constraint invoice_settings_prefix_check check (invoice_prefix is null or invoice_prefix ~ '^[A-Za-z0-9-]{1,12}$'),
  next_invoice_number bigint not null default 1 constraint invoice_settings_next_check check (next_invoice_number >= 1),
  footer_note text constraint invoice_settings_footer_len check (footer_note is null or length(footer_note) <= 500),
  logo_confirmed boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.invoice_settings (id) values (true) on conflict (id) do nothing;

create or replace function public.invoice_settings_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.next_invoice_number < old.next_invoice_number then
    raise exception 'invoice_counter_cannot_decrease' using errcode = '23514';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists invoice_settings_guard on public.invoice_settings;
create trigger invoice_settings_guard before update on public.invoice_settings
  for each row execute function public.invoice_settings_guard();

-- ---------------------------------------------------------------------------
-- 3. Invoices, lines, payments, audit trail
-- ---------------------------------------------------------------------------

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'issued', 'void')),
  invoice_number text unique,
  invoice_sequence bigint unique,
  pricing_mode text not null check (pricing_mode in ('hourly', 'fixed')),
  pricing_source text not null check (pricing_source in ('final_billing', 'snapshot_estimate', 'fixed_price', 'recorded_total', 'none')),
  -- NULL until chosen: HF's booked prices are not recorded as GST-inclusive or -exclusive.
  amounts_include_gst boolean,
  customer jsonb not null default '{}'::jsonb,
  booking_reference text not null,
  service_date date not null,
  issue_date date,
  due_date date,
  notes text check (notes is null or length(notes) <= 2000),
  version integer not null default 1,
  issue_idempotency_key text unique,
  snapshot jsonb,
  subtotal_cents bigint,
  gst_cents bigint,
  total_cents bigint,
  replaces_invoice_id uuid references public.invoices (id),
  voided_at timestamptz,
  voided_by text,
  void_reason text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoices_issued_complete check (
    status = 'draft' or (
      invoice_number is not null and invoice_sequence is not null and snapshot is not null
      and issue_date is not null and due_date is not null and issue_idempotency_key is not null
      and subtotal_cents is not null and gst_cents is not null and total_cents is not null
    )
  ),
  constraint invoices_void_complete check (
    status <> 'void' or (voided_at is not null and void_reason is not null and length(trim(void_reason)) >= 3)
  )
);
-- One live (draft or issued) invoice per booking: makes "Create invoice" idempotent.
create unique index if not exists invoices_one_open_per_booking on public.invoices (booking_id) where status <> 'void';
create index if not exists invoices_status_idx on public.invoices (status, created_at desc);

create table if not exists public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  position integer not null check (position >= 0),
  kind text not null check (kind in ('service', 'call_out', 'travel', 'packing', 'surcharge', 'discount', 'other')),
  description text not null check (length(trim(description)) between 1 and 300),
  quantity_milli integer not null check (quantity_milli > 0 and quantity_milli <= 1000000),
  unit_price_cents integer not null check (unit_price_cents >= 0 and unit_price_cents <= 100000000),
  unique (invoice_id, position)
);

create table if not exists public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  kind text not null check (kind in ('deposit', 'payment', 'reversal')),
  amount_cents integer not null check (amount_cents > 0 and amount_cents <= 100000000),
  received_on date not null,
  method text check (method is null or length(method) <= 60),
  reference text check (reference is null or length(reference) <= 120),
  source text not null default 'manual' check (source in ('manual', 'booking_deposit')),
  reverses_payment_id uuid unique references public.invoice_payments (id),
  idempotency_key text unique,
  recorded_by text,
  created_at timestamptz not null default now(),
  constraint invoice_payments_reversal_link check ((kind = 'reversal') = (reverses_payment_id is not null))
);
create index if not exists invoice_payments_invoice_idx on public.invoice_payments (invoice_id);

create table if not exists public.invoice_events (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  event text not null,
  actor text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists invoice_events_invoice_idx on public.invoice_events (invoice_id, created_at);

-- RLS + grants: owner-only, service role only.
alter table public.invoice_settings enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_lines enable row level security;
alter table public.invoice_payments enable row level security;
alter table public.invoice_events enable row level security;
create policy invoice_settings_owner_all on public.invoice_settings for all using (internal.is_staff()) with check (internal.is_staff());
create policy invoices_owner_all on public.invoices for all using (internal.is_staff()) with check (internal.is_staff());
create policy invoice_lines_owner_all on public.invoice_lines for all using (internal.is_staff()) with check (internal.is_staff());
create policy invoice_payments_owner_all on public.invoice_payments for all using (internal.is_staff()) with check (internal.is_staff());
create policy invoice_events_owner_all on public.invoice_events for all using (internal.is_staff()) with check (internal.is_staff());
revoke all on public.invoice_settings, public.invoices, public.invoice_lines, public.invoice_payments, public.invoice_events from anon, authenticated;
grant all on public.invoice_settings, public.invoices, public.invoice_lines, public.invoice_payments, public.invoice_events to service_role;

-- ---------------------------------------------------------------------------
-- 4. Immutability: issued/void invoices are frozen snapshots.
-- ---------------------------------------------------------------------------

create or replace function public.invoices_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  frozen text[] := array['status', 'voided_at', 'voided_by', 'void_reason', 'updated_at'];
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception 'invoice_immutable' using errcode = '55000';
    end if;
    return old;
  end if;
  if old.status = 'draft' then
    new.updated_at := now();
    return new;
  end if;
  if old.status = 'issued' and new.status = 'void'
     and (to_jsonb(new) - frozen) is not distinct from (to_jsonb(old) - frozen) then
    new.updated_at := now();
    return new;
  end if;
  raise exception 'invoice_immutable' using errcode = '55000';
end;
$$;
drop trigger if exists invoices_guard on public.invoices;
create trigger invoices_guard before update or delete on public.invoices
  for each row execute function public.invoices_guard();

create or replace function public.invoice_children_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  parent_id uuid := coalesce(new.invoice_id, old.invoice_id);
  parent_status text;
begin
  select status into parent_status from public.invoices where id = parent_id;
  -- Cascade from deleting a draft parent: the parent row may already be gone.
  if parent_status is null then
    return coalesce(new, old);
  end if;
  if tg_table_name = 'invoice_lines' and parent_status <> 'draft' then
    raise exception 'invoice_immutable' using errcode = '55000';
  end if;
  if tg_table_name = 'invoice_payments' then
    -- Payments are append-only once issued; nothing can be added to a void invoice.
    if tg_op = 'INSERT' and parent_status = 'void' then
      raise exception 'invoice_immutable' using errcode = '55000';
    end if;
    if tg_op <> 'INSERT' and parent_status <> 'draft' then
      raise exception 'invoice_immutable' using errcode = '55000';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists invoice_lines_guard on public.invoice_lines;
create trigger invoice_lines_guard before insert or update or delete on public.invoice_lines
  for each row execute function public.invoice_children_guard();
drop trigger if exists invoice_payments_guard on public.invoice_payments;
create trigger invoice_payments_guard before insert or update or delete on public.invoice_payments
  for each row execute function public.invoice_children_guard();

-- ---------------------------------------------------------------------------
-- 5. Money (integer cents; per-line round-half-up, GST once per invoice)
-- ---------------------------------------------------------------------------

create or replace function public.invoice_line_amount(p_kind text, p_quantity_milli integer, p_unit_price_cents integer)
returns bigint
language sql
immutable
set search_path = public
as $$
  select (case when p_kind = 'discount' then -1 else 1 end)
         * ((p_quantity_milli::bigint * p_unit_price_cents::bigint + 500) / 1000);
$$;

create or replace function public.invoice_totals(p_invoice_id uuid, p_gst_registered boolean)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  inv public.invoices;
  line_total bigint;
  v_subtotal bigint;
  v_gst bigint;
  v_total bigint;
begin
  select * into inv from public.invoices where id = p_invoice_id;
  select coalesce(sum(public.invoice_line_amount(kind, quantity_milli, unit_price_cents)), 0)
    into line_total from public.invoice_lines where invoice_id = p_invoice_id;
  if not coalesce(p_gst_registered, false) then
    v_subtotal := line_total; v_gst := 0; v_total := line_total;
  elsif inv.amounts_include_gst then
    v_total := line_total;
    v_gst := case when v_total > 0 then (2 * v_total + 11) / 22 else 0 end;   -- round-half-up of total / 11
    v_subtotal := v_total - v_gst;
  else
    v_subtotal := line_total;
    v_gst := case when v_subtotal > 0 then (v_subtotal + 5) / 10 else 0 end;  -- round-half-up of subtotal x 10%
    v_total := v_subtotal + v_gst;
  end if;
  return jsonb_build_object('lineTotalCents', line_total, 'subtotalCents', v_subtotal, 'gstCents', v_gst, 'totalCents', v_total);
end;
$$;

create or replace function public.invoice_paid_cents(p_invoice_id uuid)
returns bigint
language sql
stable
set search_path = public
as $$
  select coalesce(sum(case when kind = 'reversal' then -amount_cents else amount_cents end), 0)
  from public.invoice_payments where invoice_id = p_invoice_id;
$$;

-- ---------------------------------------------------------------------------
-- 6. Draft lifecycle RPCs (service_role only)
-- ---------------------------------------------------------------------------

create or replace function public.invoice_apply_payload(p_invoice_id uuid, p_payload jsonb)
returns void
language plpgsql
set search_path = public
as $$
declare
  line jsonb;
  pay jsonb;
  idx integer := 0;
begin
  if p_payload ? 'lines' then
    delete from public.invoice_lines where invoice_id = p_invoice_id;
    for line in select * from jsonb_array_elements(p_payload -> 'lines') loop
      insert into public.invoice_lines (invoice_id, position, kind, description, quantity_milli, unit_price_cents)
      values (p_invoice_id, idx, line ->> 'kind', line ->> 'description', (line ->> 'quantityMilli')::integer, (line ->> 'unitPriceCents')::integer);
      idx := idx + 1;
    end loop;
  end if;
  if p_payload ? 'payments' then
    delete from public.invoice_payments where invoice_id = p_invoice_id;
    for pay in select * from jsonb_array_elements(p_payload -> 'payments') loop
      insert into public.invoice_payments (invoice_id, kind, amount_cents, received_on, method, reference, source)
      values (p_invoice_id, pay ->> 'kind', (pay ->> 'amountCents')::integer, (pay ->> 'receivedOn')::date,
              nullif(pay ->> 'method', ''), nullif(pay ->> 'reference', ''), coalesce(pay ->> 'source', 'manual'));
    end loop;
  end if;
end;
$$;

create or replace function public.create_invoice_draft(p_booking_id uuid, p_actor text, p_draft jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing uuid;
  new_id uuid;
begin
  perform 1 from public.bookings where id = p_booking_id for share;
  if not found then
    raise exception 'booking_not_found' using errcode = 'P0002';
  end if;
  select id into existing from public.invoices where booking_id = p_booking_id and status <> 'void';
  if existing is not null then
    return jsonb_build_object('id', existing, 'created', false);
  end if;
  begin
    insert into public.invoices (booking_id, pricing_mode, pricing_source, amounts_include_gst, customer, booking_reference, service_date, notes, created_by)
    values (p_booking_id, p_draft ->> 'pricingMode', p_draft ->> 'pricingSource',
            nullif(p_draft ->> 'amountsIncludeGst', '')::boolean, coalesce(p_draft -> 'customer', '{}'::jsonb),
            p_draft ->> 'bookingReference', (p_draft ->> 'serviceDate')::date, nullif(p_draft ->> 'notes', ''), p_actor)
    returning id into new_id;
  exception when unique_violation then
    select id into existing from public.invoices where booking_id = p_booking_id and status <> 'void';
    return jsonb_build_object('id', existing, 'created', false);
  end;
  perform public.invoice_apply_payload(new_id, p_draft);
  insert into public.invoice_events (invoice_id, event, actor, metadata)
  values (new_id, 'draft_created', p_actor, jsonb_build_object('pricingSource', p_draft ->> 'pricingSource'));
  return jsonb_build_object('id', new_id, 'created', true);
end;
$$;

create or replace function public.save_invoice_draft(p_invoice_id uuid, p_expected_version integer, p_actor text, p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.invoices;
begin
  select * into inv from public.invoices where id = p_invoice_id for update;
  if not found then raise exception 'invoice_not_found' using errcode = 'P0002'; end if;
  if inv.status <> 'draft' then raise exception 'invoice_not_draft' using errcode = '55000'; end if;
  if inv.version <> p_expected_version then raise exception 'invoice_changed' using errcode = '40001'; end if;
  update public.invoices set
    customer = case when p_patch ? 'customer' then p_patch -> 'customer' else customer end,
    notes = case when p_patch ? 'notes' then nullif(p_patch ->> 'notes', '') else notes end,
    service_date = case when p_patch ? 'serviceDate' then (p_patch ->> 'serviceDate')::date else service_date end,
    amounts_include_gst = case when p_patch ? 'amountsIncludeGst' then nullif(p_patch ->> 'amountsIncludeGst', '')::boolean else amounts_include_gst end,
    version = version + 1
  where id = p_invoice_id;
  perform public.invoice_apply_payload(p_invoice_id, p_patch);
  insert into public.invoice_events (invoice_id, event, actor, metadata)
  values (p_invoice_id, 'draft_saved', p_actor, jsonb_build_object('version', inv.version + 1));
  return jsonb_build_object('id', p_invoice_id, 'version', inv.version + 1);
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. issue_invoice: atomic, retry-safe, gapless numbering, frozen snapshot.
-- ---------------------------------------------------------------------------

create or replace function public.issue_invoice(
  p_invoice_id uuid,
  p_idempotency_key text,
  p_expected_version integer,
  p_snapshot jsonb,
  p_actor text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.invoices;
  s public.invoice_settings;
  missing text[] := '{}';
  v_totals jsonb;
  v_claimed jsonb;
  v_seq bigint;
  v_number text;
  v_issue date;
  v_due date;
  v_paid bigint;
  v_snapshot jsonb;
  v_lines jsonb;
  v_payments jsonb;
begin
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 then
    raise exception 'idempotency_key_required' using errcode = '22023';
  end if;
  select * into inv from public.invoices where id = p_invoice_id for update;
  if not found then raise exception 'invoice_not_found' using errcode = 'P0002'; end if;
  -- Retry of an already-completed issue: same number back, counter untouched.
  if inv.status = 'issued' and inv.issue_idempotency_key = p_idempotency_key then
    return jsonb_build_object('id', inv.id, 'invoiceNumber', inv.invoice_number, 'issueDate', inv.issue_date, 'dueDate', inv.due_date, 'replayed', true);
  end if;
  if inv.status <> 'draft' then raise exception 'invoice_not_draft' using errcode = '55000'; end if;
  if inv.version <> p_expected_version then raise exception 'invoice_changed' using errcode = '40001'; end if;

  select * into s from public.invoice_settings where id = true for update;
  if s.abn is null then missing := array_append(missing, 'abn'); end if;
  if s.gst_registered is null then missing := array_append(missing, 'gst_registered'); end if;
  if s.invoice_prefix is null then missing := array_append(missing, 'invoice_prefix'); end if;
  if s.payment_instructions is null or length(trim(s.payment_instructions)) = 0 then missing := array_append(missing, 'payment_instructions'); end if;
  if s.payment_terms_days is null then missing := array_append(missing, 'payment_terms_days'); end if;
  if cardinality(missing) > 0 then
    raise exception 'invoice_settings_incomplete' using errcode = '55000', detail = array_to_string(missing, ',');
  end if;
  if s.gst_registered and inv.amounts_include_gst is null then
    raise exception 'gst_mode_required' using errcode = '55000';
  end if;
  if not exists (select 1 from public.invoice_lines where invoice_id = inv.id) then
    raise exception 'invoice_has_no_lines' using errcode = '55000';
  end if;

  v_totals := public.invoice_totals(inv.id, s.gst_registered);
  v_claimed := p_snapshot -> 'totals';
  if jsonb_typeof(v_claimed) = 'object' and (v_claimed ->> 'totalCents')::bigint is distinct from (v_totals ->> 'totalCents')::bigint then
    raise exception 'totals_mismatch' using errcode = '55000';
  end if;
  if (v_totals ->> 'totalCents')::bigint <= 0 then
    raise exception 'invoice_total_not_positive' using errcode = '55000';
  end if;
  v_paid := public.invoice_paid_cents(inv.id);
  if v_paid > (v_totals ->> 'totalCents')::bigint then
    raise exception 'payments_exceed_total' using errcode = '55000';
  end if;

  v_seq := s.next_invoice_number;
  update public.invoice_settings set next_invoice_number = v_seq + 1 where id = true;
  v_number := s.invoice_prefix || lpad(v_seq::text, 5, '0');
  v_issue := (now() at time zone 'Australia/Adelaide')::date;
  v_due := v_issue + s.payment_terms_days;

  select coalesce(jsonb_agg(jsonb_build_object('kind', kind, 'description', description, 'quantityMilli', quantity_milli,
           'unitPriceCents', unit_price_cents, 'amountCents', public.invoice_line_amount(kind, quantity_milli, unit_price_cents)) order by position), '[]'::jsonb)
    into v_lines from public.invoice_lines where invoice_id = inv.id;
  select coalesce(jsonb_agg(jsonb_build_object('kind', kind, 'amountCents', amount_cents, 'receivedOn', received_on, 'method', method,
           'reference', reference, 'source', source) order by created_at, id), '[]'::jsonb)
    into v_payments from public.invoice_payments where invoice_id = inv.id;

  v_snapshot := coalesce(p_snapshot, '{}'::jsonb) || jsonb_build_object(
    'title', case when s.gst_registered then 'Tax invoice' else 'Invoice' end,
    'invoiceNumber', v_number, 'issueDate', v_issue, 'dueDate', v_due,
    'bookingReference', inv.booking_reference, 'serviceDate', inv.service_date, 'customer', inv.customer, 'notes', inv.notes,
    'amountsIncludeGst', inv.amounts_include_gst,
    'seller', coalesce(p_snapshot -> 'seller', '{}'::jsonb) || jsonb_build_object(
      'abn', s.abn, 'gstRegistered', s.gst_registered, 'paymentInstructions', s.payment_instructions,
      'paymentTermsDays', s.payment_terms_days, 'footerNote', s.footer_note, 'logoConfirmed', s.logo_confirmed),
    'lines', v_lines, 'payments', v_payments,
    'totals', v_totals || jsonb_build_object('paidCents', v_paid, 'balanceDueCents', (v_totals ->> 'totalCents')::bigint - v_paid));

  update public.invoices set
    status = 'issued', invoice_number = v_number, invoice_sequence = v_seq, issue_date = v_issue, due_date = v_due,
    issue_idempotency_key = p_idempotency_key, snapshot = v_snapshot,
    subtotal_cents = (v_totals ->> 'subtotalCents')::bigint, gst_cents = (v_totals ->> 'gstCents')::bigint,
    total_cents = (v_totals ->> 'totalCents')::bigint, version = version + 1
  where id = inv.id;

  insert into public.invoice_events (invoice_id, event, actor, metadata)
  values (inv.id, 'invoice_issued', p_actor, jsonb_build_object('invoiceNumber', v_number, 'totalCents', v_totals ->> 'totalCents'));
  insert into public.booking_events (booking_id, event, actor, metadata)
  values (inv.booking_id, 'invoice_issued', p_actor, jsonb_build_object('invoiceNumber', v_number));
  return jsonb_build_object('id', inv.id, 'invoiceNumber', v_number, 'issueDate', v_issue, 'dueDate', v_due, 'replayed', false);
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Payments after issue, and auditable void-and-reissue (no prior workflow).
-- ---------------------------------------------------------------------------

create or replace function public.record_invoice_payment(
  p_invoice_id uuid,
  p_kind text,
  p_amount_cents integer,
  p_received_on date,
  p_method text,
  p_reference text,
  p_reverses_payment_id uuid,
  p_idempotency_key text,
  p_actor text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.invoices;
  existing public.invoice_payments;
  new_id uuid;
  original_amount integer;
begin
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 then
    raise exception 'idempotency_key_required' using errcode = '22023';
  end if;
  select * into inv from public.invoices where id = p_invoice_id for update;
  if not found then raise exception 'invoice_not_found' using errcode = 'P0002'; end if;
  select * into existing from public.invoice_payments where idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('id', existing.id, 'replayed', true, 'balanceDueCents', inv.total_cents - public.invoice_paid_cents(inv.id));
  end if;
  if inv.status <> 'issued' then raise exception 'invoice_not_issued' using errcode = '55000'; end if;
  if p_kind = 'reversal' then
    select amount_cents into original_amount from public.invoice_payments
      where id = p_reverses_payment_id and invoice_id = inv.id and kind <> 'reversal';
    if not found then raise exception 'payment_not_found' using errcode = 'P0002'; end if;
    if original_amount <> p_amount_cents then raise exception 'reversal_amount_mismatch' using errcode = '55000'; end if;
  elsif p_amount_cents > inv.total_cents - public.invoice_paid_cents(inv.id) then
    raise exception 'payment_exceeds_balance' using errcode = '55000';
  end if;
  insert into public.invoice_payments (invoice_id, kind, amount_cents, received_on, method, reference, reverses_payment_id, idempotency_key, recorded_by)
  values (inv.id, p_kind, p_amount_cents, p_received_on, nullif(p_method, ''), nullif(p_reference, ''), p_reverses_payment_id, p_idempotency_key, p_actor)
  returning id into new_id;
  insert into public.invoice_events (invoice_id, event, actor, metadata)
  values (inv.id, case when p_kind = 'reversal' then 'payment_reversed' else 'payment_recorded' end, p_actor,
          jsonb_build_object('amountCents', p_amount_cents, 'kind', p_kind));
  return jsonb_build_object('id', new_id, 'replayed', false, 'balanceDueCents', inv.total_cents - public.invoice_paid_cents(inv.id));
end;
$$;

create or replace function public.void_invoice(p_invoice_id uuid, p_reason text, p_reissue boolean, p_actor text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.invoices;
  new_id uuid;
begin
  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'void_reason_required' using errcode = '22023';
  end if;
  select * into inv from public.invoices where id = p_invoice_id for update;
  if not found then raise exception 'invoice_not_found' using errcode = 'P0002'; end if;
  if inv.status <> 'issued' then raise exception 'invoice_not_issued' using errcode = '55000'; end if;

  update public.invoices set status = 'void', voided_at = now(), voided_by = p_actor, void_reason = trim(p_reason) where id = inv.id;
  insert into public.invoice_events (invoice_id, event, actor, metadata)
  values (inv.id, 'invoice_voided', p_actor, jsonb_build_object('reason', trim(p_reason), 'invoiceNumber', inv.invoice_number, 'reissue', p_reissue));
  insert into public.booking_events (booking_id, event, actor, metadata)
  values (inv.booking_id, 'invoice_voided', p_actor, jsonb_build_object('invoiceNumber', inv.invoice_number));

  if p_reissue then
    insert into public.invoices (booking_id, pricing_mode, pricing_source, amounts_include_gst, customer, booking_reference, service_date, notes, replaces_invoice_id, created_by)
    values (inv.booking_id, inv.pricing_mode, inv.pricing_source, inv.amounts_include_gst, inv.customer, inv.booking_reference, inv.service_date, inv.notes, inv.id, p_actor)
    returning id into new_id;
    insert into public.invoice_lines (invoice_id, position, kind, description, quantity_milli, unit_price_cents)
      select new_id, position, kind, description, quantity_milli, unit_price_cents from public.invoice_lines where invoice_id = inv.id;
    -- Carry forward money genuinely received (net of reversals) so the balance stays honest.
    insert into public.invoice_payments (invoice_id, kind, amount_cents, received_on, method, reference, source)
      select new_id, p.kind, p.amount_cents, p.received_on, p.method, p.reference, p.source
      from public.invoice_payments p
      where p.invoice_id = inv.id and p.kind <> 'reversal'
        and not exists (select 1 from public.invoice_payments r where r.reverses_payment_id = p.id);
    insert into public.invoice_events (invoice_id, event, actor, metadata)
    values (new_id, 'draft_created', p_actor, jsonb_build_object('replaces', inv.invoice_number));
  end if;
  return jsonb_build_object('voidedId', inv.id, 'newDraftId', new_id);
end;
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.invoice_apply_payload(uuid, jsonb)',
    'public.create_invoice_draft(uuid, text, jsonb)',
    'public.save_invoice_draft(uuid, integer, text, jsonb)',
    'public.issue_invoice(uuid, text, integer, jsonb, text)',
    'public.record_invoice_payment(uuid, text, integer, date, text, text, uuid, text, text)',
    'public.void_invoice(uuid, text, boolean, text)',
    'public.invoice_line_amount(text, integer, integer)',
    'public.invoice_totals(uuid, boolean)',
    'public.invoice_paid_cents(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end;
$$;
