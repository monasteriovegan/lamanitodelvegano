import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { NormalizedMessage } from '@/lib/messaging/types';
import { confirmConversationSale, prepareConversationSaleDraft } from '@/lib/orders/conversation-sale';

const CUSTOMER_SALE_SIGNAL = /confirm(?:o|ar)|quiero\s+comprar|me\s+llevo|haz(?:me)?\s+el\s+pedido|pedido|transfer(?:encia|[ií])|comprobante|pag(?:o|u[eé]|ado)|direcci[oó]n|despacho|entrega/i;
const BUSINESS_SALE_SIGNAL = /pedido|confirmad[oa]|agendad[oa]|reservad[oa]|pago|transferencia|recibid[oa]|listo/i;
const BUSINESS_PAYMENT_CONFIRMED = /(?:pago|transferencia|abono).{0,40}(?:recibid[oa]|confirmad[oa]|correct[oa]|ok)|(?:recibid[oa]|confirmad[oa]).{0,40}(?:pago|transferencia|abono)/i;
const CHILE_MOBILE = /(?:\+?56[\s.\-]*)?9(?:[\s.\-]*\d){8}/g;

type MessageRow = {
  direction: 'inbound' | 'outbound' | string;
  body: string | null;
  payload: Record<string, any> | null;
  created_at?: string | null;
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
  return CUSTOMER_SALE_SIGNAL.test(text);
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

async function loadConversationMessages(db: SupabaseClient, conversationId: string) {
  const { data, error } = await db
    .from('omnichannel_messages')
    .select('direction,body,payload,created_at')
    .eq('conversation_id', conversationId)
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
    .select('id,channel,order_id')
    .eq('id', conversationId)
    .maybeSingle();
  if (error) throw error;
  if (!conversation || conversation.channel !== 'instagram') return { status: 'ignored' };
  if (conversation.order_id) return { status: 'already_linked', orderId: Number(conversation.order_id) };

  let draft;
  try {
    draft = await prepareConversationSaleDraft(db, conversationId);
  } catch (error) {
    const reason = error instanceof Error ? error.message : '';
    if (reason.startsWith('conversation_already_has_order:')) {
      const orderId = Number(reason.split(':')[1] || 0);
      return { status: 'already_linked', ...(orderId ? { orderId } : {}) };
    }
    throw error;
  }

  if (!draft.saleDetected) return { status: 'pending', missing: draft.missing };

  const messages = await loadConversationMessages(db, conversationId);
  const extractedPhone = draft.phone || extractPhoneFromMessages(messages);
  const missing = draft.missing.filter((item) => item !== 'telefono' || !extractedPhone);
  if (missing.length) return { status: 'pending', missing };

  // A customer-supplied receipt is enough to create the order, but not enough to
  // mark a transfer as paid. Automatic paid status requires an explicit human
  // outbound acknowledgement from the Instagram business account.
  const businessPaymentConfirmed = draft.paymentMethod === 'transfer'
    && hasBusinessPaymentConfirmation(messages);

  const result = await confirmConversationSale(db, {
    ...draft,
    phone: extractedPhone,
    missing,
    paymentEvidence: businessPaymentConfirmed,
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
