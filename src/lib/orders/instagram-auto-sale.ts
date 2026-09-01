import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { NormalizedMessage } from '@/lib/messaging/types';
import { confirmConversationSale, prepareConversationSaleDraft } from '@/lib/orders/conversation-sale';
import { OrderRepository } from '@/lib/repositories/orders-repository';

const CUSTOMER_SALE_SIGNAL = /confirm(?:o|ar)|quiero\s+comprar|me\s+llevo|haz(?:me)?\s+el\s+pedido|pedido|transfer(?:encia|[ií])|comprobante|pag(?:o|u[eé]|ado)|direcci[oó]n|despacho|entrega/i;
const CUSTOMER_NEW_ORDER_SIGNAL = /quiero\s+(?:comprar|pedir|otra|otro)|me\s+llevo|haz(?:me)?\s+el\s+pedido|nuevo\s+pedido|otra\s+(?:barra|caja|box)|otro\s+(?:producto|pedido)/i;
const CUSTOMER_FULFILLMENT_SIGNAL = /(?:\+?56[\s.\-]*)?9(?:[\s.\-]*\d){8}|calle|avenida|av\.?\s|pasaje|depto|departamento|casa\s|comuna|providencia|ñuñoa|nunoa|macul|la\s+reina|las\s+condes|vitacura|santiago|san\s+miguel|la\s+florida|peñalol[eé]n|penalolen|maip[uú]|pudahuel|quilicura|huechuraba/i;
const BUSINESS_SALE_SIGNAL = /pedido|confirmad[oa]|agendad[oa]|reservad[oa]|pago|transferencia|recibid[oa]|listo/i;
const BUSINESS_PAYMENT_CONFIRMED = /(?:pago|transferencia|abono).{0,40}(?:recibid[oa]|confirmad[oa]|correct[oa]|ok)|(?:recibid[oa]|confirmad[oa]).{0,40}(?:pago|transferencia|abono)/i;
const CHILE_MOBILE = /(?:\+?56[\s.\-]*)?9(?:[\s.\-]*\d){8}/g;

type MessageRow = {
  id: string;
  direction: 'inbound' | 'outbound' | string;
  body: string | null;
  payload: Record<string, any> | null;
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

export function shouldAttemptInstagramAutoSale(message: NormalizedMessage) {
  if (message.channel !== 'instagram' || !message.text?.trim()) return false;
  if (!['text', 'postback'].includes(message.message_type)) return false;

  const text = message.text.trim();
  if (message.direction === 'outbound') return BUSINESS_SALE_SIGNAL.test(text);
  return CUSTOMER_SALE_SIGNAL.test(text) || CUSTOMER_FULFILLMENT_SIGNAL.test(text);
}

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

function isHumanInstagramEcho(message: MessageRow) {
  if (message.direction !== 'outbound') return false;
  const payload = message.payload && typeof message.payload === 'object' ? message.payload : {};
  return payload.sender_type === 'human' || payload?.raw?.is_echo === true;
}

function hasBusinessPaymentConfirmation(messages: MessageRow[]) {
  return messages.some((message) => {
    if (!isHumanInstagramEcho(message)) return false;
    return BUSINESS_PAYMENT_CONFIRMED.test(String(message.body || ''));
  });
}

function hasCustomerNewOrderSignal(messages: MessageRow[]) {
  return messages.some((message) => (
    message.direction === 'inbound'
    && CUSTOMER_NEW_ORDER_SIGNAL.test(String(message.body || ''))
  ));
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

  const nonPhoneMissing = draft.missing.filter((item) => item !== 'telefono');
  if (draft.missing.length && nonPhoneMissing.length) {
    return { status: 'pending', missing: draft.missing };
  }

  const extractedPhone = draft.phone || extractPhoneFromMessages(messages);
  const missing = draft.missing.filter((item) => item !== 'telefono' || !extractedPhone);
  if (missing.length) return { status: 'pending', missing };

  // A customer-supplied receipt can support creating the order, but automatic
  // paid status requires an explicit human outbound acknowledgement from the
  // Instagram business account in this same, still-unlinked order cycle.
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
