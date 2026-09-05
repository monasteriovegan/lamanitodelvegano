begin;

create or replace function public.admin_conversation_inbox_summary_v1(p_conversation_ids uuid[])
returns table (
  conversation_id uuid,
  last_body text,
  last_direction text,
  last_status text,
  last_message_type text,
  last_message_at timestamptz,
  last_inbound_at timestamptz,
  last_payload jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id as conversation_id,
    lm.body as last_body,
    lm.direction as last_direction,
    lm.status as last_status,
    lm.message_type as last_message_type,
    coalesce(lm.sent_at, lm.created_at) as last_message_at,
    coalesce(li.sent_at, li.created_at) as last_inbound_at,
    lm.payload as last_payload
  from public.conversations c
  left join lateral (
    select m.body, m.direction, m.status, m.message_type, m.sent_at, m.created_at, m.payload
    from public.omnichannel_messages m
    where m.conversation_id = c.id
      and m.message_type not like 'status:%'
    order by coalesce(m.sent_at, m.created_at) desc, m.created_at desc
    limit 1
  ) lm on true
  left join lateral (
    select m.sent_at, m.created_at
    from public.omnichannel_messages m
    where m.conversation_id = c.id
      and m.direction = 'inbound'
      and m.message_type not like 'status:%'
    order by coalesce(m.sent_at, m.created_at) desc, m.created_at desc
    limit 1
  ) li on true
  where c.id = any(p_conversation_ids);
$$;

revoke all on function public.admin_conversation_inbox_summary_v1(uuid[]) from public, anon, authenticated;
grant execute on function public.admin_conversation_inbox_summary_v1(uuid[]) to service_role;

create or replace function public.increment_conversation_unread_v1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.direction = 'inbound' and new.message_type not like 'status:%' then
    update public.conversations
    set unread_count = coalesce(unread_count, 0) + 1,
        updated_at = greatest(coalesce(updated_at, now()), now())
    where id = new.conversation_id;
  end if;
  return new;
end;
$$;

revoke all on function public.increment_conversation_unread_v1() from public, anon, authenticated;
grant execute on function public.increment_conversation_unread_v1() to service_role;

drop trigger if exists omnichannel_messages_increment_unread on public.omnichannel_messages;
create trigger omnichannel_messages_increment_unread
after insert on public.omnichannel_messages
for each row execute function public.increment_conversation_unread_v1();

commit;
