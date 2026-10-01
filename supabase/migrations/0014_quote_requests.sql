-- Additive quote bridge. No existing booking/customer/payment tables are changed.
create table public.quote_requests (
  id uuid primary key,
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  payload jsonb not null,
  quote_status text not null default 'new' check (quote_status in ('new', 'quote_sent', 'follow_up', 'booked', 'completed', 'lost')),
  delivery_status text not null default 'pending' check (delivery_status in ('pending', 'sent', 'failed', 'unknown')),
  delivery_provider text check (delivery_provider = 'resend'),
  notification_attempted_at timestamptz,
  delivery_failure_category text check (delivery_failure_category in ('configuration', 'authentication', 'rejected', 'provider', 'network', 'timeout', 'invalid_response')),
  created_at timestamptz not null default now()
);
alter table public.quote_requests enable row level security;
revoke all on public.quote_requests from public, anon, authenticated;
grant select, insert, update on public.quote_requests to service_role;
create index quote_requests_delivery_idx on public.quote_requests (delivery_status, created_at);

-- A separate quote counter preserves all existing booking tables, constraints and RPCs.
create table public.quote_rate_limits (
  key_hash text not null check (key_hash ~ '^[0-9a-f]{64}$'),
  action text not null check (action = 'quote'),
  window_started_at timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  expires_at timestamptz not null,
  primary key (key_hash, action, window_started_at)
);
alter table public.quote_rate_limits enable row level security;
revoke all on public.quote_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on public.quote_rate_limits to service_role;
create index quote_rate_limits_expires_idx on public.quote_rate_limits (expires_at);

create function public.consume_quote_rate_limit(
  p_key_hash text, p_action text, p_limit integer, p_window_seconds integer
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
  if p_key_hash is null or p_key_hash !~ '^[0-9a-f]{64}$' or p_action is distinct from 'quote' then
    raise exception 'invalid_quote_limit_key';
  end if;
  if p_limit is null or p_limit < 1 or p_window_seconds is null or p_window_seconds < 1 then
    raise exception 'invalid_limit';
  end if;
  v_window_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_window_end := v_window_start + make_interval(secs => p_window_seconds);
  insert into public.quote_rate_limits (key_hash, action, window_started_at, request_count, expires_at)
  values (p_key_hash, p_action, v_window_start, 1, v_window_end)
  on conflict (key_hash, action, window_started_at)
  do update set request_count = quote_rate_limits.request_count + 1
  returning request_count into v_count;
  -- Only expired technical counters from this NEW table are pruned.
  delete from public.quote_rate_limits where expires_at <= now();
  return jsonb_build_object(
    'allowed', v_count <= p_limit,
    'retry_after_seconds', greatest(ceil(extract(epoch from (v_window_end - now())))::integer, 1)
  );
end;
$$;
revoke execute on function public.consume_quote_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_quote_rate_limit(text, text, integer, integer) to service_role;
