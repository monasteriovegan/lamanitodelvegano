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
  | { sent: true; eventId: string; duplicate?: boolean }
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
 * Envía Purchase solo después de pago backend-verificado. El event_id es el
 * mismo que usa Pixel y conversion_events funciona además como outbox: un
 * webhook repetido no duplica un evento ya enviado, pero sí reintenta uno que
 * quedó pending/failed por una caída temporal de Meta.
 */
export async function sendPaidPurchaseToMeta(db: SupabaseClient, orderId: string | number): Promise<MetaCapiResult> {
  const accessToken = process.env.META_CONVERSIONS_API_ACCESS_TOKEN?.trim();
  if (!accessToken) return { sent: false, reason: 'not_configured' };

  const [{ data: config }, { data: order }] = await Promise.all([
    db.from('integraciones_secretas').select('meta_pixel_id').eq('id', 'global').maybeSingle(),
    db.from('pedidos')
      .select('id,business_unit_id,customer_id,total,currency,items,customer_email,telefono,payment_status')
      .eq('id', orderId)
      .eq('payment_status', 'paid')
      .maybeSingle(),
  ]);

  const pixelId = String(config?.meta_pixel_id || '').trim();
  if (!pixelId) return { sent: false, reason: 'not_configured' };
  if (!order) return { sent: false, reason: 'order_not_found' };

  const eventId = `purchase_${order.id}`;
  const { data: existingDelivery, error: existingError } = await db
    .from('conversion_events')
    .select('id,status')
    .eq('business_unit_id', order.business_unit_id)
    .eq('event_id', eventId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existingDelivery?.status === 'sent') {
    return { sent: true, eventId, duplicate: true };
  }

  const { data: attribution, error: attributionError } = await db
    .from('conversion_events')
    .select('fbclid,fbc,fbp,gclid,gbraid,wbraid,utm_source,utm_medium,utm_campaign,utm_content,utm_term,landing_url,referrer,cart_id')
    .eq('order_id', order.id)
    .eq('event_name', 'InitiateCheckout')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (attributionError) throw attributionError;

  const eventRow = {
    event_id: eventId,
    business_unit_id: order.business_unit_id,
    customer_id: order.customer_id || null,
    cart_id: attribution?.cart_id || null,
    order_id: Number(order.id),
    event_name: 'Purchase',
    source_channel: 'web',
    value: Number(order.total || 0),
    currency: String(order.currency || 'CLP').toUpperCase(),
    fbclid: attribution?.fbclid || null,
    fbc: attribution?.fbc || null,
    fbp: attribution?.fbp || null,
    gclid: attribution?.gclid || null,
    gbraid: attribution?.gbraid || null,
    wbraid: attribution?.wbraid || null,
    utm_source: attribution?.utm_source || null,
    utm_medium: attribution?.utm_medium || null,
    utm_campaign: attribution?.utm_campaign || null,
    utm_content: attribution?.utm_content || null,
    utm_term: attribution?.utm_term || null,
    landing_url: attribution?.landing_url || null,
    referrer: attribution?.referrer || null,
    status: 'pending',
    provider_results: {},
  };

  if (existingDelivery?.id) {
    const { error } = await db.from('conversion_events').update({ status: 'pending', provider_results: {} }).eq('id', existingDelivery.id);
    if (error) throw error;
  } else {
    const { error } = await db.from('conversion_events').insert(eventRow);
    if (error) throw error;
  }

  const items = (Array.isArray(order.items) ? order.items : []) as PurchaseItem[];
  const contents = items.flatMap((item) => {
    const id = item.sku || item.variantSku || item.variant_sku || item.productoId || item.producto_id || item.id;
    if (!id) return [];
    return [{ id: String(id), quantity: Number(item.qty ?? item.quantity ?? 1) }];
  });
  const emailHash = normalizedHash(order.customer_email);
  const phoneHash = normalizedPhoneHash(order.telefono);
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
            order_id: String(order.id),
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
    await db.from('conversion_events').update({
      status: 'failed',
      provider_results: { meta_capi: { status: 'network_error' } },
    }).eq('business_unit_id', order.business_unit_id).eq('event_id', eventId);
    console.error('meta_capi_purchase_failed', { orderId: String(order.id), status: 'network_error' });
    return { sent: false, reason: 'request_failed' };
  }

  if (!response.ok) {
    await db.from('conversion_events').update({
      status: 'failed',
      provider_results: { meta_capi: { status: response.status } },
    }).eq('business_unit_id', order.business_unit_id).eq('event_id', eventId);
    console.error('meta_capi_purchase_failed', { orderId: String(order.id), status: response.status });
    return { sent: false, reason: 'request_failed' };
  }

  const { error: sentError } = await db.from('conversion_events').update({
    status: 'sent',
    processed_at: new Date().toISOString(),
    provider_results: { meta_capi: { status: response.status } },
  }).eq('business_unit_id', order.business_unit_id).eq('event_id', eventId);
  if (sentError) throw sentError;

  return { sent: true, eventId };
}
