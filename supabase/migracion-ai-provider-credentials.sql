-- Credenciales server-side para providers LLM adicionales.
-- Gemini sigue compatible con integraciones_secretas.gemini_api_key.

begin;

create table if not exists public.ai_provider_credentials (
  provider text primary key,
  api_key text,
  base_url text,
  enabled boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_provider_credentials enable row level security;

drop policy if exists ai_provider_credentials_admin_all on public.ai_provider_credentials;
create policy ai_provider_credentials_admin_all
  on public.ai_provider_credentials
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on public.ai_provider_credentials from anon;
grant select, insert, update, delete on public.ai_provider_credentials to authenticated;
grant all on public.ai_provider_credentials to service_role;

insert into public.provider_pricing(provider, model, input_usd_per_million, output_usd_per_million, cached_input_usd_per_million, effective_from, source_url, metadata)
values
  ('groq','openai/gpt-oss-20b',0.075,0.30,0.037,now(),'https://console.groq.com/docs/models','{"source":"Groq supported models page","captured":"2026-08-17"}'::jsonb),
  ('groq','openai/gpt-oss-120b',0.15,0.60,0.075,now(),'https://console.groq.com/docs/models','{"source":"Groq supported models page","captured":"2026-08-17"}'::jsonb),
  ('groq','qwen/qwen3.6-27b',0.60,3.00,0,now(),'https://console.groq.com/docs/models','{"source":"Groq supported models page","captured":"2026-08-17"}'::jsonb)
on conflict do nothing;

commit;
