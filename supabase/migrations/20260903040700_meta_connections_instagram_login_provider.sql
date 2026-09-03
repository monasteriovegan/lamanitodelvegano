alter table public.meta_connections
  drop constraint if exists meta_connections_provider_check;

alter table public.meta_connections
  add constraint meta_connections_provider_check
  check (provider in ('meta', 'meta_instagram_login'));
