import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { confirmConversationSale, prepareConversationSaleDraft } from '@/lib/orders/conversation-sale';
import { OrderRepository } from '@/lib/repositories/orders-repository';
import {
  hasBusinessPaymentConfirmation,
  hasCustomerNewOrderSignal,
  shouldAttemptWhatsappAutoSale,
  type WhatsappMessageRow as MessageRow,
} from '@/lib/orders/whatsapp-auto-sale-signals';

// Mirrors src/lib/orders/instagram-auto-sale.ts, adapted for the WhatsApp channel.
// Kept as a separate module (rather than generalizing instagram-auto-sale.ts in
// place) so the already-working Instagram flow is not touched by this change.
//
// Purpose: when Remy (the live conversational agent) is NOT the one handling a
// WhatsApp conversation — global switch off, per-conversation switch off, human
// takeover, outside the 24h window, etc. — messages still land in the CRM via
// persistMessage, but nothing used to convert that conversation into a pedido.
// The cheap "should we even bother calling the AI" filter (plain regex, no
// tokens spent) lives in whatsapp-auto-sale-signals.ts; only when it fires does
// this module trigger a single batched AI call (prepareConversationSaleDraft)
// over the whole transcript to extract the order — instead of a live
// per-message conversational agent.
export { shouldAttemptWhatsappAutoSale };

type WhatsappConversationRow = {
  id: string;
  channel: string;
  order_id: number | null;
  labels?: string[] | null;
};

export type WhatsappAutoSaleResult = {
  status: 'ignored' | 'pending' | 'already_linked' | 'synced';
  orderId?: number;
  missing?: string[];
  paymentStatus?: string | null;
};

async function linkMessagesToOrder(db: SupabaseClient, conversationId: string, orderId: number) {
  const { error } = await db.from('omnichannel_messages')
    .update({ order_id: orderId })
    .eq('conversation_id', conversationId)
    .is('order_id', null);
  if (error) throw error;
}

async function reconcileExistingWhatsappOrderPayment(
  db: SupabaseClient,
  conversation: WhatsappConversationRow,
  messages: MessageRow[],
): Promise<WhatsappAutoSaleResult | null> {
  const orderId = Number(conversation.order_id || 0);
  if (!orderId || !hasBusinessPaymentConfirmation(messages)) return null;

  // If the still-unlinked cycle already contains a clear request for another
  // purchase, the payment acknowledgement may belong to that new sale. In that
  // case do not mutate the previous order; let the normal new-order extractor run.
  if (hasCustomerNewOrderSignal(messages)) return null;

  const repo = new OrderRepository(db);
  const before = await repo.getById(orderId);
  if (!before) return null;
  const transfer = String(before.payment_method || '').toLowerCase().includes('transfer');
  if (!transfer) return null;

  if (before.payment_status === 'paid') {
    await linkMessagesToOrder(db, conversation.id, orderId);
    return { status: 'already_linked', orderId, paymentStatus: 'paid' };
  }

  const note = [
    before.admin_notes,
    'Pago confirmado desde una respuesta humana del negocio en WhatsApp.',
  ].filter(Boolean).join(' ');
  const updated = await repo.update(orderId, {
    status: 'confirmed',
    payment_status: 'paid',
    admin_notes: note,
  });

  await linkMessagesToOrder(db, conversation.id, orderId);
  const labels = Array.from(new Set([
    ...(Array.isArray(conversation.labels) ? conversation.labels.map(String) : []),
    'pedido',
    'pagado',
  ]));
  const { error: conversationError } = await db.from('conversations').update({
    labels,
    updated_at: new Date().toISOString(),
  }).eq('id', conversation.id);
  if (conversationError) throw conversationError;

  return {
    status: 'synced',
    orderId,
    paymentStatus: updated.payment_status || null,
  };
}

async function loadConversationMessages(
  db: SupabaseClient,
  conversationId: string,
  onlyUnlinkedMessages = false,
) {
  let query = db
    .from('omnichannel_messages')
    .select('id,direction,body,payload,created_at,order_id')
    .eq('conversation_id', conversationId);
  if (onlyUnlinkedMessages) query = query.is('order_id', null);
  const { data, error } = await query
    .order('created_at', { ascending: true })
    .limit(100);
  if (error) throw error;
  return (data || []) as MessageRow[];
}

export async function autoRegisterWhatsappConversationSale(
  db: SupabaseClient,
  conversationId: string,
): Promise<WhatsappAutoSaleResult> {
  const { data: conversation, error } = await db
    .from('conversations')
    .select('id,channel,order_id,labels')
    .eq('id', conversationId)
    .maybeSingle();
  if (error) throw error;
  if (!conversation || conversation.channel !== 'whatsapp') return { status: 'ignored' };

  const repeatOrder = Boolean(conversation.order_id);
  const onlyUnlinkedMessages = repeatOrder;
  const messages = await loadConversationMessages(db, conversationId, onlyUnlinkedMessages);
  if (repeatOrder && messages.length === 0) {
    return { status: 'already_linked', orderId: Number(conversation.order_id) };
  }

  if (repeatOrder) {
    const paymentReconciliation = await reconcileExistingWhatsappOrderPayment(
      db,
      conversation as WhatsappConversationRow,
      messages,
    );
    if (paymentReconciliation) return paymentReconciliation;
  }

  const draft = await prepareConversationSaleDraft(db, conversationId, {
    allowExistingOrder: repeatOrder,
    onlyUnlinkedMessages,
  });
  if (!draft.saleDetected) return { status: 'pending', missing: draft.missing };

  // Unlike Instagram, the WhatsApp conversation is already tied to a phone
  // number (conversation.external_conversation_id / contact.external_id), so
  // prepareConversationSaleDraft already resolves the phone for this channel —
  // no extra text-scraping fallback needed here.
  if (draft.missing.length) {
    return { status: 'pending', missing: draft.missing };
  }

  // A customer-supplied receipt can support creating the order, but automatic
  // paid status requires an explicit human outbound acknowledgement from the
  // WhatsApp business account in this same, still-unlinked order cycle.
  const businessPaymentConfirmed = draft.paymentMethod === 'transfer'
    && hasBusinessPaymentConfirmation(messages);

  const firstCycleMessageId = messages[0]?.id;
  if (repeatOrder && !firstCycleMessageId) {
    return { status: 'already_linked', orderId: Number(conversation.order_id) };
  }
  const idempotencyKey = repeatOrder
    ? `conversation:${conversation.id}:cycle:${firstCycleMessageId}`
    : `conversation:${conversation.id}`;

  const result = await confirmConversationSale(db, {
    ...draft,
    missing: [],
    paymentEvidence: businessPaymentConfirmed,
  }, undefined, {
    allowExistingOrder: repeatOrder,
    idempotencyKey,
    linkUnassignedMessages: true,
    attributionMedium: 'whatsapp_conversation_auto',
  });

  if (result.duplicate) {
    return { status: 'already_linked', orderId: Number(result.orderId) };
  }
  return {
    status: 'synced',
    orderId: Number(result.orderId),
    paymentStatus: result.paymentStatus || null,
  };
}
