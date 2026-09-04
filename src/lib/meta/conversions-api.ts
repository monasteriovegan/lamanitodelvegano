import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { runtimeSiteUrl } from '@/lib/site-url';

type PurchaseItem = {
  sku?: string;
  variantSku?: string;
  variant_sku?: string;
  productoId?: string;
  producto_id?: string;
  id?: string;
  nombre?: string;
  name?: string;
  precio?: number;
  price?: number;
  qty?: number;
  quantity?: number;
};

export type MetaCapiResult =
  | { sent: true; eventId: string }
  | { sent: false; reason: 'not_configured' | 'order_not_found' | 'request_failed' };

function normalizedHash(value: unknown) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized ? crypto.createHash('sha256').update(normalized).digest('hex') : undefined;
}

function normalizedPhoneHash(value: unknown) {
  const normalized = String(value || '').replace(/\D/g, '');
  return normalized ? crypto.createHash('sha256').update(normalized).digest('hex') : undefined;
}

/**
 * Envía Purchase solo después de que el backend confirmó el pago. El token de
 * CAPI es deliberadamente independiente del token de mensajería guardado en DB.
 */
export async function sendPaidPurchaseToMeta(db: SupabaseClient, orderId: string | number): Promise<MetaCapiResult> {
  const accessToken = process.env.META_CONVERSIONS_API_ACCESS_TOKEN?.trim();
  if (!accessToken) return { sent: false, reason: 'not_configured' };

  const [{ data: config }, { data: order }, { data: attribution }] = await Promise.all([
    db.from('integraciones_secretas').select('meta_pixel_id').eq('id', 'global').maybeSingle(),
    db.from('pedidos')
      .select('id,total,currency,items,customer_email,cliente,payment_status')
      .eq('id', orderId)
      .eq('payment_status', 'paid')
      .maybeSingle(),
    db.from('conversion_events')
      .select('fbclid,fbc,fbp,landing_url')
      .eq('order_id', orderId)
      .maybeSingle(),
  ]);

  const pixelId = String(config?.meta_pixel_id || '').trim();
  if (!pixelId) return { sent: false, reason: 'not_configured' };
  if (!order) return { sent: false, reason: 'order_not_found' };

  const eventId = `purchase_${order.id}`;
  const items = (Array.isArray(order.items) ? order.items : []) as PurchaseItem[];
  const contents = items.flatMap((item) => {
    const id = item.sku || item.variantSku || item.variant_sku || item.productoId || item.producto_id || item.id;
    if (!id) return [];
    return [{ id: String(id), quantity: Number(item.qty ?? item.quantity ?? 1) }];
  });
  const customer = order.cliente && typeof order.cliente === 'object' ? order.cliente as Record<string, unknown> : {};
  const emailHash = normalizedHash(order.customer_email || customer.email);
  const phoneHash = normalizedPhoneHash(customer.telefono || customer.phone);
  const userData = {
    em: emailHash ? [emailHash] : undefined,
    ph: phoneHash ? [phoneHash] : undefined,
    fbp: attribution?.fbp || undefined,
    fbc: attribution?.fbc || undefined,
  };

  const version = process.env.META_GRAPH_VERSION || 'v26.0';
  let response: Response;
  try {
    response = await fetch(`https://graph.facebook.com/${version}/${pixelId}/events`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: [{
          event_name: 'Purchase',
          event_time: Math.floor(Date.now() / 1000),
          event_id: eventId,
          action_source: 'website',
          event_source_url: attribution?.landing_url || `${runtimeSiteUrl()}/pedido/${order.id}`,
          user_data: userData,
          custom_data: {
            currency: String(order.currency || 'CLP').toUpperCase(),
            value: Number(order.total || 0),
            content_type: 'product',
            content_ids: contents.map((item) => item.id),
            contents,
          },
        }],
        ...(process.env.META_TEST_EVENT_CODE ? { test_event_code: process.env.META_TEST_EVENT_CODE } : {}),
      }),
      cache: 'no-store',
    });
  } catch {
    console.error('meta_capi_purchase_failed', { orderId: String(order.id), status: 'network_error' });
    return { sent: false, reason: 'request_failed' };
  }

  if (!response.ok) {
    console.error('meta_capi_purchase_failed', { orderId: String(order.id), status: response.status });
    return { sent: false, reason: 'request_failed' };
  }
  return { sent: true, eventId };
}
