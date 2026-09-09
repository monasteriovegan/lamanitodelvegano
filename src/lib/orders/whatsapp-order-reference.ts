import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export function extractReferencedOrderId(text: unknown): number | null {
  const value = String(text || '');
  const match = value.match(/\bpedido\s*#\s*(\d{1,10})\b/i);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function reconcileWhatsappOrderReference(
  db: SupabaseClient,
  conversationId: string,
): Promise<{ linked: boolean; orderId?: number }> {
  const { data: conversation, error: conversationError } = await db
    .from('conversations')
    .select('id,channel,business_unit_id,customer_id,contact_id,order_id,labels')
    .eq('id', conversationId)
    .maybeSingle();
  if (conversationError) throw conversationError;
  if (!conversation || conversation.channel !== 'whatsapp') return { linked: false };
  if (conversation.order_id) return { linked: true, orderId: Number(conversation.order_id) };

  const { data: messages, error: messageError } = await db
    .from('omnichannel_messages')
    .select('id,body,direction,created_at')
    .eq('conversation_id', conversationId)
    .eq('direction', 'inbound')
    .order('created_at', { ascending: false })
    .limit(20);
  if (messageError) throw messageError;

  const referencedId = (messages || [])
    .map((message: any) => extractReferencedOrderId(message.body))
    .find((id: number | null) => id != null) || null;
  if (!referencedId) return { linked: false };

  const { data: order, error: orderError } = await db
    .from('pedidos')
    .select('id,business_unit_id,customer_id,source_channel,payment_status')
    .eq('id', referencedId)
    .maybeSingle();
  if (orderError) throw orderError;
  if (!order) return { linked: false };

  const conversationCustomerId = String(conversation.customer_id || conversation.contact_id || '');
  const safeMatch = String(order.business_unit_id || '') === String(conversation.business_unit_id || '')
    && Boolean(conversationCustomerId)
    && String(order.customer_id || '') === conversationCustomerId
    && String(order.source_channel || '') === 'web'
    && ['pending', 'partial', 'paid'].includes(String(order.payment_status || 'pending'));
  if (!safeMatch) return { linked: false };

  const labels = Array.from(new Set([
    ...(Array.isArray(conversation.labels) ? conversation.labels.map(String).filter((label: string) => label !== 'personal') : []),
    'pedido',
    ...(String(order.payment_status) === 'paid' ? ['pagado'] : []),
  ]));

  const { error: updateError } = await db.from('conversations').update({
    order_id: referencedId,
    customer_id: conversationCustomerId,
    labels,
    updated_at: new Date().toISOString(),
  }).eq('id', conversationId).is('order_id', null);
  if (updateError) throw updateError;

  const { error: linkError } = await db.from('conversation_orders').upsert({
    conversation_id: conversationId,
    pedido_id: referencedId,
  }, { onConflict: 'conversation_id,pedido_id', ignoreDuplicates: true });
  if (linkError) throw linkError;

  const { error: messageLinkError } = await db.from('omnichannel_messages')
    .update({ order_id: referencedId })
    .eq('conversation_id', conversationId)
    .is('order_id', null);
  if (messageLinkError) throw messageLinkError;

  return { linked: true, orderId: referencedId };
}
