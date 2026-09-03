import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { confirmConversationSale, prepareConversationSaleDraft } from '@/lib/orders/conversation-sale';
import {
  hasBusinessPaymentConfirmation,
  hasCustomerNewOrderSignal,
  shouldAttemptInstagramAutoSale,
  type InstagramPaymentMessage,
} from '@/lib/orders/instagram-auto-sale-signals';
import { OrderRepository } from '@/lib/repositories/orders-repository';

export { shouldAttemptInstagramAutoSale };

const CHILE_MOBILE = /(?:\+?56[\s.\-]*)?9(?:[\s.\-]*\d){8}/g;

type MessageRow = InstagramPaymentMessage & {
  id: string;
  created_at?: string | null;
  order_id?: number | null;
};

type InstagramConversationRow = {
  id: string;
  channel: string;
  order_id: number | null;
  labels?: string[] | null;
};

export type InstagramAutoSaleResult = {
  status: 'ignored' | 'pending' | 'already_linked' | 'synced';
  orderId?: number;
  missing?: string[];
  paymentStatus?: string | null;
};

export function extractPhoneFromMessages(messages: MessageRow[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const body = String(messages[index]?.body || '');
    const match = body.match(CHILE_MOBILE)?.[0];
    if (!match) continue;
    const digits = match.replace(/\D/g, '');
    if (digits.startsWith('56') && digits.length === 11) return digits;
    if (digits.length === 9 && digits.startsWith('9')) return `56${digits}`;
  }
  return '';
}

async function linkMessagesToOrder(db: SupabaseClient, conversationId: string, orderId: number) {
  const { error } = await db.from('omnichannel_messages')
    .update({ order_id: orderId })
    .eq('conversation_id', conversationId)
    .is('order_id', null);
  if (error) throw error;
}

async function reconcileExistingInstagramOrderPayment(
  db: SupabaseClient,
  conversation: InstagramConversationRow,
  messages: MessageRow[],
): Promise<InstagramAutoSaleResult | null> {
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
    'Pago confirmado desde una respuesta humana del negocio en Instagram.',
  ].filter(Boolean).join(' ');
  const updated = await repo.update(orderId, {
    status: 'confirmed',
    payment_status: 'paid',
    admin_notes: note,
  });

  await linkMessagesToOrder(db, conversation.id, orderId);
  const labels = Array.from(new Set([
    ...(Array.isArray(conversation.labels) ? conversation.labels.map(String).filter((label) => label !== 'personal') : []),
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
    .select('id,direction,body,message_type,payload,created_at,order_id')
    .eq('conversation_id', conversationId);
  if (onlyUnlinkedMessages) query = query.is('order_id', null);
  const { data, error } = await query
    .order('created_at', { ascending: true })
    .limit(100);
  if (error) throw error;
  return (data || []) as MessageRow[];
}

export async function autoRegisterInstagramConversationSale(
  db: SupabaseClient,
  conversationId: string,
): Promise<InstagramAutoSaleResult> {
  const { data: conversation, error } = await db
    .from('conversations')
    .select('id,channel,order_id,labels')
    .eq('id', conversationId)
    .maybeSingle();
  if (error) throw error;
  if (!conversation || conversation.channel !== 'instagram') return { status: 'ignored' };

  const repeatOrder = Boolean(conversation.order_id);
  const onlyUnlinkedMessages = repeatOrder;
  const messages = await loadConversationMessages(db, conversationId, onlyUnlinkedMessages);
  if (repeatOrder && messages.length === 0) {
    return { status: 'already_linked', orderId: Number(conversation.order_id) };
  }

  if (repeatOrder) {
    const paymentReconciliation = await reconcileExistingInstagramOrderPayment(
      db,
      conversation as InstagramConversationRow,
      messages,
    );
    if (paymentReconciliation) return paymentReconciliation;
  }

  const draft = await prepareConversationSaleDraft(db, conversationId, {
    allowExistingOrder: repeatOrder,
    onlyUnlinkedMessages,
  });
  if (!draft.saleDetected) return { status: 'pending', missing: draft.missing };

  const extractedPhone = draft.phone || extractPhoneFromMessages(messages);
  const draftHasMissing = draft.missing.length > 0;
  const missingWithoutPhone = draft.missing.filter((item) => item !== 'telefono');
  const explicitTranscriptShipping = Boolean(
    draft.transcriptTotal
    && draft.calculated
    && draft.transcriptTotal >= draft.calculated.subtotal,
  );
  const toleratedMissing = new Set<string>();
  if (explicitTranscriptShipping || draft.explicitShippingCost != null) {
    toleratedMissing.add('zona_despacho');
    toleratedMissing.add('total_no_coincide');
  }
  const missing = (draftHasMissing ? missingWithoutPhone : []).filter((item) => !toleratedMissing.has(item));
  if (missing.length) return { status: 'pending', missing: draft.missing };

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
    phone: extractedPhone,
    missing,
    paymentEvidence: businessPaymentConfirmed,
  }, undefined, {
    allowExistingOrder: repeatOrder,
    allowMissingPhone: true,
    allowTranscriptShipping: true,
    idempotencyKey,
    linkUnassignedMessages: true,
    attributionMedium: 'instagram_conversation_auto',
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
