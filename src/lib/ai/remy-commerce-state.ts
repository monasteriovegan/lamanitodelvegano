export type RemyCommerceStage =
  | 'discover'
  | 'cart'
  | 'delivery'
  | 'details'
  | 'review'
  | 'confirmed'
  | 'payment'
  | 'post_sale';

export type RemyCheckoutFacts = {
  nombre?: string | null;
  direccion?: string | null;
  comuna?: string | null;
  phone?: string | null;
  email?: string | null;
  zonaId?: string | null;
  deliveryDate?: string | null;
  paymentMethod?: string | null;
};

export type RemyCommerceFacts = {
  itemsCount: number;
  checkout?: RemyCheckoutFacts | null;
  orderId?: string | number | null;
  paymentUrl?: string | null;
  paymentStatus?: string | null;
  persistedStage?: RemyCommerceStage | null;
};

const TERMINAL_PAYMENT_STATUSES = new Set([
  'paid',
  'approved',
  'completed',
  'refunded',
  'cancelled',
  'canceled',
]);

function present(value: unknown) {
  return String(value ?? '').trim().length > 0;
}

/**
 * Resolve Remy's commerce stage strictly from persisted facts. The model never
 * decides this state on its own.
 */
export function resolveCommerceStage(facts: RemyCommerceFacts): RemyCommerceStage {
  const paymentStatus = String(facts.paymentStatus || '').trim().toLowerCase();
  if (facts.orderId && TERMINAL_PAYMENT_STATUSES.has(paymentStatus)) return 'post_sale';

  if (facts.orderId) {
    if (present(facts.paymentUrl)) return 'payment';
    return 'confirmed';
  }

  const checkout = facts.checkout || {};
  const itemsCount = Math.max(0, Number(facts.itemsCount || 0));
  if (!itemsCount) return 'discover';

  const deliveryStarted = present(checkout.comuna)
    || present(checkout.zonaId)
    || present(checkout.deliveryDate)
    || present(checkout.direccion);
  const deliveryComplete = present(checkout.direccion)
    && present(checkout.comuna)
    && present(checkout.zonaId)
    && present(checkout.deliveryDate);

  if (!deliveryStarted) return 'cart';
  if (!deliveryComplete) return 'delivery';

  const paymentMethod = String(checkout.paymentMethod || '').trim().toLowerCase();
  const customerComplete = present(checkout.nombre)
    && present(checkout.phone)
    && present(checkout.paymentMethod)
    && (paymentMethod !== 'flow' || present(checkout.email));

  if (!customerComplete) return 'details';
  return 'review';
}

export function commerceStageMetadata(
  metadata: Record<string, unknown> | null | undefined,
  stage: RemyCommerceStage,
  now = new Date().toISOString(),
) {
  const current = metadata && typeof metadata === 'object' ? metadata : {};
  if (current.commerce_stage === stage) return current;
  return {
    ...current,
    commerce_stage: stage,
    commerce_stage_updated_at: now,
  };
}
