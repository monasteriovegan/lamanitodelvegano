import type { OpportunityStage } from './types';

type OpportunityMessageInput = {
  firstName?: string | null;
  productName?: string | null;
  stage: OpportunityStage;
};

function hello(firstName?: string | null) {
  return firstName ? `Hola ${firstName} 🌱` : 'Hola 🌱';
}

export function buildOpportunityMessage(input: OpportunityMessageInput): string {
  const product = input.productName ? ` ${input.productName}` : ' lo que estabas viendo';
  switch (input.stage) {
    case 'payment_pending':
      return `${hello(input.firstName)} Te escribo por tu pedido${input.productName ? ` de ${input.productName}` : ''}. Si quieres, te ayudo a terminarlo por aquí.`;
    case 'cart_abandoned':
      return `${hello(input.firstName)} Vi que dejaste${product} pendiente. Si quieres, te ayudo a terminar el pedido por aquí.`;
    case 'shipping_or_price_question':
      return `${hello(input.firstName)} Te escribo por${product}. Si todavía te interesa, puedo ayudarte a completar los datos que faltan para tu pedido.`;
    case 'product_interest':
      return `${hello(input.firstName)} Te escribo por${product}. Si todavía te interesa, te ayudo a dejar el pedido listo.`;
    default:
      return `${hello(input.firstName)} Quedó pendiente nuestra conversación. Si todavía quieres comprar, te ayudo a continuar por aquí.`;
  }
}
