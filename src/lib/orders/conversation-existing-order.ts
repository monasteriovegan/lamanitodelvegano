import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  customerMessagesMentionAmount,
  findCustomerReferencedOrderId,
  type ConversationOrderReferenceMessage,
} from '@/lib/orders/conversation-order-reference';

export type ExistingOrderConversation = {
  id: string;
  business_unit_id: string | null;
  customer_id?: string | null;
  contact_id?: string | null;
  labels?: string[] | null;
};

export type ExistingOrderLinkResult = {
  status: 'already_linked';
  orderId: number;
  paymentStatus: string | null;
};

export async function linkExplicitReferencedOrder(
  db: SupabaseClient,
  conversation: ExistingOrderConversation,
  messages: ConversationOrderReferenceMessage[],
  options: { allowCrossCustomerWithMatchingAmount?: boolean } = {},
): Promise<ExistingOrderLinkResult | null> {
  if (!conversation.business_unit_id) return null;
  if (Array.isArray(conversation.labels) && conversation.labels.includes('personal')) return null;

  const referencedOrderId = findCustomerReferencedOrderId(messages);
  if (!referencedOrderId) return null;

  const { data: order, error: orderError } = await db
    .from('pedidos')
    .select('id,business_unit_id,customer_id,payment_status,total')
    .eq('id', referencedOrderId)
    .maybeSingle();
  if (orderError) throw orderError;
  if (!order || String(order.business_unit_id || '') !== conversation.business_unit_id) return null;

  const conversationCustomerIds = new Set([
    String(conversation.customer_id || ''),
    String(conversation.contact_id || ''),
  ].filter(Boolean));
  const sameCustomer = Boolean(order.customer_id && conversationCustomerIds.has(String(order.customer_id)));
  const crossCustomerProof = Boolean(
    options.allowCrossCustomerWithMatchingAmount
    && customerMessagesMentionAmount(messages, Number(order.total || 0)),
  );
  if (!sameCustomer && !crossCustomerProof) return null;

  const paid = String(order.payment_status || '') === 'paid';
  const labels = Array.from(new Set([
    ...(Array.isArray(conversation.labels)
      ? conversation.labels.map(String).filter((label) => label !== 'pago_por_verificar')
      : []),
    'pedido',
    ...(paid ? ['pagado'] : []),
  ]));

  const { data: updated, error: updateError } = await db
    .from('conversations')
    .update({ order_id: referencedOrderId, labels, updated_at: new Date().toISOString() })
    .eq('id', conversation.id)
    .is('order_id', null)
    .select('id,order_id')
    .maybeSingle();
  if (updateError) throw updateError;

  if (!updated) {
    const { data: current, error: currentError } = await db
      .from('conversations')
      .select('order_id')
      .eq('id', conversation.id)
      .maybeSingle();
    if (currentError) throw currentError;
    if (Number(current?.order_id || 0) !== referencedOrderId) return null;
  }

  const { error: bridgeError } = await db.from('conversation_orders').upsert({
    conversation_id: conversation.id,
    pedido_id: referencedOrderId,
  }, { onConflict: 'conversation_id,pedido_id', ignoreDuplicates: true });
  if (bridgeError) throw bridgeError;

  const { error: messagesError } = await db.from('omnichannel_messages')
    .update({ order_id: referencedOrderId })
    .eq('conversation_id', conversation.id)
    .is('order_id', null);
  if (messagesError) throw messagesError;

  await db.from('conversation_reconciliation_state')
    .update({
      last_status: 'synced',
      missing: [],
      last_error: null,
      last_attempt_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('conversation_id', conversation.id);

  return {
    status: 'already_linked',
    orderId: referencedOrderId,
    paymentStatus: order.payment_status || null,
  };
}
