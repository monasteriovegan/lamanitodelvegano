import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

const PAYMENT_INTENT = /pagar|pago|mercado\s*pago|flow|transfer|tarjeta|efectivo|cuenta\s+bancaria|medio\s+de\s+pago/i;

export async function loadRemyPaymentContext(db: SupabaseClient, userText: string) {
  if (!PAYMENT_INTENT.test(String(userText || ''))) return '';
  const { data, error } = await db.from('integraciones_secretas')
    .select('flow_enabled,flow_api_key,flow_secret_key,mp_access_token')
    .eq('id', 'global')
    .maybeSingle();
  if (error) throw error;

  const flowReady = Boolean(data?.flow_enabled && String(data?.flow_api_key || '').trim() && String(data?.flow_secret_key || '').trim());
  const mercadoPagoReady = Boolean(String(data?.mp_access_token || '').trim());
  const ready = [mercadoPagoReady ? 'Mercado Pago' : '', flowReady ? 'Flow' : ''].filter(Boolean);

  if (!ready.length) {
    return 'PAGOS: no hay pasarela de pago online configurada actualmente. Para cerrar un pedido usa paymentMethod="whatsapp" y coordina el pago con una persona. No inventes datos bancarios, enlaces ni métodos no verificados.';
  }
  return `PAGOS ONLINE CONFIGURADOS: ${ready.join(', ')}. Solo ofrécelos si el cliente los solicita o al cerrar el pedido. Para transferencia bancaria no hay datos verificados en SynthetiQ: deriva a atención humana.`;
}
