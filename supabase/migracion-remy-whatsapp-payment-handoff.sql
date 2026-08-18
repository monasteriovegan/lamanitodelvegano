create or replace function public.remy_order_payment_handoff()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment_method text;
  now_ts timestamptz := now();
begin
  if new.order_id is null or new.order_id is not distinct from old.order_id then
    return new;
  end if;

  select p.metodopago into payment_method
  from public.pedidos p
  where p.id = new.order_id;

  if payment_method = 'whatsapp' then
    new.human_takeover := true;
    new.metadata := coalesce(new.metadata, '{}'::jsonb) || jsonb_build_object(
      'remy_handoff', true,
      'remy_handoff_at', now_ts,
      'remy_handoff_reason', 'Pedido creado con pago a coordinar por WhatsApp'
    );

    if new.customer_id is not null then
      update public.omnichannel_contacts
      set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
            'needs_human_attention', true,
            'needs_human_attention_at', now_ts,
            'payment_coordination_order_id', new.order_id
          ),
          crm_status = case when crm_status = 'customer' then crm_status else 'needs_attention' end,
          updated_at = now_ts
      where id = new.customer_id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_remy_order_payment_handoff on public.conversations;
create trigger trg_remy_order_payment_handoff
before update of order_id on public.conversations
for each row execute function public.remy_order_payment_handoff();
