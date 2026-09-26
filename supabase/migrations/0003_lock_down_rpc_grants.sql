-- SECURITY FIX: Postgres grants EXECUTE on new functions to PUBLIC by
-- default, and Supabase exposes every public-schema function at
-- /rest/v1/rpc/<name> to anyone holding the anon key. Without this,
-- `confirm_booking_payment` could be called directly by any client to
-- confirm a booking without ever paying. Lock every booking-mutation RPC
-- down to the service role (used only by trusted server code), while
-- leaving `is_staff()` callable since RLS policies invoke it as the
-- querying user.

revoke execute on function create_booking_hold(text, uuid, uuid, timestamptz, timestamptz, integer, integer, uuid, jsonb, jsonb, jsonb, text, integer) from public, anon, authenticated;
grant execute on function create_booking_hold(text, uuid, uuid, timestamptz, timestamptz, integer, integer, uuid, jsonb, jsonb, jsonb, text, integer) to service_role;

revoke execute on function confirm_booking_payment(uuid, integer) from public, anon, authenticated;
grant execute on function confirm_booking_payment(uuid, integer) to service_role;

revoke execute on function expire_stale_holds() from public, anon, authenticated;
grant execute on function expire_stale_holds() to service_role;

revoke execute on function next_booking_number() from public, anon, authenticated;
grant execute on function next_booking_number() to service_role;
