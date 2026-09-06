begin;

-- A web cart may be handed to WhatsApp with an opaque one-time reference.
-- The reference contains no cart/customer data; the real context is resolved
-- server-side when the inbound WhatsApp message is persisted.
create or replace function public.remy_claim_web_whatsapp_handoff()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  handoff_ref text;
  target_conversation record;
  source_cart record;
  target_cart record;
  handoff_meta jsonb;
  claimed_conversation text;
  created_at timestamptz;
  target_identifier text;
begin
  if lower(coalesce(new.direction, '')) <> 'inbound' or coalesce(new.body, '') = '' then
    return new;
  end if;

  handoff_ref := substring(new.body from '(LMV-[A-Za-z0-9_-]{20,64})');
  if handoff_ref is null then
    return new;
  end if;

  select id, business_unit_id, customer_id, channel, external_conversation_id
    into target_conversation
    from public.conversations
   where id = new.conversation_id
   limit 1;

  if not found or lower(coalesce(target_conversation.channel, '')) <> 'whatsapp' then
    return new;
  end if;

  select id, business_unit_id, conversation_id, customer_id, identificador,
         telefono, items, subtotal, metadata, order_id
    into source_cart
    from public.carritos_abandonados
   where business_unit_id = target_conversation.business_unit_id
     and source_channel = 'web'
     and recuperado = false
     and metadata->'whatsapp_handoff'->>'reference' = handoff_ref
   order by last_activity_at desc
   limit 1
   for update;

  if not found then
    return new;
  end if;

  handoff_meta := coalesce(source_cart.metadata->'whatsapp_handoff', '{}'::jsonb);
  claimed_conversation := btrim(coalesce(handoff_meta->>'claimed_conversation_id', ''));
  if claimed_conversation <> '' and claimed_conversation <> target_conversation.id::text then
    return new;
  end if;

  begin
    created_at := nullif(handoff_meta->>'created_at', '')::timestamptz;
  exception when others then
    created_at := null;
  end;
  if created_at is null or created_at < now() - interval '72 hours' then
    return new;
  end if;

  target_identifier := btrim(coalesce(new.external_user_id, target_conversation.external_conversation_id, ''));
  if target_identifier = '' then
    return new;
  end if;

  select id, items, subtotal, metadata
    into target_cart
    from public.carritos_abandonados
   where business_unit_id = target_conversation.business_unit_id
     and conversation_id = target_conversation.id
     and recuperado = false
   order by last_activity_at desc
   limit 1
   for update;

  if found then
    if coalesce(target_cart.metadata->>'web_handoff_source_cart_id', '') <> source_cart.id::text then
      update public.carritos_abandonados
         set items = case
               when jsonb_typeof(coalesce(to_jsonb(target_cart.items), '[]'::jsonb)) = 'array'
                and jsonb_array_length(coalesce(to_jsonb(target_cart.items), '[]'::jsonb)) > 0
                 then coalesce(to_jsonb(target_cart.items), '[]'::jsonb) || coalesce(to_jsonb(source_cart.items), '[]'::jsonb)
               else source_cart.items
             end,
             subtotal = case
               when jsonb_typeof(coalesce(to_jsonb(target_cart.items), '[]'::jsonb)) = 'array'
                and jsonb_array_length(coalesce(to_jsonb(target_cart.items), '[]'::jsonb)) > 0
                 then coalesce(target_cart.subtotal, 0) + coalesce(source_cart.subtotal, 0)
               else coalesce(source_cart.subtotal, 0)
             end,
             metadata = (coalesce(source_cart.metadata, '{}'::jsonb) - 'whatsapp_handoff') ||
               coalesce(target_cart.metadata, '{}'::jsonb) ||
               jsonb_build_object(
                 'web_handoff_source_cart_id', source_cart.id,
                 'web_handoff_claimed_at', now()
               ),
             customer_id = coalesce(target_conversation.customer_id, customer_id),
             identificador = target_identifier,
             telefono = target_identifier,
             source_channel = 'whatsapp',
             last_activity_at = now()
       where id = target_cart.id;
    end if;
  else
    insert into public.carritos_abandonados (
      business_unit_id,
      conversation_id,
      customer_id,
      source_channel,
      identificador,
      telefono,
      items,
      subtotal,
      metadata,
      recuperado,
      contactado,
      last_activity_at
    ) values (
      target_conversation.business_unit_id,
      target_conversation.id,
      target_conversation.customer_id,
      'whatsapp',
      target_identifier,
      target_identifier,
      source_cart.items,
      source_cart.subtotal,
      (coalesce(source_cart.metadata, '{}'::jsonb) - 'whatsapp_handoff') || jsonb_build_object(
        'web_handoff_source_cart_id', source_cart.id,
        'web_handoff_claimed_at', now()
      ),
      false,
      false,
      now()
    );
  end if;

  update public.carritos_abandonados
     set metadata = jsonb_set(
       coalesce(metadata, '{}'::jsonb),
       '{whatsapp_handoff}',
       coalesce(metadata->'whatsapp_handoff', '{}'::jsonb) || jsonb_build_object(
         'claimed_at', now(),
         'claimed_conversation_id', target_conversation.id
       ),
       true
     ),
     last_activity_at = now()
   where id = source_cart.id;

  return new;
end;
$$;

drop trigger if exists trg_remy_claim_web_whatsapp_handoff on public.omnichannel_messages;
create trigger trg_remy_claim_web_whatsapp_handoff
after insert on public.omnichannel_messages
for each row
execute function public.remy_claim_web_whatsapp_handoff();

commit;
