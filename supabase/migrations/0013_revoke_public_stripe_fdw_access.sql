-- SECURITY FIX (found by the Supabase security advisor during the
-- rate-limiting pass): `public.s` is a Stripe foreign-data-wrapper table
-- (server st_server, object=events) that was created outside this repo's
-- migrations. Because it lives in the API-exposed `public` schema and
-- anon/authenticated held SELECT on it, anyone with the public anon key
-- could read Stripe event history over /rest/v1/s. Foreign tables do not
-- honour RLS, so the only fix is removing the grants.
--
-- The application never reads this table. The table, its server and its
-- data are left untouched; only API-role access is revoked. Reversible
-- with a GRANT if a server-side use is ever needed (use service_role).

do $$
begin
  if to_regclass('public.s') is not null then
    execute 'revoke all on table public.s from anon, authenticated';
  end if;
end $$;
