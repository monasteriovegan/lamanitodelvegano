import type { NormalizedMessage } from '@/lib/messaging/types';

// Pure, dependency-free signal detection for the WhatsApp auto-sale filter.
// Split out from whatsapp-auto-sale.ts so it can be imported and unit-tested
// directly (that file pulls in conversation-sale.ts / orders-repository.ts,
// which touch Supabase and can't be executed outside the app runtime).

export const CUSTOMER_SALE_SIGNAL = /confirm(?:o|ar)|quiero\s+comprar|me\s+llevo|haz(?:me)?\s+el\s+pedido|pedido|transfer(?:encia|[ií])|comprobante|pag(?:o|u[eé]|ado)|direcci[oó]n|despacho|entrega/i;
export const CUSTOMER_NEW_ORDER_SIGNAL = /quiero\s+(?:comprar|pedir|otra|otro)|me\s+llevo|haz(?:me)?\s+el\s+pedido|nuevo\s+pedido|otra\s+(?:barra|caja|box)|otro\s+(?:producto|pedido)/i;
export const CUSTOMER_FULFILLMENT_SIGNAL = /calle|avenida|av\.?\s|pasaje|depto|departamento|casa\s|comuna|providencia|ñuñoa|nunoa|macul|la\s+reina|las\s+condes|vitacura|santiago|san\s+miguel|la\s+florida|peñalol[eé]n|penalolen|maip[uú]|pudahuel|quilicura|huechuraba/i;
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
  if (message.channel !== 'whatsapp' || !message.text?.trim()) return false;
  if (!['text', 'button', 'interactive'].includes(message.message_type)) return false;

  const text = message.text.trim();
  if (message.direction === 'outbound') return BUSINESS_SALE_SIGNAL.test(text);
  return CUSTOMER_SALE_SIGNAL.test(text) || CUSTOMER_FULFILLMENT_SIGNAL.test(text);
}

export function isHumanWhatsappEcho(message: WhatsappMessageRow) {
  if (message.direction !== 'outbound') return false;
  const payload = message.payload && typeof message.payload === 'object' ? message.payload : {};
  return payload.sender_type === 'human' || payload?.raw?.is_echo === true;
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
