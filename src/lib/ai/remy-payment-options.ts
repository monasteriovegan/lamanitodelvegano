export type RemyOnlinePaymentMethod = 'mercadopago' | 'flow';

export function configuredOnlinePaymentMethods(input: {
  mercadoPagoReady: boolean;
  flowReady: boolean;
}): RemyOnlinePaymentMethod[] {
  const methods: RemyOnlinePaymentMethod[] = [];
  if (input.mercadoPagoReady) methods.push('mercadopago');
  if (input.flowReady) methods.push('flow');
  return methods;
}

export function paymentMethodQuestion(methods: readonly RemyOnlinePaymentMethod[]) {
  if (methods.length === 0) {
    return 'No hay una pasarela online verificada disponible ahora. ¿Quieres que te derive al equipo por WhatsApp para coordinar el pago?';
  }
  if (methods.length === 1 && methods[0] === 'mercadopago') {
    return 'El medio online disponible es Mercado Pago. ¿Quieres pagar por Mercado Pago?';
  }
  if (methods.length === 1 && methods[0] === 'flow') {
    return 'El medio online disponible es Flow. ¿Quieres pagar por Flow?';
  }
  return 'Puedes pagar online por Mercado Pago o Flow. ¿Cuál prefieres?';
}
