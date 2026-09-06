begin;

create table if not exists public.admin_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  device_name text,
  user_agent text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_failure_reason text
);

create index if not exists admin_push_subscriptions_user_enabled_idx
  on public.admin_push_subscriptions(user_id, enabled);

alter table public.admin_push_subscriptions enable row level security;
revoke all on table public.admin_push_subscriptions from anon, authenticated;

create table if not exists public.admin_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('order_paid', 'test')),
  order_id integer references public.pedidos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid not null references public.admin_push_subscriptions(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  sent_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists admin_notification_order_paid_order_id_subscription_id_uidx
  on public.admin_notification_deliveries(event_type, order_id, subscription_id)
  where event_type = 'order_paid' and order_id is not null;

create index if not exists admin_notification_deliveries_subscription_idx
  on public.admin_notification_deliveries(subscription_id, created_at desc);

alter table public.admin_notification_deliveries enable row level security;
revoke all on table public.admin_notification_deliveries from anon, authenticated;

commit;
