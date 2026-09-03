create table if not exists public.conversation_reconciliation_state (
  conversation_id uuid primary key references public.conversations(id) on delete cascade,
  last_attempt_at timestamptz not null default now(),
  last_status text not null default 'pending',
  missing jsonb not null default '[]'::jsonb,
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  updated_at timestamptz not null default now()
);

create index if not exists conversation_reconciliation_state_status_attempt_idx
  on public.conversation_reconciliation_state (last_status, last_attempt_at desc);

create index if not exists conversation_reconciliation_state_updated_idx
  on public.conversation_reconciliation_state (updated_at desc);

alter table public.conversation_reconciliation_state enable row level security;

comment on table public.conversation_reconciliation_state is
  'Internal retry state for autonomous Instagram/WhatsApp order reconciliation. Service-role only.';