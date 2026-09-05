export type RemyToolEvidence = {
  tool: string;
  sideEffect: boolean;
  success: boolean;
  reason: string | null;
};

const SIMPLE_MUTATIONS = new Set(['cart_add', 'cart_remove', 'cart_clear', 'checkout_update']);
const CART_CLEAR_INTENT = /(?:vac[ií]a|vaciar|limpia|limpiar|borra|borrar|elimina|eliminar).{0,20}carrito|carrito.{0,20}(?:vac[ií]o|vaciar|limpia|limpiar|borra|borrar)/i;
const CART_REMOVE_INTENT = /(?:quita|quitar|saca|sacar|elimina|eliminar|borra|borrar).{0,45}(?:carrito|unidad|producto|empanad|alfajor|barra|bomb[oó]n|trufa|box|pack)/i;
const CART_ADD_INTENT = /(?:agrega|agregar|a[nñ]ade|a[nñ]adir|ponme|dame|quiero\s+(?:comprar\s+)?(?:uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|\d+)).{0,70}/i;
const ORDER_CONFIRM_INTENT = /confirmo(?:\s+el)?\s+pedido|confirmar(?:\s+el)?\s+pedido|haz(?:me)?\s+el\s+pedido|hacer\s+el\s+pedido|procesa(?:r)?\s+el\s+pedido|finaliza(?:r)?\s+el\s+pedido|dale\s+con\s+el\s+pedido|s[ií][,\s]+(?:confirmo|haz|procesa|finaliza)/i;
const PAYMENT_LINK_INTENT = /(?:link|enlace|url).{0,30}(?:pago|pagar)|(?:pago|pagar).{0,30}(?:link|enlace|url)/i;
const SHORT_CONFIRM = /^(?:s[ií]|dale|ok|okay|ya|por\s*favor|confirmo|hazlo|vamos)$/i;
const PRIOR_ORDER_CONFIRM = /(?:confirm|finaliz|crear|hacer|procesar).{0,50}pedido|pedido.{0,50}(?:confirm|finaliz|crear|hacer|procesar)/i;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

export function isRemySideEffectTool(name: string) {
  return SIMPLE_MUTATIONS.has(name) || name === 'order_create' || name === 'payment_link';
}

export function requiredRemySideEffect(userText: string, previousAssistantText = ''): string | null {
  const text = String(userText || '').trim();
  if (!text) return null;
  if (PAYMENT_LINK_INTENT.test(text)) return 'payment_link';
  if (CART_CLEAR_INTENT.test(text)) return 'cart_clear';
  if (CART_REMOVE_INTENT.test(text)) return 'cart_remove';
  if (ORDER_CONFIRM_INTENT.test(text)) return 'order_create';
  if (SHORT_CONFIRM.test(text) && PRIOR_ORDER_CONFIRM.test(String(previousAssistantText || ''))) return 'order_create';
  if (CART_ADD_INTENT.test(text)) return 'cart_add';
  return null;
}

/**
 * Converts raw tool output into the evidence Remy is allowed to claim to the
 * customer. This is deliberately stricter than "the tool returned".
 */
export function evaluateRemyToolEvidence(name: string, value: unknown): RemyToolEvidence {
  if (!isRemySideEffectTool(name)) {
    return { tool: name, sideEffect: false, success: true, reason: null };
  }

  const result = record(value);
  if (result.ok !== true) {
    return {
      tool: name,
      sideEffect: true,
      success: false,
      reason: String(result.reason || result.error || 'operation_not_confirmed'),
    };
  }

  if (name === 'order_create' && !String(result.orderId || '').trim()) {
    return { tool: name, sideEffect: true, success: false, reason: 'order_id_missing' };
  }

  if (name === 'payment_link' && !String(result.paymentUrl || '').trim()) {
    return { tool: name, sideEffect: true, success: false, reason: 'payment_url_missing' };
  }

  return { tool: name, sideEffect: true, success: true, reason: null };
}

export function compactRemyEvidence(evidence: RemyToolEvidence[]) {
  return evidence.map((item) => ({
    tool: item.tool,
    success: item.success,
    ...(item.reason ? { reason: item.reason } : {}),
  }));
}
