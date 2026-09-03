create extension if not exists pg_cron;

create or replace function public.invoke_order_reconciliation()
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  verify_token text;
  reconcile_key text;
  response extensions.http_response;
begin
  select s.wa_verify_token
    into verify_token
    from public.integraciones_secretas s
   where s.id = 'global'
   limit 1;

  if verify_token is null or btrim(verify_token) = '' then
    raise warning 'order_reconciliation_skipped: missing verify token';
    return 0;
  end if;

  reconcile_key := encode(extensions.digest(verify_token, 'sha256'), 'hex');

  response := extensions.http((
    'POST'::extensions.http_method,
    'https://lamanitodelvegano.cl/api/internal/reconcile-pending-sales?limit=50&hours=72'::varchar,
    array[
      extensions.http_header('x-order-reconcile-key', reconcile_key),
      extensions.http_header('user-agent', 'lmv-order-reconciler/1.0')
    ]::extensions.http_header[],
    'application/json'::varchar,
    '{}'::varchar
  )::extensions.http_request);

  if response.status < 200 or response.status >= 300 then
    raise warning 'order_reconciliation_http_failed: status=% body=%', response.status, left(coalesce(response.content, ''), 500);
  end if;

  return response.status;
exception when others then
  raise warning 'order_reconciliation_invoke_failed: %', sqlerrm;
  return 0;
end;
$function$;

revoke all on function public.invoke_order_reconciliation() from public;
grant execute on function public.invoke_order_reconciliation() to postgres, service_role;

do $block$
declare
  existing_job bigint;
begin
  select j.jobid into existing_job
    from cron.job j
   where j.jobname = 'lmv-order-reconciliation-5m'
   limit 1;
  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;

  perform cron.schedule(
    'lmv-order-reconciliation-5m',
    '*/5 * * * *',
    'select public.invoke_order_reconciliation();'
  );
end;
$block$;
