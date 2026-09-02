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
  items: Array<{ nombre?: string; precio?: number; qty?: number }> | null;
  total: number | null;
  costo_envio: number | null;
  shipping_zone_name: string | null;
};

function defaultOrigin() {
  return runtimeSiteUrl();
}

async function loadOrder(db: SupabaseClient, pedidoId: string | number): Promise<PedidoPago> {
  const id = Number(pedidoId);
  if (!Number.isInteger(id) || id <= 0) throw new Error('invalid_order_id');
  const { data, error } = await db
    .from('pedidos')
    .select('id,nombre_cliente,telefono,customer_email,items,total,costo_envio,shipping_zone_name')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('order_not_found');
  return data as PedidoPago;
}

export async function createPaymentLink(
  db: SupabaseClient,
  input: { pedidoId: string | number; provider: PaymentProvider; origin?: string | null },
) {
  const pedido = await loadOrder(db, input.pedidoId);
  const origin = String(input.origin || defaultOrigin()).replace(/\/$/, '');
  const items = Array.isArray(pedido.items) ? pedido.items : [];

  if (input.provider === 'mercadopago') {
    const token = await resolveMercadoPagoAccessToken(db);
    if (!token) throw new Error('mercadopago_not_configured');

    const mpItems = items.map((item) => ({
      title: String(item.nombre || 'Producto'),
      quantity: Math.max(1, Number(item.qty || 1)),
      unit_price: Number(item.precio || 0),
      currency_id: 'CLP',
    }));
    if (Number(pedido.costo_envio || 0) > 0) {
      mpItems.push({
        title: `Despacho: ${pedido.shipping_zone_name || 'Zona seleccionada'}`,
        quantity: 1,
        unit_price: Number(pedido.costo_envio || 0),
        currency_id: 'CLP',
      });
    }

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
    if (!response.ok || !body?.init_point) throw new Error(`mercadopago_link_failed:${response.status}`);
    return { provider: input.provider, url: String(body.init_point) };
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

  await db.from('pedidos').update({ external_token: String(body.token) }).eq('id', pedido.id);
  return { provider: input.provider, url: `${body.url}?token=${body.token}` };
}
