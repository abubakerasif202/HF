-- Quote CRM fields. Additive and safe on existing rows: every new column is nullable
-- or has a default. RLS stays enabled; grants are unchanged (service_role only, from 0014).
alter table public.quote_requests
  add column if not exists notes text check (notes is null or char_length(notes) <= 4000),
  add column if not exists follow_up_at timestamptz,
  add column if not exists status_changed_at timestamptz default now(),
  add column if not exists first_response_at timestamptz,
  add column if not exists quoted_amount_cents integer check (quoted_amount_cents is null or quoted_amount_cents >= 0),
  add column if not exists lost_reason text check (lost_reason is null or lost_reason in ('price', 'date_unavailable', 'no_response', 'went_elsewhere', 'other')),
  add column if not exists booking_id uuid references public.bookings(id) on delete set null;

-- Existing rows have not changed status since they arrived; stop them all showing "changed at migration time".
update public.quote_requests set status_changed_at = created_at where status_changed_at is not null and status_changed_at > created_at and quote_status = 'new';

create index if not exists quote_requests_status_follow_up_idx on public.quote_requests (quote_status, follow_up_at);
create index if not exists quote_requests_booking_id_idx on public.quote_requests (booking_id) where booking_id is not null;
