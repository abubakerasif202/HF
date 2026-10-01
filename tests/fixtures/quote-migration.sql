-- Run after 0012 and 0014 ONLY in the disposable hf-mautic-migration-test container.
begin;
do $$ begin
 if not (select relrowsecurity from pg_class where oid = 'public.quote_requests'::regclass) then raise exception 'quote RLS missing'; end if;
 if has_table_privilege('anon', 'public.quote_requests', 'select') or has_table_privilege('anon', 'public.quote_requests', 'insert') or has_table_privilege('authenticated', 'public.quote_requests', 'select') then raise exception 'public quote access'; end if;
 if has_function_privilege('anon', 'public.consume_quote_rate_limit(text,text,integer,integer)', 'execute') then raise exception 'public quote rate RPC'; end if;
 if not has_table_privilege('service_role', 'public.quote_requests', 'insert') then raise exception 'service-role quote access missing'; end if;
end $$;
set local role service_role;
insert into public.quote_requests(id, payload_hash, payload) values ('33333333-3333-4333-8333-333333333333', repeat('a',64), '{"name":"Synthetic Test"}');
update public.quote_requests set delivery_status = 'sent', delivery_provider = 'resend', notification_attempted_at = now(), delivery_failure_category = null where id = '33333333-3333-4333-8333-333333333333';
do $$ begin
 begin
  update public.quote_requests set delivery_failure_category = 'raw-secret-error';
  raise exception 'unconstrained failure category';
 exception when check_violation then null;
 end;
end $$;
select consume_quote_rate_limit(repeat('b',64), 'quote', 6, 1800);
select consume_booking_rate_limit(repeat('b',64), 'hold', 6, 1800);
do $$ declare decision jsonb; begin
 for i in 2..6 loop
  decision := consume_quote_rate_limit(repeat('b',64), 'quote', 6, 1800);
  if (decision->>'allowed')::boolean is not true then raise exception 'early rate limit'; end if;
 end loop;
 decision := consume_quote_rate_limit(repeat('b',64), 'quote', 6, 1800);
 if (decision->>'allowed')::boolean is not false then raise exception 'missing rate limit'; end if;
 begin
  insert into public.quote_requests(id,payload_hash,payload) values ('33333333-3333-4333-8333-333333333333',repeat('a',64),'{}');
  raise exception 'duplicate quote permitted';
 exception when unique_violation then null;
 end;
end $$;
rollback;
