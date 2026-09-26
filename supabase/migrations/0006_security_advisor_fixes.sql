-- Fixes from Supabase's own security advisor, run after applying the
-- booking-system migrations against the real project:
--
-- 1. set_updated_at / next_booking_number had a mutable search_path
--    (missing `set search_path`), which is a hardening gap for
--    SECURITY DEFINER-adjacent trigger functions — an attacker able to
--    influence a session's search_path could otherwise shadow a
--    referenced object. Pin both explicitly.
-- 2. btree_gist was installed into the `public` schema; move it to a
--    dedicated `extensions` schema, which is the standard Supabase
--    convention and keeps `public` free of extension objects.
-- 3. is_staff() was flagged as a SECURITY DEFINER function directly
--    callable by anon/authenticated over the exposed REST API
--    (/rest/v1/rpc/is_staff). It must stay EXECUTABLE by those roles —
--    RLS policies run under the querying role's own privileges even
--    though the function body is SECURITY DEFINER, so revoking EXECUTE
--    would break every policy that calls it. The actual fix is to stop
--    PostgREST from exposing it as a public RPC endpoint at all, by
--    moving it out of the `public` schema (PostgREST only auto-exposes
--    functions in schemas listed in the API's exposed-schemas config,
--    which defaults to just `public`/`graphql_public`). RLS policies can
--    still call a schema-qualified function regardless of REST exposure.

create schema if not exists extensions;
alter extension btree_gist set schema extensions;

alter function set_updated_at() set search_path = public;
alter function next_booking_number() set search_path = public;

create schema if not exists internal;
alter function is_staff() set schema internal;

-- Every policy that referenced the unqualified is_staff() now needs the
-- schema-qualified name; recreate them pointing at internal.is_staff().
drop policy if exists staff_read_self_or_staff on staff;
create policy staff_read_self_or_staff on staff for select using (internal.is_staff());

drop policy if exists business_settings_staff_all on business_settings;
create policy business_settings_staff_all on business_settings for all using (internal.is_staff()) with check (internal.is_staff());

drop policy if exists services_staff_all on services;
create policy services_staff_all on services for all using (internal.is_staff()) with check (internal.is_staff());

drop policy if exists pricing_rules_staff_all on pricing_rules;
create policy pricing_rules_staff_all on pricing_rules for all using (internal.is_staff()) with check (internal.is_staff());

drop policy if exists vehicles_staff_all on vehicles;
create policy vehicles_staff_all on vehicles for all using (internal.is_staff()) with check (internal.is_staff());

drop policy if exists crews_staff_all on crews;
create policy crews_staff_all on crews for all using (internal.is_staff()) with check (internal.is_staff());

drop policy if exists crew_members_staff_all on crew_members;
create policy crew_members_staff_all on crew_members for all using (internal.is_staff()) with check (internal.is_staff());

drop policy if exists blocked_times_staff_all on blocked_times;
create policy blocked_times_staff_all on blocked_times for all using (internal.is_staff()) with check (internal.is_staff());

drop policy if exists customers_staff_all on customers;
create policy customers_staff_all on customers for all using (internal.is_staff()) with check (internal.is_staff());

drop policy if exists bookings_staff_all on bookings;
create policy bookings_staff_all on bookings for all using (internal.is_staff()) with check (internal.is_staff());

drop policy if exists booking_assignments_staff_all on booking_assignments;
create policy booking_assignments_staff_all on booking_assignments for all using (internal.is_staff()) with check (internal.is_staff());

drop policy if exists payments_staff_all on payments;
create policy payments_staff_all on payments for all using (internal.is_staff()) with check (internal.is_staff());

drop policy if exists stripe_events_staff_read on stripe_events;
create policy stripe_events_staff_read on stripe_events for select using (internal.is_staff());

drop policy if exists booking_events_staff_all on booking_events;
create policy booking_events_staff_all on booking_events for all using (internal.is_staff()) with check (internal.is_staff());

drop policy if exists notifications_staff_all on notifications;
create policy notifications_staff_all on notifications for all using (internal.is_staff()) with check (internal.is_staff());
