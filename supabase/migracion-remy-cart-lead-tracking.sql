create or replace function public.remy_cart_mark_interested()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.customer_id is not null
     and jsonb_typeof(new.items) = 'array'
     and jsonb_array_length(new.items) > 0 then
    update public.omnichannel_contacts
       set crm_status = case
             when crm_status in ('customer','follow_up') then crm_status
             else 'interested'
           end,
           updated_at = now()
     where id = new.customer_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_remy_cart_mark_interested on public.carritos_abandonados;
create trigger trg_remy_cart_mark_interested
after insert or update of items, customer_id on public.carritos_abandonados
for each row execute function public.remy_cart_mark_interested();
