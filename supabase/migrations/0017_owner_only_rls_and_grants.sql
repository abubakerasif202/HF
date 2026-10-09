-- Owner-only database access and least-privilege table grants.
-- The application reaches these tables only through the server-side
-- service_role client; the anon-key (authenticated) client reads public.staff
-- only. Browsers never talk to PostgREST directly.

-- 1. RLS helper: only an active owner passes (previously any active staff row).
create or replace function internal.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.staff
    where id = (select auth.uid()) and active and role = 'owner'
  );
$$;

-- 2. Remove blanket Supabase default grants from anon/authenticated.
revoke all on table
  public.blocked_times, public.booking_assignments, public.booking_events,
  public.bookings, public.business_settings, public.crew_members, public.crews,
  public.customers, public.notifications, public.payments, public.pricing_rules,
  public.services, public.vehicles, public.stripe_events
from anon, authenticated;

-- 3. New objects in public must opt in to API roles explicitly.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from anon, authenticated;

-- Rollback (manual): re-grant per-table privileges to authenticated and restore
-- the previous is_staff() body (`... where id = auth.uid() and active`).
