-- Applied to HF Supabase on 2026-10-10 via Supabase migration
-- restrict_staff_auth_grants. Kept in the repository for reproducible setups.
-- RLS public.staff policy staff_read_self_or_staff uses internal.is_staff().
-- Authenticated staff retain SELECT, service_role retains staff provisioning.
revoke insert, update, delete, truncate, references, trigger
on table public.staff from anon, authenticated;
revoke select on table public.staff from anon;
grant select on table public.staff to authenticated;
