export type ConversationOrderReferenceMessage = {
  direction: string;
  body?: string | null;
};

const CUSTOMER_ORDER_REFERENCE = /\bpedido\s*(?:n(?:ro|úmero)?\.?\s*)?#?\s*(\d{1,9})\b/iu;
const MONEY_LIKE = /\$?\s*(\d{1,3}(?:[.\s]\d{3})+|\d{4,9})\b/g;

export function findCustomerReferencedOrderId(messages: ConversationOrderReferenceMessage[]): number | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.direction !== 'inbound') continue;
    const match = CUSTOMER_ORDER_REFERENCE.exec(String(message.body || ''));
    if (!match) continue;
    const orderId = Number(match[1]);
    if (Number.isInteger(orderId) && orderId > 0) return orderId;
  }
  return null;
}

export function customerMessagesMentionAmount(
  messages: ConversationOrderReferenceMessage[],
  expectedAmount: number,
): boolean {
  const expected = Math.round(Number(expectedAmount || 0));
  if (!Number.isFinite(expected) || expected <= 0) return false;

  return messages.some((message) => {
    if (message?.direction !== 'inbound') return false;
    const body = String(message.body || '');
    for (const match of body.matchAll(MONEY_LIKE)) {
      const parsed = Number(String(match[1] || '').replace(/[.\s]/g, ''));
      if (parsed === expected) return true;
    }
    return false;
  });
}
