export type RemyToolEvidence = {
  tool: string;
  sideEffect: boolean;
  success: boolean;
  reason: string | null;
};

const SIMPLE_MUTATIONS = new Set(['cart_add', 'cart_remove', 'cart_clear', 'checkout_update']);

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

export function isRemySideEffectTool(name: string) {
  return SIMPLE_MUTATIONS.has(name) || name === 'order_create' || name === 'payment_link';
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
