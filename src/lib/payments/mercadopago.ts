import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
export { validateMercadoPagoWebhookSignature } from './mercadopago-webhook-signature';

export function mercadoPagoEnvToken() {
  return String(
    process.env.MERCADOPAGO_ACCESS_TOKEN
    || process.env.MERCADO_PAGO_ACCESS_TOKEN
    || process.env.MP_ACCESS_TOKEN
    || '',
  ).trim();
}

export async function resolveMercadoPagoAccessToken(db: SupabaseClient) {
  const envToken = mercadoPagoEnvToken();
  if (envToken) return envToken;
  const { data, error } = await db.from('integraciones_secretas')
    .select('mp_access_token')
    .eq('id', 'global')
    .maybeSingle();
  if (error) throw error;
  return String(data?.mp_access_token || '').trim();
}

export function mercadoPagoWebhookSecret() {
  return String(
    process.env.MERCADOPAGO_WEBHOOK_SECRET
    || process.env.MERCADO_PAGO_WEBHOOK_SECRET
    || process.env.MP_WEBHOOK_SECRET
    || '',
  ).trim();
}

export async function getMercadoPagoPayment(token: string, paymentId: string) {
  const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`mercadopago_payment_lookup_failed:${response.status}`);
  return body as Record<string, any>;
}

export function mapMercadoPagoPaymentStatus(value: unknown): 'pending' | 'paid' | 'failed' | 'refunded' {
  const status = String(value || '').toLowerCase();
  if (status === 'approved') return 'paid';
  if (status === 'refunded' || status === 'charged_back') return 'refunded';
  if (status === 'rejected' || status === 'cancelled') return 'failed';
  return 'pending';
}
