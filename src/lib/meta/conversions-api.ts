import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { runtimeSiteUrl } from '../site-url.ts';

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
  let resolvedItems = items;
  const missingSku = items.some((i) => !i.sku && !i.variantSku && !i.variant_sku);
  if (missingSku && items.length > 0) {
    const productIds = items.map((i) => i.productoId || i.producto_id || i.id).filter(Boolean) as string[];
    const variantIds = items.map((i: any) => i.variantId || i.variant_id).filter(Boolean) as string[];
    const [prodsRes, varsRes] = await Promise.all([
      productIds.length > 0 ? db.from('productos').select('id,sku').in('id', productIds) : { data: [] },
      variantIds.length > 0 ? db.from('product_variants').select('id,sku').in('id', variantIds) : { data: [] },
    ]);
    const prodMap = new Map((prodsRes.data || []).map((p: any) => [p.id, p.sku]));
    const varMap = new Map((varsRes.data || []).map((v: any) => [v.id, v.sku]));
    resolvedItems = items.map((i: any) => {
      const sku =
        i.sku ||
        i.variantSku ||
        i.variant_sku ||
        (i.variantId ? varMap.get(i.variantId) : null) ||
        (i.variant_id ? varMap.get(i.variant_id) : null) ||
        (i.productoId ? prodMap.get(i.productoId) : null) ||
        (i.producto_id ? prodMap.get(i.producto_id) : null) ||
        (i.id ? prodMap.get(i.id) : null) ||
        i.productoId ||
        i.producto_id ||
        i.id;
      return { ...i, sku };
    });
  }

  const contents = resolvedItems.flatMap((item) => {
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
    const metaCapiPayload = {
      http_status: 0,
      status: 'network_error',
      accepted: false,
      events_received: 0,
      messages: ['network_error'],
      fbtrace_id: null,
      timestamp: new Date().toISOString(),
      order_id: Number(order.id),
      event_id: eventId,
    };
    await db.from('conversion_events').update({
      status: 'failed',
      provider_results: { meta_capi: metaCapiPayload },
    }).eq('business_unit_id', order.business_unit_id).eq('event_id', eventId);
    console.error('meta_capi_purchase_failed', { orderId: String(order.id), status: 'network_error' });
    return { sent: false, reason: 'request_failed' };
  }

  let responseData: any = null;
  try {
    responseData = await response.json();
  } catch {
    responseData = null;
  }

  if (!response.ok) {
    const metaCapiPayload = {
      http_status: response.status,
      status: response.status,
      accepted: false,
      events_received: Number(responseData?.events_received || 0),
      messages: Array.isArray(responseData?.messages)
        ? responseData.messages
        : responseData?.error?.message
        ? [responseData.error.message]
        : [],
      fbtrace_id: responseData?.fbtrace_id || responseData?.error?.fbtrace_id || null,
      timestamp: new Date().toISOString(),
      order_id: Number(order.id),
      event_id: eventId,
    };
    await db.from('conversion_events').update({
      status: 'failed',
      provider_results: { meta_capi: metaCapiPayload },
    }).eq('business_unit_id', order.business_unit_id).eq('event_id', eventId);
    console.error('meta_capi_purchase_failed', { orderId: String(order.id), status: response.status });
    return { sent: false, reason: 'request_failed' };
  }

  const metaCapiPayload = {
    http_status: response.status,
    status: response.status,
    accepted: true,
    events_received: Number(responseData?.events_received ?? 1),
    messages: Array.isArray(responseData?.messages) ? responseData.messages : [],
    fbtrace_id: responseData?.fbtrace_id || null,
    timestamp: new Date().toISOString(),
    order_id: Number(order.id),
    event_id: eventId,
  };

  const { error: sentError } = await db.from('conversion_events').update({
    status: 'sent',
    processed_at: new Date().toISOString(),
    provider_results: { meta_capi: metaCapiPayload },
  }).eq('business_unit_id', order.business_unit_id).eq('event_id', eventId);
  if (sentError) throw sentError;

  return { sent: true, eventId };
}
