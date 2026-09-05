import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveMercadoPagoAccessToken } from '@/lib/payments/mercadopago';
import {
  configuredOnlinePaymentMethods,
  type RemyOnlinePaymentMethod,
} from '@/lib/ai/remy-payment-options';

const PAYMENT_INTENT = /pagar|pago|mercado\s*pago|flow|transfer|tarjeta|efectivo|cuenta\s+bancaria|medio\s+de\s+pago/i;

export async function loadConfiguredRemyPaymentMethods(db: SupabaseClient): Promise<RemyOnlinePaymentMethod[]> {
  const [{ data, error }, mercadoPagoToken] = await Promise.all([
    db.from('integraciones_secretas')
      .select('flow_enabled,flow_api_key,flow_secret_key')
      .eq('id', 'global')
      .maybeSingle(),
    resolveMercadoPagoAccessToken(db),
  ]);
  if (error) throw error;

  const flowReady = Boolean(
    data?.flow_enabled
    && String(data?.flow_api_key || '').trim()
    && String(data?.flow_secret_key || '').trim(),
  );
  const mercadoPagoReady = Boolean(String(mercadoPagoToken || '').trim());
  return configuredOnlinePaymentMethods({ mercadoPagoReady, flowReady });
}

export async function loadRemyPaymentContext(db: SupabaseClient, userText: string) {
  if (!PAYMENT_INTENT.test(String(userText || ''))) return '';
  const methods = await loadConfiguredRemyPaymentMethods(db);
  const mercadoPagoReady = methods.includes('mercadopago');
  const flowReady = methods.includes('flow');
  const ready = [mercadoPagoReady ? 'Mercado Pago' : '', flowReady ? 'Flow' : ''].filter(Boolean);

  if (!ready.length) {
    return 'PAGOS: no hay pasarela de pago online configurada actualmente. Para cerrar un pedido usa paymentMethod="whatsapp" y coordina el pago con una persona. No inventes datos bancarios, enlaces ni métodos no verificados.';
  }

  const emailRule = mercadoPagoReady && flowReady
    ? 'No pidas email para Mercado Pago; Flow sí puede requerir email.'
    : mercadoPagoReady
      ? 'Mercado Pago no requiere email como dato obligatorio del checkout; no lo pidas salvo que el cliente quiera entregarlo.'
      : 'Flow requiere email para completar el checkout.';

  return `PAGOS ONLINE CONFIGURADOS: ${ready.join(', ')}. ${emailRule} Solo ofrécelos si el cliente los solicita o al cerrar el pedido. Para transferencia bancaria no hay datos verificados en SynthetiQ: deriva a atención humana.`;
}
