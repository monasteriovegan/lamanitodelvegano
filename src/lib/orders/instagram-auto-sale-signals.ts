import type { NormalizedMessage } from '@/lib/messaging/types';

export const CUSTOMER_SALE_SIGNAL = /confirm(?:o|ar)|quiero\s+comprar|quiero\s+pedir|me\s+llevo|haz(?:me)?\s+el\s+pedido|pedido|transfer(?:encia|[ií])|comprobante|pag(?:o|u[eé]|ado)|direcci[oó]n|despacho|entrega/i;
export const CUSTOMER_NEW_ORDER_SIGNAL = /quiero\s+(?:comprar|pedir|otra|otro)|me\s+llevo|haz(?:me)?\s+el\s+pedido|nuevo\s+pedido|otra\s+(?:barra|caja|box|torta)|otro\s+(?:producto|pedido)/i;
export const CUSTOMER_FULFILLMENT_SIGNAL = /(?:\+?56[\s.\-]*)?9(?:[\s.\-]*\d){8}|calle|avenida|av\.?\s|pasaje|depto|departamento|casa\s|comuna|providencia|ñuñoa|nunoa|macul|la\s+reina|las\s+condes|vitacura|santiago|san\s+miguel|la\s+florida|peñalol[eé]n|penalolen|maip[uú]|pudahuel|quilicura|huechuraba/i;
export const BUSINESS_SALE_SIGNAL = /pedido|confirmad[oa]|agendad[oa]|reservad[oa]|pago|transferencia|recibid[oa]|listo/i;
export const BUSINESS_PAYMENT_CONFIRMED = /(?:pago|transferencia|abono).{0,40}(?:recibid[oa]|confirmad[oa]|correct[oa]|ok)|(?:recibid[oa]|confirmad[oa]).{0,40}(?:pago|transferencia|abono)/i;
const TRANSFER_CONTEXT = /transfer(?:encia|ir|ido)?|deposit(?:o|ar|ado)|datos\s+(?:de\s+)?(?:la\s+)?cuenta|comprobante/i;
const SHORT_CONFIRMATION = /\b(?:confirmad[oa]|recibid[oa]|correct[oa]|todo\s+bien)\b/i;

export type InstagramPaymentMessage = {
  direction: 'inbound' | 'outbound' | string;
  body: string | null;
  message_type?: string | null;
  payload: Record<string, any> | null;
};

export function shouldAttemptInstagramAutoSale(message: NormalizedMessage) {
  if (message.channel !== 'instagram') return false;
  if (message.direction === 'inbound' && ['image', 'document'].includes(message.message_type)) return true;
  if (!message.text?.trim()) return false;
  if (!['text', 'postback'].includes(message.message_type)) return false;

  const text = message.text.trim();
  if (message.direction === 'outbound') return BUSINESS_SALE_SIGNAL.test(text);
  return CUSTOMER_SALE_SIGNAL.test(text) || CUSTOMER_FULFILLMENT_SIGNAL.test(text);
}

export function isHumanInstagramEcho(message: InstagramPaymentMessage) {
  if (message.direction !== 'outbound') return false;
  const payload = message.payload && typeof message.payload === 'object' ? message.payload : {};
  return payload.sender_type === 'human' || payload?.raw?.is_echo === true || payload?.source === 'instagram_business_app';
}

export function hasReceiptBackedBusinessConfirmation(messages: InstagramPaymentMessage[]) {
  const transferContext = messages.some((message) => TRANSFER_CONTEXT.test(String(message.body || '')));
  if (!transferContext) return false;

  let receiptSeen = false;
  for (const message of messages) {
    if (message.direction === 'inbound' && ['image', 'document'].includes(String(message.message_type || ''))) {
      receiptSeen = true;
      continue;
    }
    if (!receiptSeen || !isHumanInstagramEcho(message)) continue;
    if (SHORT_CONFIRMATION.test(String(message.body || ''))) return true;
  }
  return false;
}

export function hasBusinessPaymentConfirmation(messages: InstagramPaymentMessage[]) {
  return messages.some((message) => (
    isHumanInstagramEcho(message)
    && BUSINESS_PAYMENT_CONFIRMED.test(String(message.body || ''))
  )) || hasReceiptBackedBusinessConfirmation(messages);
}

export function hasCustomerNewOrderSignal(messages: InstagramPaymentMessage[]) {
  return messages.some((message) => (
    message.direction === 'inbound'
    && CUSTOMER_NEW_ORDER_SIGNAL.test(String(message.body || ''))
  ));
}
