import 'server-only';
import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveMercadoPagoAccessToken } from './mercadopago';
import { runtimeSiteUrl } from '@/lib/site-url';

export type PaymentProvider = 'mercadopago' | 'flow';

type PedidoPago = {
  id: number;
  nombre_cliente: string | null;
  telefono: string | null;
  customer_email: string | null;
  total: number | null;
  external_token: string | null;
  payment_status: string | null;
  metodopago: string | null;
};

function defaultOrigin() {
  return runtimeSiteUrl();
}

async function loadOrder(db: SupabaseClient, pedidoId: string | number): Promise<PedidoPago> {
  const id = Number(pedidoId);
  if (!Number.isInteger(id) || id <= 0) throw new Error('invalid_order_id');
  const { data, error } = await db
    .from('pedidos')
    .select('id,nombre_cliente,telefono,customer_email,total,external_token,payment_status,metodopago')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('order_not_found');
  if (!Number.isFinite(Number(data.total)) || Number(data.total) <= 0) throw new Error('invalid_order_total');
  return data as PedidoPago;
}

async function existingMercadoPagoPreference(token: string, externalToken: string | null) {
  const preferenceId = String(externalToken || '').startsWith('mp_pref:')
    ? String(externalToken).slice('mp_pref:'.length)
    : '';
  if (!preferenceId) return null;
  const response = await fetch(`https://api.mercadopago.com/checkout/preferences/${encodeURIComponent(preferenceId)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!response.ok) return null;
  const body = await response.json().catch(() => ({}));
  return body?.init_point ? String(body.init_point) : null;
}

export async function createPaymentLink(
  db: SupabaseClient,
  input: { pedidoId: string | number; provider: PaymentProvider; origin?: string | null },
) {
  const pedido = await loadOrder(db, input.pedidoId);
  const origin = String(input.origin || defaultOrigin()).replace(/\/$/, '');
  if (pedido.payment_status === 'paid') throw new Error('payment_already_paid');

  if (input.provider === 'mercadopago') {
    if (String(pedido.metodopago || '').toLowerCase() !== 'mercadopago') throw new Error('payment_method_mismatch');
    const token = await resolveMercadoPagoAccessToken(db);
    if (!token) throw new Error('mercadopago_not_configured');

    const existingUrl = await existingMercadoPagoPreference(token, pedido.external_token);
    if (existingUrl) return { provider: input.provider, url: existingUrl, reused: true };

    // El proveedor cobra exactamente el total canónico persistido por servidor.
    // No reconstruimos el monto desde líneas porque despacho/cupones/fidelidad ya
    // están incluidos en pedidos.total.
    const mpItems = [{
      title: `Pedido #${pedido.id} - La Manito Del Vegano`,
      quantity: 1,
      unit_price: Number(pedido.total),
      currency_id: 'CLP',
    }];

    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: mpItems,
        payer: {
          name: pedido.nombre_cliente || undefined,
          email: pedido.customer_email || undefined,
          phone: pedido.telefono ? { number: pedido.telefono } : undefined,
        },
        back_urls: {
          success: `${origin}/pedido/${pedido.id}?status=success`,
          failure: `${origin}/pedido/${pedido.id}?status=failure`,
          pending: `${origin}/pedido/${pedido.id}?status=pending`,
        },
        notification_url: `${origin}/api/pagos/mercadopago-webhook`,
        auto_return: 'approved',
        external_reference: String(pedido.id),
      }),
      cache: 'no-store',
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body?.init_point || !body?.id) throw new Error(`mercadopago_link_failed:${response.status}`);

    const { error: tokenError } = await db.from('pedidos')
      .update({ external_token: `mp_pref:${String(body.id)}` })
      .eq('id', pedido.id)
      .neq('payment_status', 'paid');
    if (tokenError) throw tokenError;

    return { provider: input.provider, url: String(body.init_point), reused: false };
  }

  const { data: config } = await db
    .from('integraciones_secretas')
    .select('flow_enabled,flow_sandbox,flow_api_key,flow_secret_key')
    .eq('id', 'global')
    .maybeSingle();
  if (!config?.flow_enabled || !config.flow_api_key || !config.flow_secret_key) throw new Error('flow_not_configured');

  const params: Record<string, string> = {
    amount: String(Number(pedido.total || 0)),
    apiKey: String(config.flow_api_key).trim(),
    commerceOrder: String(pedido.id),
    email: pedido.customer_email || 'cliente@lamanitodelvegano.cl',
    subject: `Pedido #${String(pedido.id)} - La Manito Del Vegano`,
    urlConfirmation: `${origin}/api/pagos/flow-confirm`,
    urlReturn: `${origin}/pedido/${pedido.id}?status=success`,
  };
  const signatureBase = Object.keys(params).sort().map((key) => key + params[key]).join('');
  params.s = crypto.createHmac('sha256', String(config.flow_secret_key).trim()).update(signatureBase).digest('hex');

  const response = await fetch(config.flow_sandbox ? 'https://sandbox.flow.cl/api/payment/create' : 'https://www.flow.cl/api/payment/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
    cache: 'no-store',
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body?.url || !body?.token) throw new Error(`flow_link_failed:${response.status}`);

  const { error: tokenError } = await db.from('pedidos').update({ external_token: String(body.token) }).eq('id', pedido.id);
  if (tokenError) throw tokenError;
  return { provider: input.provider, url: `${body.url}?token=${body.token}` };
}
