-- Confirmed HF Removals Adelaide business policy (final pass):
--   - 3-hour minimum booking (was an implicit per-rule minimumBillableMinutes)
--   - 1-hour call-out, billed at the job's own per-30-minute rate — not a
--     separate flat fee, so it can never drift from the canonical rate
--   - $100 fixed booking-confirmation payment (was already fixed at $100
--     from the earlier E2E setup pass; this migration makes it durable
--     and documented rather than an ad hoc UPDATE)
--
-- business_settings gains two new confirmed-policy columns. pricing_rules
-- keeps rate_per_30_min_cents as the ONLY per-package figure — call_out_fee_cents
-- is left in place for backward compatibility with any existing row/read
-- but is no longer read by the application (lib/booking/pricing.ts derives
-- call-out from ratePer30MinCents * business_settings.callout_minutes).

alter table business_settings
  add column if not exists minimum_booking_minutes integer not null default 180 check (minimum_booking_minutes > 0),
  add column if not exists callout_minutes integer not null default 60 check (callout_minutes >= 0);

update business_settings
set minimum_booking_minutes = 180,
    callout_minutes = 60,
    deposit_type = 'fixed',
    deposit_fixed_amount_cents = 10000,
    deposit_percentage = null
where id = true;

comment on column business_settings.minimum_booking_minutes is 'Confirmed policy: every job is billed for at least this long (180 min / 3 hr), regardless of actual duration.';
comment on column business_settings.callout_minutes is 'Confirmed policy: a flat call-out (60 min) is added to every job''s price at the job''s own per-30-min rate — truck fuel + basic transport charges.';
comment on column pricing_rules.call_out_fee_cents is 'Deprecated: call-out is now derived from rate_per_30_min_cents * business_settings.callout_minutes in application code (lib/booking/pricing.ts), never a separate stored flat fee. Column kept only to avoid breaking historical pricing_snapshot reads.';
