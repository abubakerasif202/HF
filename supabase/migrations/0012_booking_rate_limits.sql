-- Per-IP rate limiting for the public booking API (availability, hold,
-- confirm). Additive only.
--
-- Privacy: rows are keyed by an HMAC-SHA256 hex digest of the client IP
-- (computed in the app with the server-only RATE_LIMIT_SECRET), never the
-- IP itself. The CHECK constraint makes that a database-level guarantee —
-- anything that isn't a 64-char lowercase hex digest is rejected, so a raw
-- IP can't be stored even by mistake.
--
-- Concurrency: consume_booking_rate_limit() is a single
-- INSERT ... ON CONFLICT DO UPDATE ... RETURNING, so concurrent requests
-- for the same key/action/window serialize on the row and each receives
-- its own post-increment count. There is no separate read-then-write.
--
-- Fixed windows aligned to the epoch: simple and atomic. At a window
-- boundary a client can momentarily reach up to 2x the limit; with the
-- generous limits used here that's an acceptable trade for atomicity.

create table if not exists booking_rate_limits (
  key_hash text not null check (key_hash ~ '^[0-9a-f]{64}$'),
  action text not null check (action in ('availability', 'hold', 'confirm')),
  window_started_at timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  expires_at timestamptz not null,
  primary key (key_hash, action, window_started_at)
);

create index if not exists booking_rate_limits_expires_idx on booking_rate_limits (expires_at);

-- RLS on with NO policies: only the service role (which bypasses RLS)
-- can touch this table. anon/authenticated get nothing.
alter table booking_rate_limits enable row level security;
revoke all on table booking_rate_limits from anon, authenticated;

comment on table booking_rate_limits is 'Per-IP booking API rate-limit counters. key_hash is HMAC-SHA256(RATE_LIMIT_SECRET, normalized IP) — raw IPs are never stored. Rows expire and are purged.';

create or replace function consume_booking_rate_limit(
  p_key_hash text,
  p_action text,
  p_limit integer,
  p_window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_window_end timestamptz;
  v_count integer;
begin
  if p_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_key_hash';
  end if;
  if p_limit is null or p_limit < 1 or p_window_seconds is null or p_window_seconds < 1 then
    raise exception 'invalid_limit';
  end if;

  v_window_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_window_end := v_window_start + make_interval(secs => p_window_seconds);

  insert into booking_rate_limits (key_hash, action, window_started_at, request_count, expires_at)
  values (p_key_hash, p_action, v_window_start, 1, v_window_end)
  on conflict (key_hash, action, window_started_at)
  do update set request_count = booking_rate_limits.request_count + 1
  returning request_count into v_count;

  -- Opportunistic cleanup of this key's own expired windows keeps the
  -- table bounded even if the cron sweep doesn't run.
  delete from booking_rate_limits
  where key_hash = p_key_hash and action = p_action and expires_at <= now();

  return jsonb_build_object(
    'allowed', v_count <= p_limit,
    'retry_after_seconds', greatest(ceil(extract(epoch from (v_window_end - now())))::integer, 1)
  );
end;
$$;

create or replace function purge_expired_booking_rate_limits()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  delete from booking_rate_limits where expires_at <= now();
  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke execute on function consume_booking_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function consume_booking_rate_limit(text, text, integer, integer) to service_role;

revoke execute on function purge_expired_booking_rate_limits() from public, anon, authenticated;
grant execute on function purge_expired_booking_rate_limits() to service_role;
