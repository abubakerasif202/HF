-- Fixes two payment-flow correctness bugs found during review:
--
-- 1. The Stripe Checkout session could outlive the booking's hold
--    (expires_at was clamped to >= hold_expires_at, which is backwards —
--    it must never exceed it), so the DB could expire+release a slot
--    while the customer was still on the Stripe payment page. Retrying
--    payment on a `pending_payment` booking also always failed, because
--    checkout only accepted `held`.
--
-- Fix: track the *current* Stripe Checkout session per booking, and let
-- the checkout route extend `hold_expires_at` to match the session's
-- actual expiry when it creates one. The webhook only acts on an event
-- whose session.id still matches the booking's current session, so a
-- stale/retried session's expiry event can't kill a booking that has
-- since been repaid under a newer session.
--
-- 2. `payment_status` had no way to represent "deposit paid, balance
--    still owed" separately from "paid in full", even though the spec
--    explicitly requires booking_status and payment_status to vary
--    independently (a confirmed booking can still have a balance due).

alter table bookings add column if not exists current_checkout_session_id text;

alter table bookings drop constraint if exists bookings_payment_status_check;
alter table bookings add constraint bookings_payment_status_check
  check (payment_status in ('pending', 'deposit_paid', 'paid', 'failed', 'refunded', 'partially_refunded'));

alter table payments drop constraint if exists payments_payment_status_check;
alter table payments add constraint payments_payment_status_check
  check (payment_status in ('pending', 'deposit_paid', 'paid', 'failed', 'refunded', 'partially_refunded'));

-- confirm_booking_payment now accepts `pending_payment` OR `held` as the
-- pre-state (a retried checkout leaves the booking in pending_payment
-- already), and sets payment_status to 'deposit_paid' rather than 'paid'
-- whenever a balance remains — 'paid' is reserved for balance_due = 0.
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
  remaining integer;
begin
  select greatest(subtotal_cents - p_deposit_paid_cents, 0) into remaining from bookings where id = p_booking_id;

  update bookings
  set booking_status = 'confirmed',
      payment_status = case when coalesce(remaining, 0) > 0 then 'deposit_paid' else 'paid' end,
      deposit_paid_cents = p_deposit_paid_cents,
      balance_due_cents = coalesce(remaining, 0),
      confirmed_at = now()
  where id = p_booking_id
    and booking_status in ('held', 'pending_payment')
  returning * into result;

  if result.id is null then
    select * into result from bookings where id = p_booking_id;
    return result;
  end if;

  insert into booking_events (booking_id, event, actor)
  values (p_booking_id, 'booking_confirmed', 'stripe_webhook');

  return result;
end;
$$;

revoke execute on function confirm_booking_payment(uuid, integer) from public, anon, authenticated;
grant execute on function confirm_booking_payment(uuid, integer) to service_role;
