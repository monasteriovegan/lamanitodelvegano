import type { OpportunityDecision, OpportunityDetectionInput, OpportunityPriority, OpportunityStage } from './types';

const STAGE_SCORE: Record<OpportunityStage, number> = {
  payment_pending: 100,
  cart_abandoned: 85,
  shipping_or_price_question: 65,
  product_interest: 45,
  general_interest: 20,
};

function priorityFor(score: number): OpportunityPriority {
  if (score >= 80) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

export function detectOpportunity(input: OpportunityDetectionInput): OpportunityDecision | null {
  if (input.hasPaidOrder || input.optedOut || input.rejected || input.humanTakeover || input.personal) return null;

  let stage: OpportunityStage;
  let reasonCode: string;
  let reasonSummary: string;

  if (input.hasUnpaidOrder) {
    stage = 'payment_pending';
    reasonCode = 'unpaid_order';
    reasonSummary = 'Existe un pedido iniciado que todavía no figura pagado.';
  } else if (input.hasCart) {
    stage = 'cart_abandoned';
    reasonCode = 'cart_abandoned';
    reasonSummary = 'Existe un carrito con productos y la conversación quedó inactiva.';
  } else if ((input.askedPrice || input.askedShipping) && input.productMentioned) {
    stage = 'shipping_or_price_question';
    reasonCode = input.askedShipping && input.askedPrice ? 'price_and_shipping_question' : input.askedShipping ? 'shipping_question' : 'price_question';
    reasonSummary = 'El cliente consultó información clave de compra sobre un producto concreto.';
  } else if (input.productMentioned) {
    stage = 'product_interest';
    reasonCode = 'product_interest';
    reasonSummary = 'El cliente mostró interés en un producto concreto y no continuó.';
  } else {
    stage = 'general_interest';
    reasonCode = 'general_interest';
    reasonSummary = 'La conversación tiene interés comercial general y quedó sin continuación.';
  }

  const strongCommercialBonus = stage === 'shipping_or_price_question'
    ? (input.askedPrice ? 10 : 0) + (input.askedShipping ? 10 : 0)
    : 0;
  const score = STAGE_SCORE[stage] + strongCommercialBonus + (input.adSource ? 5 : 0);
  return {
    stage,
    score,
    priority: priorityFor(score),
    reasonCode,
    reasonSummary,
    sourceType: input.adSource ? 'ad' : 'unknown',
  };
}
