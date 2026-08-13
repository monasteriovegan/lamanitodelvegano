import { createHmac, timingSafeEqual } from 'node:crypto';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type GatewayPayload = {
  eventId: string;
  messageId: string;
  remoteJid: string;
  phone: string;
  text: string;
  fromMe: boolean;
  timestamp: string;
  pushName?: string | null;
  source?: 'whatsapp-baileys';
};

function verifySignature(raw: string, signature: string | null): boolean {
  const secret = process.env.GATEWAY_SHARED_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac('sha256', secret).update(raw).digest('hex');
  const provided = signature.replace(/^sha256=/, '');
  return expected.length === provided.length && timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

export async function POST(request: Request) {
  const raw = await request.text();
  if (!verifySignature(raw, request.headers.get('x-gateway-signature'))) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  let payload: GatewayPayload;
  try {
    payload = JSON.parse(raw) as GatewayPayload;
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (!payload.messageId || !payload.remoteJid || !payload.timestamp || !payload.text) {
    return Response.json({ error: 'invalid_payload' }, { status: 422 });
  }

  const supabase = createSupabaseServiceClient();
  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .select('id')
    .eq('slug', 'la-manito-del-vegano')
    .single();

  if (businessError || !business) {
    console.error('gateway_business_not_found', businessError);
    return Response.json({ error: 'business_not_found' }, { status: 500 });
  }

  let customerId: string | null = null;
  if (payload.phone) {
    const normalizedPhone = payload.phone.replace(/\D/g, '');
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('id')
      .eq('business_id', business.id)
      .eq('phone', normalizedPhone)
      .maybeSingle();

    if (existingCustomer?.id) {
      customerId = existingCustomer.id;
      await supabase.from('customers').update({
        nombre: payload.pushName || undefined,
        updated_at: new Date().toISOString(),
      }).eq('id', customerId);
    } else {
      const { data: createdCustomer, error: customerError } = await supabase
        .from('customers')
        .insert({
          business_id: business.id,
          phone: normalizedPhone,
          nombre: payload.pushName || `WhatsApp ${normalizedPhone}`,
          crm_status: 'new',
        })
        .select('id')
        .single();
      if (customerError) {
        console.error('gateway_customer_create_failed', customerError);
      } else {
        customerId = createdCustomer.id;
      }
    }
  }

  const { data: conversation, error: conversationError } = await supabase
    .from('crm_conversations')
    .upsert({
      business_id: business.id,
      customer_id: customerId,
      channel: 'whatsapp',
      external_thread_id: payload.remoteJid,
      external_username: payload.pushName ?? null,
      status: 'open',
      last_message_at: payload.timestamp,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'business_id,channel,external_thread_id' })
    .select('id')
    .single();

  if (conversationError || !conversation) {
    console.error('gateway_conversation_upsert_failed', conversationError);
    return Response.json({ error: 'conversation_failed' }, { status: 500 });
  }

  const { error: messageError } = await supabase.from('crm_messages').upsert({
    conversation_id: conversation.id,
    external_message_id: payload.messageId,
    direction: payload.fromMe ? 'outbound' : 'inbound',
    sender_type: payload.fromMe ? 'human' : 'customer',
    text: payload.text,
    message_type: 'text',
    raw_payload: payload,
    sent_at: payload.timestamp,
  }, { onConflict: 'conversation_id,external_message_id', ignoreDuplicates: true });

  if (messageError) {
    console.error('gateway_message_insert_failed', messageError);
    return Response.json({ error: 'message_failed' }, { status: 500 });
  }

  if (customerId) {
    await supabase.from('crm_activities').insert({
      customer_id: customerId,
      type: 'whatsapp_message',
      description: `${payload.fromMe ? 'Mensaje enviado' : 'Mensaje recibido'} por WhatsApp`,
    });
  }

  return Response.json({ ok: true, conversationId: conversation.id, customerId });
}
