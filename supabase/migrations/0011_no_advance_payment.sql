-- Business-rule change: online bookings no longer require ANY advance
-- payment (the former $100 booking-confirmation payment via Stripe
-- Checkout is retired). A customer's held booking is now confirmed
-- directly by a server-only RPC, not by the Stripe webhook.
--
-- Additive and backward-compatible only:
--  * payments / stripe_events tables, deposit_* columns, historical
--    checkout session ids and confirm_booking_payment() are all kept, so
--    historical paid bookings stay readable and a late webhook for a
--    genuine historical session still has somewhere to land.
--  * business_settings.deposit_* values are left untouched; application
--    code simply no longer reads them for new bookings.
--  * booking_hold_minutes keeps its current value (30) and its check
--    constraint. The hold no longer has to outlive a Stripe Checkout
--    session, but there is no documented business reason to shorten it.

-- 1. A semantically honest payment_status for bookings that never
--    required money up-front. NOT 'paid' / 'deposit_paid' — nothing was
--    collected.
alter table bookings drop constraint if exists bookings_payment_status_check;
alter table bookings add constraint bookings_payment_status_check
  check (payment_status in ('pending', 'not_required', 'deposit_paid', 'paid', 'failed', 'refunded', 'partially_refunded'));

-- New holds are created by create_booking_hold(), which doesn't set
-- payment_status, so this default is what a fresh hold gets. It stops a
-- held no-payment booking from displaying as "Payment pending".
alter table bookings alter column payment_status set default 'not_required';

comment on column business_settings.booking_hold_minutes is 'How long a customer''s temporary hold lasts while they finish the booking wizard. Originally floored at 30 to outlive a Stripe Checkout session; Stripe is no longer in the booking path, but the value is kept as-is.';
comment on column business_settings.deposit_type is 'Legacy: no longer used for new bookings (no advance payment required). Kept for historical reference only.';
comment on column business_settings.deposit_fixed_amount_cents is 'Legacy: no longer used for new bookings (no advance payment required). Kept for historical reference only.';
comment on column business_settings.deposit_percentage is 'Legacy: no longer used for new bookings (no advance payment required). Kept for historical reference only.';
comment on column business_settings.min_deposit_amount_cents is 'Legacy: no longer used for new bookings (no advance payment required). Kept for historical reference only.';

-- 2. confirm_booking_without_payment — the confirmation authority for
--    no-payment bookings.
--
-- Race safety: the held -> confirmed transition is ONE conditional
-- UPDATE whose WHERE clause re-checks ownership (access_token), state
-- ('held') and hold validity (hold_expires_at > now()). Under READ
-- COMMITTED a concurrent second call blocks on the row lock, then
-- re-evaluates the WHERE against the committed row, matches nothing, and
-- falls through to the lookup branch — so exactly one caller ever sees
-- transitioned = true. That flag (not "is the row confirmed now?") is
-- what the application uses to send the confirmation email and calendar
-- sync exactly once. The hold-expiry sweep's predicate
-- (hold_expires_at < now()) is mutually exclusive with this one.
--
-- The vehicle/crew EXCLUDE constraints already cover 'held', so flipping
-- held -> confirmed can never create an overlap.
create or replace function confirm_booking_without_payment(
  p_booking_id uuid,
  p_access_token uuid,
  p_pricing_snapshot jsonb,
  p_subtotal_cents integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result bookings;
  existing bookings;
begin
  if p_subtotal_cents is null or p_subtotal_cents < 0 then
    raise exception 'invalid_subtotal';
  end if;

  update bookings
  set booking_status = 'confirmed',
      payment_status = 'not_required',
      deposit_required_cents = 0,
      deposit_paid_cents = 0,
      subtotal_cents = p_subtotal_cents,
      balance_due_cents = p_subtotal_cents,
      pricing_snapshot = p_pricing_snapshot,
      hold_expires_at = null,
      confirmed_at = now()
  where id = p_booking_id
    and access_token = p_access_token
    and booking_status = 'held'
    and hold_expires_at is not null
    and hold_expires_at > now()
  returning * into result;

  if result.id is not null then
    insert into booking_events (booking_id, event, actor, metadata)
    values (result.id, 'booking_confirmed', 'customer', jsonb_build_object('advance_payment', 'not_required'));
    return jsonb_build_object('transitioned', true, 'reason', 'confirmed', 'booking', to_jsonb(result));
  end if;

  -- Nothing transitioned: explain why. A wrong token is indistinguishable
  -- from a missing booking, so it can't be used to probe booking ids.
  select * into existing from bookings where id = p_booking_id and access_token = p_access_token;

  if existing.id is null then
    return jsonb_build_object('transitioned', false, 'reason', 'not_found', 'booking', null);
  end if;

  if existing.booking_status in ('confirmed', 'assigned', 'in_progress', 'completed') then
    return jsonb_build_object('transitioned', false, 'reason', 'already_confirmed', 'booking', to_jsonb(existing));
  end if;

  if existing.booking_status = 'expired'
     or (existing.booking_status = 'held' and (existing.hold_expires_at is null or existing.hold_expires_at <= now())) then
    return jsonb_build_object('transitioned', false, 'reason', 'hold_expired', 'booking', null);
  end if;

  -- cancelled, or a legacy pending_payment booking mid-Stripe-Checkout:
  -- neither may be confirmed without payment.
  return jsonb_build_object('transitioned', false, 'reason', 'invalid_status', 'booking', null);
end;
$$;

revoke execute on function confirm_booking_without_payment(uuid, uuid, jsonb, integer) from public, anon, authenticated;
grant execute on function confirm_booking_without_payment(uuid, uuid, jsonb, integer) to service_role;
