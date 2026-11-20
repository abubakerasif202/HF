-- Per-booking contact snapshot.
--
-- findOrCreateCustomer() reuses the customers row whose email matches and the
-- name / phone typed on the booking form were discarded, so admin, invoices and
-- Google Calendar showed stale details. The submitted contact is now stored on
-- the booking itself. The customers row is intentionally NOT updated from a
-- public request (anyone who knows an email could change it).
--
-- Additive and safe on existing rows: nullable columns, backfilled from
-- customers. RLS stays enabled; the RPC stays service_role only.

alter table bookings add column if not exists contact_name text;
alter table bookings add column if not exists contact_phone text;
alter table bookings add column if not exists contact_email text;

-- Backfill existing bookings from their customer row (only where still empty).
update bookings b
set contact_name  = coalesce(b.contact_name, c.name),
    contact_phone = coalesce(b.contact_phone, c.phone),
    contact_email = coalesce(b.contact_email, c.email)
from customers c
where b.customer_id = c.id
  and (b.contact_name is null or b.contact_phone is null or b.contact_email is null);

-- Preserve create_booking_hold (15 arguments) untouched for existing production callers.
-- Publish a contact-aware function under a distinct name instead of changing
-- or overloading the live RPC. Old and new Vercel builds can run concurrently.
create or replace function create_booking_hold_with_contact(
  p_booking_number text,
  p_customer_id uuid,
  p_service_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_estimated_duration_minutes integer,
  p_crew_size integer,
  p_vehicle_id uuid,
  p_pickup_address jsonb,
  p_destination_address jsonb,
  p_move_details jsonb,
  p_customer_notes text,
  p_hold_minutes integer,
  p_package_id text default null,
  p_truck_class text default null,
  p_contact_name text default null,
  p_contact_phone text default null,
  p_contact_email text default null
)
returns bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  result bookings;
begin
  perform expire_stale_holds();

  insert into bookings (
    booking_number, customer_id, service_id, starts_at, ends_at,
    estimated_duration_minutes, crew_size, vehicle_id,
    pickup_address, destination_address, move_details, customer_notes,
    booking_status, hold_expires_at, package_id, truck_class,
    contact_name, contact_phone, contact_email
  ) values (
    p_booking_number, p_customer_id, p_service_id, p_starts_at, p_ends_at,
    p_estimated_duration_minutes, p_crew_size, p_vehicle_id,
    p_pickup_address, p_destination_address, p_move_details, p_customer_notes,
    'held', now() + make_interval(mins => p_hold_minutes), p_package_id, p_truck_class,
    nullif(btrim(p_contact_name), ''), nullif(btrim(p_contact_phone), ''), nullif(lower(btrim(p_contact_email)), '')
  )
  returning * into result;

  insert into booking_events (booking_id, event, actor, metadata)
  values (result.id, 'hold_created', 'system', jsonb_build_object('vehicle_id', p_vehicle_id, 'package_id', p_package_id, 'truck_class', p_truck_class));

  return result;
exception
  when exclusion_violation then
    raise exception 'slot_unavailable' using errcode = '23P01';
end;
$$;

revoke execute on function create_booking_hold_with_contact(text, uuid, uuid, timestamptz, timestamptz, integer, integer, uuid, jsonb, jsonb, jsonb, text, integer, text, text, text, text, text) from public, anon, authenticated;
grant execute on function create_booking_hold_with_contact(text, uuid, uuid, timestamptz, timestamptz, integer, integer, uuid, jsonb, jsonb, jsonb, text, integer, text, text, text, text, text) to service_role;

-- Refresh PostgREST's cached function signatures before the new code deploys.
notify pgrst, 'reload schema';
