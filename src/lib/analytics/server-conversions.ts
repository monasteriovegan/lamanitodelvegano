import 'server-only';
import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

type PurchaseItem = {
  productoId?: string | null;
  nombre?: string | null;
  precio?: number | null;
  qty?: number | null;
};

type ConversionEvent = {
  id: string;
  status: string | null;
  provider_results: Record<string, unknown> | null;
  fbc: string | null;
  fbp: string | null;
  landing_url: string | null;
};

function hash(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function normalizedEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function normalizedPhone(value: unknown) {
  const digits = String(value || '').replace(/\D/g, '');
  if (/^9\d{8}$/.test(digits)) return `56${digits}`;
  return digits;
}

function baseUrl() {
  const configured = String(process.env.NEXT_PUBLIC_SITE_URL || '').trim().replace(/\/$/, '');
  if (configured) return configured;
  const production = String(process.env.VERCEL_PROJECT_PRODUCTION_URL || '').trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
  return production ? `https://${production}` : 'https://lamanitodelvegano.cl';
}

async function updateProviderResult(
  db: SupabaseClient,
  conversion: ConversionEvent,
  metaResult: Record<string, unknown>,
  processed: boolean,
) {
  const now = new Date().toISOString();
  const providerResults = {
    ...(conversion.provider_results || {}),
    meta_capi: {
      ...metaResult,
      attempted_at: now,
    },
  };
  const patch: Record<string, unknown> = { provider_results: providerResults };
  if (processed) {
    patch.status = 'processed';
    patch.processed_at = now;
  }
  const { error } = await db.from('conversion_events').update(patch).eq('id', conversion.id);
  if (error) throw error;
}

export async function processPaidPurchaseConversion(db: SupabaseClient, pedidoId: number) {
  if (!Number.isInteger(pedidoId) || pedidoId <= 0) throw new Error('invalid_order_id');

  const { data: pedido, error: orderError } = await db.from('pedidos')
    .select('id,total,currency,payment_status,customer_email,telefono,nombre_cliente,items')
    .eq('id', pedidoId)
    .maybeSingle();
  if (orderError) throw orderError;
  if (!pedido) throw new Error('order_not_found');
  if (String(pedido.payment_status || '') !== 'paid') return { processed: false, reason: 'payment_not_paid' };

  const { data: rawConversion, error: conversionError } = await db.from('conversion_events')
    .select('id,status,provider_results,fbc,fbp,landing_url')
    .eq('order_id', pedidoId)
    .eq('event_name', 'Purchase')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (conversionError) throw conversionError;
  if (!rawConversion) return { processed: false, reason: 'conversion_event_not_found' };
  const conversion = rawConversion as ConversionEvent;

  const existingMeta = conversion.provider_results && typeof conversion.provider_results === 'object'
    ? (conversion.provider_results as Record<string, any>).meta_capi
    : null;
  if (conversion.status === 'processed' && existingMeta?.status === 'success') {
    return { processed: true, alreadyProcessed: true, eventId: existingMeta.event_id };
  }

  const { data: config, error: configError } = await db.from('integraciones_secretas')
    .select('meta_pixel_id')
    .eq('id', 'global')
    .maybeSingle();
  if (configError) throw configError;

  const pixelId = String(config?.meta_pixel_id || '').trim();
  const accessToken = String(process.env.META_CONVERSIONS_API_ACCESS_TOKEN || '').trim();
  if (!/^\d+$/.test(pixelId) || !accessToken) {
    await updateProviderResult(db, conversion, {
      status: 'configuration_missing',
      pixel_configured: /^\d+$/.test(pixelId),
      token_configured: Boolean(accessToken),
    }, false);
    return { processed: false, reason: 'meta_capi_not_configured' };
  }

  const eventId = `purchase_${pedidoId}`;
  const email = normalizedEmail(pedido.customer_email);
  const phone = normalizedPhone(pedido.telefono);
  const firstName = String(pedido.nombre_cliente || '').trim().split(/\s+/)[0]?.toLowerCase() || '';
  const userData: Record<string, unknown> = {};
  if (email) userData.em = [hash(email)];
  if (phone) userData.ph = [hash(phone)];
  if (firstName) userData.fn = [hash(firstName)];
  if (conversion.fbc) userData.fbc = conversion.fbc;
  if (conversion.fbp) userData.fbp = conversion.fbp;

  const items = Array.isArray(pedido.items) ? pedido.items as PurchaseItem[] : [];
  const contentIds = items.map((item) => String(item.productoId || '').trim()).filter(Boolean);
  const graphVersion = String(process.env.META_GRAPH_VERSION || 'v26.0').trim();
  const eventSourceUrl = `${baseUrl()}/pedido/${pedidoId}`;
  const payload: Record<string, unknown> = {
    data: [{
      event_name: 'Purchase',
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId,
      action_source: 'website',
      event_source_url: eventSourceUrl,
      user_data: userData,
      custom_data: {
        value: Number(pedido.total || 0),
        currency: String(pedido.currency || 'CLP').toUpperCase(),
        order_id: String(pedidoId),
        content_type: 'product',
        content_ids: contentIds,
      },
    }],
  };
  const testCode = String(process.env.META_TEST_EVENT_CODE || '').trim();
  if (testCode) payload.test_event_code = testCode;

  const response = await fetch(`https://graph.facebook.com/${graphVersion}/${pixelId}/events`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });
  const body = await response.json().catch(() => ({}));

  if (!response.ok || Number(body?.events_received || 0) < 1) {
    await updateProviderResult(db, conversion, {
      status: 'error',
      event_id: eventId,
      http_status: response.status,
      error: String(body?.error?.message || 'meta_capi_rejected').slice(0, 500),
      error_code: body?.error?.code ?? null,
      fbtrace_id: body?.error?.fbtrace_id ?? null,
    }, false);
    throw new Error(`meta_capi_failed:${response.status}`);
  }

  await updateProviderResult(db, conversion, {
    status: 'success',
    event_id: eventId,
    events_received: Number(body.events_received || 0),
    fbtrace_id: body.fbtrace_id || null,
  }, true);

  return { processed: true, eventId, eventsReceived: Number(body.events_received || 0) };
}
