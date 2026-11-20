-- Owner audit trail for admin edits that are not tied to a booking (additive only).
--
-- booking_events requires a booking_id, so edits to a customer's contact
-- details need their own table. Nothing existing is altered. Owner-only via
-- internal.is_staff() and reachable only through the server-side service_role
-- client (matches 0014 / 0017 / 0019).

create table if not exists public.admin_audit (
  id uuid primary key default gen_random_uuid(),
  actor text not null,
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  before jsonb not null default '{}'::jsonb,
  after jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_entity_idx on public.admin_audit (entity_type, entity_id, created_at desc);

alter table public.admin_audit enable row level security;
drop policy if exists admin_audit_owner_all on public.admin_audit;
create policy admin_audit_owner_all on public.admin_audit for all using (internal.is_staff()) with check (internal.is_staff());

revoke all on public.admin_audit from public, anon, authenticated;
grant select, insert on public.admin_audit to service_role;
