import type { NormalizedMessage } from '@/lib/messaging/types';

// Pure, dependency-free signal detection for the WhatsApp auto-sale filter.
// Split out from whatsapp-auto-sale.ts so it can be imported and unit-tested
// directly (that file pulls in conversation-sale.ts / orders-repository.ts,
// which touch Supabase and can't be executed outside the app runtime).

export const CUSTOMER_SALE_SIGNAL = /confirm(?:o|ar)|quiero\s+comprar|me\s+llevo|haz(?:me)?\s+el\s+pedido|pedido|transfer(?:encia|[ií])|comprobante|pag(?:o|u[eé]|ado)|direcci[oó]n|despacho|entrega/i;
export const CUSTOMER_NEW_ORDER_SIGNAL = /quiero\s+(?:comprar|pedir|otra|otro)|me\s+llevo|haz(?:me)?\s+el\s+pedido|nuevo\s+pedido|otra\s+(?:barra|caja|box)|otro\s+(?:producto|pedido)/i;
export const CUSTOMER_FULFILLMENT_SIGNAL = /calle|avenida|av\.?\s|pasaje|depto|departamento|casa\s|comuna|providencia|ñuñoa|nunoa|macul|la\s+reina|las\s+condes|vitacura|santiago|san\s+miguel|la\s+florida|peñalol[eé]n|penalolen|maip[uú]|pudahuel|quilicura|huechuraba/i;
export const CUSTOMER_PICKUP_SIGNAL = /\b(?:retiro|retirar|retiro\s+en|ir[eé]?\s+a\s+buscar|voy\s+a\s+buscar|pasar(?:e|é|emos)?\s+(?:a\s+)?buscar|lo\s+(?:ir[eé]?|voy)\s+a\s+buscar|buscar(?:lo|la)?\s+(?:al|en)\s+metro|metro\s+la\s+moneda)\b/i;
export const CUSTOMER_IDENTITY_SIGNAL = /\b(?:mi\s+nombre\s+es|me\s+llamo)\s+[\p{L}][\p{L}\s.'-]{2,}/iu;
export const BUSINESS_SALE_SIGNAL = /pedido|confirmad[oa]|agendad[oa]|reservad[oa]|pago|transferencia|recibid[oa]|listo/i;
export const BUSINESS_PAYMENT_CONFIRMED = /(?:pago|transferencia|abono).{0,40}(?:recibid[oa]|confirmad[oa]|correct[oa]|ok)|(?:recibid[oa]|confirmad[oa]).{0,40}(?:pago|transferencia|abono)/i;

export type WhatsappMessageRow = {
  id: string;
  direction: 'inbound' | 'outbound' | string;
  body: string | null;
  payload: Record<string, any> | null;
  created_at?: string | null;
  order_id?: number | null;
};

// Cheap, no-AI-cost filter: decides whether a message looks sale-related
// enough to be worth a batched extraction call. Mirrors
// shouldAttemptInstagramAutoSale from instagram-auto-sale.ts.
export function shouldAttemptWhatsappAutoSale(message: NormalizedMessage) {
  if (message.channel !== 'whatsapp') return false;
  if (message.direction === 'inbound' && ['image', 'document'].includes(message.message_type)) return true;
  if (!message.text?.trim()) return false;
  if (!['text', 'button', 'interactive'].includes(message.message_type)) return false;

  const text = message.text.trim();
  if (message.direction === 'outbound') return BUSINESS_SALE_SIGNAL.test(text);
  return CUSTOMER_SALE_SIGNAL.test(text)
    || CUSTOMER_FULFILLMENT_SIGNAL.test(text)
    || CUSTOMER_PICKUP_SIGNAL.test(text)
    || CUSTOMER_IDENTITY_SIGNAL.test(text);
}

export function isHumanWhatsappEcho(message: WhatsappMessageRow) {
  if (message.direction !== 'outbound') return false;
  const payload = message.payload && typeof message.payload === 'object' ? message.payload : {};
  return payload.sender_type === 'human' || payload?.raw?.is_echo === true || payload?.source === 'whatsapp_business_app';
}

export function hasBusinessPaymentConfirmation(messages: WhatsappMessageRow[]) {
  return messages.some((message) => {
    if (!isHumanWhatsappEcho(message)) return false;
    return BUSINESS_PAYMENT_CONFIRMED.test(String(message.body || ''));
  });
}

export function hasCustomerNewOrderSignal(messages: WhatsappMessageRow[]) {
  return messages.some((message) => (
    message.direction === 'inbound'
    && CUSTOMER_NEW_ORDER_SIGNAL.test(String(message.body || ''))
  ));
}

export function hasCustomerPickupSignal(messages: WhatsappMessageRow[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.direction !== 'inbound') continue;
    const body = String(message.body || '');
    if (CUSTOMER_PICKUP_SIGNAL.test(body)) return true;
    if (CUSTOMER_FULFILLMENT_SIGNAL.test(body)) return false;
  }
  return false;
}
