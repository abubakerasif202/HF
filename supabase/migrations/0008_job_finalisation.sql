-- Final job billing. Staff record actual job duration on completion; the
-- server (never the browser) recomputes the final total from the
-- booking's own pricing_snapshot — NOT the live pricing_rules — so a
-- later rate change can never alter an already-quoted job.

alter table bookings
  add column if not exists actual_duration_minutes integer,
  add column if not exists billable_duration_minutes integer,
  add column if not exists service_charge_cents integer,
  add column if not exists callout_fee_cents integer,
  add column if not exists final_total_cents integer,
  add column if not exists finalised_at timestamptz,
  add column if not exists finalised_by uuid references staff (id);

comment on column bookings.actual_duration_minutes is 'Staff-recorded real job duration, in minutes, entered at job completion.';
comment on column bookings.billable_duration_minutes is 'max(actual_duration_minutes, pricing_snapshot minimum), rounded up to a 30-minute unit. Server-computed, never client-supplied.';
comment on column bookings.service_charge_cents is 'billable_duration_minutes worth of the snapshotted per-30-min rate.';
comment on column bookings.callout_fee_cents is 'The snapshotted call-out, applied once per job.';
comment on column bookings.final_total_cents is 'service_charge_cents + callout_fee_cents. The authoritative final job price.';
