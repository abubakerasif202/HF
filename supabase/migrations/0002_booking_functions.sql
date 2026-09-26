-- RPC functions used by the API layer for atomic, race-condition-safe
-- booking-hold creation. Called via supabase-js `.rpc()` with the service
-- role key from server routes only (never from the browser).

-- create_booking_hold: expires stale holds, then attempts to insert a new
-- `held` booking for the given vehicle/time range in the SAME transaction
-- as the expiry sweep, so a hold that just expired is immediately
-- available again to the next caller. The EXCLUDE constraint on
-- `bookings` is the actual concurrency guarantee — if two requests race
-- for the same vehicle/time, Postgres raises `exclusion_violation`
-- (SQLSTATE 23P01) for the loser, which this function catches and
-- reports as a normal "slot taken" result rather than a 500 error.
create or replace function create_booking_hold(
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
  p_hold_minutes integer
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
    booking_status, hold_expires_at
  ) values (
    p_booking_number, p_customer_id, p_service_id, p_starts_at, p_ends_at,
    p_estimated_duration_minutes, p_crew_size, p_vehicle_id,
    p_pickup_address, p_destination_address, p_move_details, p_customer_notes,
    'held', now() + make_interval(mins => p_hold_minutes)
  )
  returning * into result;

  insert into booking_events (booking_id, event, actor, metadata)
  values (result.id, 'hold_created', 'system', jsonb_build_object('vehicle_id', p_vehicle_id));

  return result;
exception
  when exclusion_violation then
    raise exception 'slot_unavailable' using errcode = '23P01';
end;
$$;

-- confirm_booking_payment: idempotently marks a booking confirmed once a
-- Stripe payment succeeds. Records the stripe_events.id first (via a
-- separate insert in application code, before calling this) so retried
-- webhook deliveries are naturally idempotent. Deliberately does NOT
-- re-check the exclusion constraint — the booking already holds the slot
-- via `held`/`pending_payment`, both of which are covered by the same
-- EXCLUDE predicate, so simply flipping status is safe.
create or replace function confirm_booking_payment(
  p_booking_id uuid,
  p_deposit_paid_cents integer
)
returns bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  result bookings;
begin
  update bookings
  set booking_status = 'confirmed',
      payment_status = 'paid',
      deposit_paid_cents = p_deposit_paid_cents,
      balance_due_cents = greatest(subtotal_cents - p_deposit_paid_cents, 0),
      confirmed_at = now()
  where id = p_booking_id
    and booking_status in ('held', 'pending_payment')
  returning * into result;

  if result.id is null then
    -- Already confirmed (idempotent replay) or in a state that can't be
    -- confirmed (e.g. expired/cancelled after the customer paid late).
    select * into result from bookings where id = p_booking_id;
    return result;
  end if;

  insert into booking_events (booking_id, event, actor)
  values (p_booking_id, 'booking_confirmed', 'stripe_webhook');

  return result;
end;
$$;
