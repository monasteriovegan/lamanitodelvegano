begin;

create or replace function public.sync_conversation_order_link_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.order_id is not null then
    insert into public.conversation_orders (conversation_id, pedido_id)
    values (new.id, new.order_id)
    on conflict (conversation_id, pedido_id) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public.sync_conversation_order_link_v1() from public, anon, authenticated;
grant execute on function public.sync_conversation_order_link_v1() to service_role;

drop trigger if exists trg_sync_conversation_order_link_v1 on public.conversations;
create trigger trg_sync_conversation_order_link_v1
after insert or update of order_id on public.conversations
for each row
when (new.order_id is not null)
execute function public.sync_conversation_order_link_v1();

insert into public.conversation_orders (conversation_id, pedido_id)
select c.id, c.order_id
from public.conversations c
where c.order_id is not null
on conflict (conversation_id, pedido_id) do nothing;

commit;
