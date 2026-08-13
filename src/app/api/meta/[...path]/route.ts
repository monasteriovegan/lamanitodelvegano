import { POST as handleLocalWhatsAppWebhook } from '@/app/api/whatsapp/route';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { normalizeMetaInstagram } from '@/lib/messaging/normalize';
import { persistMessage } from '@/lib/messaging/messages';
import { verifyHmac } from '@/lib/messaging/signature';

const UPSTREAM_ENV_NAME = 'META_PROXY_UPSTREAM_URL';

const EXACT_ROUTES: Record<string, string> = {
  health: '/health',
  'oauth/start': '/oauth/meta/start',
  'oauth/callback': '/oauth/meta/callback',
  'webhooks/meta': '/webhooks/meta',
  'webhooks/whatsapp': '/webhooks/whatsapp',
  'webhooks/messaging': '/webhooks/messaging',
  'webhooks/leads': '/webhooks/leads',
  'assets/pages': '/api/meta/assets/pages',
  'assets/ad-accounts': '/api/meta/assets/ad-accounts',
  'assets/whatsapp-business-accounts': '/api/meta/assets/whatsapp-business-accounts',
  'assets/whatsapp-phone-numbers': '/api/meta/assets/whatsapp-phone-numbers',
  campaigns: '/api/meta/campaigns',
  insights: '/api/meta/insights',
  messages: '/api/meta/messages',
  'crm/leads/sync': '/api/crm/leads/sync',
};

const REQUEST_HEADERS = [
  'accept',
  'authorization',
  'content-type',
  'cookie',
  'user-agent',
  'x-hub-signature-256',
];

const RESPONSE_HEADERS = [
  'cache-control',
  'content-type',
  'location',
  'retry-after',
  'set-cookie',
  'www-authenticate',
];

type RouteContext = { params: Promise<{ path: string[] }> };

function localWhatsAppRequest(
  incomingUrl: URL,
  request: Request,
  requestBody: Uint8Array,
) {
  const localHeaders = new Headers();
  for (const name of ['content-type', 'user-agent', 'x-hub-signature-256']) {
    const value = request.headers.get(name);
    if (value) localHeaders.set(name, value);
  }

  return new Request(new URL('/api/whatsapp', incomingUrl.origin), {
    method: 'POST',
    headers: localHeaders,
    body: requestBody,
  });
}

async function persistInstagramMessagingPayload(request: Request, requestBody: Uint8Array) {
  const raw = new TextDecoder().decode(requestBody);
  if (!verifyHmac(raw, request.headers.get('x-hub-signature-256'), process.env.META_APP_SECRET)) {
    return { handled: true, response: Response.json({ error: 'invalid_signature' }, { status: 401 }) };
  }

  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    return { handled: true, response: Response.json({ error: 'invalid_json' }, { status: 400 }) };
  }

  // The historical messaging callback is shared by Instagram and Page events.
  // Only consume the Instagram object locally; Page/Messenger continues to the
  // legacy upstream untouched.
  if (payload?.object !== 'instagram') return { handled: false, response: null as Response | null };

  const db = createSupabaseServiceClient();
  let stored = 0;
  let duplicates = 0;
  try {
    for (const message of normalizeMetaInstagram(payload)) {
      const result = await persistMessage(db, message);
      result.duplicate ? (duplicates += 1) : (stored += 1);
    }
    return {
      handled: true,
      response: Response.json({ ok: true, stored, duplicates, ai_called: false }),
    };
  } catch (error) {
    console.error('instagram_webhook_persist_failed', {
      message: error instanceof Error ? error.message : 'unknown',
    });
    return { handled: true, response: Response.json({ error: 'persist_failed' }, { status: 500 }) };
  }
}

async function proxyMetaRequest(request: Request, context: RouteContext) {
  const { path } = await context.params;
  const route = path.join('/');
  const upstreamPath = EXACT_ROUTES[route];

  if (!upstreamPath) {
    return Response.json({ error: 'meta_route_not_allowed' }, { status: 404 });
  }

  const configuredUpstream = process.env[UPSTREAM_ENV_NAME];
  if (!configuredUpstream) {
    console.error(`${UPSTREAM_ENV_NAME} is not configured`);
    return Response.json({ error: 'meta_proxy_not_configured' }, { status: 503 });
  }

  let upstreamBase: URL;
  try {
    upstreamBase = new URL(configuredUpstream);
  } catch {
    console.error(`${UPSTREAM_ENV_NAME} is invalid`);
    return Response.json({ error: 'meta_proxy_not_configured' }, { status: 503 });
  }

  if (upstreamBase.protocol !== 'https:') {
    console.error(`${UPSTREAM_ENV_NAME} must use HTTPS`);
    return Response.json({ error: 'meta_proxy_not_configured' }, { status: 503 });
  }

  const incomingUrl = new URL(request.url);
  const upstreamUrl = new URL(upstreamPath, upstreamBase);
  upstreamUrl.search = incomingUrl.search;

  const headers = new Headers();
  for (const name of REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set('x-forwarded-host', incomingUrl.host);
  headers.set('x-forwarded-proto', incomingUrl.protocol.replace(':', ''));

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const requestBody = hasBody ? new Uint8Array(await request.arrayBuffer()) : undefined;

  if (request.method === 'POST' && requestBody && route === 'webhooks/whatsapp') {
    const localRequest = localWhatsAppRequest(incomingUrl, request, requestBody);
    const [localResult, upstreamResult] = await Promise.allSettled([
      handleLocalWhatsAppWebhook(localRequest),
      fetch(upstreamUrl, {
        method: 'POST',
        headers,
        body: requestBody,
        redirect: 'manual',
        cache: 'no-store',
      }),
    ]);

    if (upstreamResult.status === 'rejected') {
      console.error('Meta WhatsApp upstream compatibility delivery failed', {
        error: upstreamResult.reason instanceof Error ? upstreamResult.reason.message : 'unknown_error',
      });
    }
    if (localResult.status === 'rejected') {
      console.error('Meta WhatsApp local persistence handler failed', {
        error: localResult.reason instanceof Error ? localResult.reason.message : 'unknown_error',
      });
      return Response.json({ error: 'whatsapp_local_handler_failed' }, { status: 500 });
    }
    return localResult.value;
  }

  if (request.method === 'POST' && requestBody && route === 'webhooks/messaging') {
    const local = await persistInstagramMessagingPayload(request, requestBody);

    // Preserve legacy upstream delivery in parallel even when Instagram was
    // consumed locally. Its result must never create duplicates in our CRM.
    const upstreamPromise = fetch(upstreamUrl, {
      method: 'POST',
      headers,
      body: requestBody,
      redirect: 'manual',
      cache: 'no-store',
    }).catch((error) => {
      console.error('Meta messaging upstream compatibility delivery failed', {
        error: error instanceof Error ? error.message : 'unknown_error',
      });
      return null;
    });

    if (local.handled && local.response) {
      void upstreamPromise;
      return local.response;
    }

    const upstreamResponse = await upstreamPromise;
    if (!upstreamResponse) return Response.json({ error: 'meta_proxy_unavailable' }, { status: 502 });
    const responseHeaders = new Headers();
    for (const name of RESPONSE_HEADERS) {
      const value = upstreamResponse.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    return new Response(upstreamResponse.body, { status: upstreamResponse.status, headers: responseHeaders });
  }

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body: requestBody,
      redirect: 'manual',
      cache: 'no-store',
    });

    const responseHeaders = new Headers();
    for (const name of RESPONSE_HEADERS) {
      const value = upstreamResponse.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('Meta proxy upstream request failed', {
      route,
      error: error instanceof Error ? error.message : 'unknown_error',
    });
    return Response.json({ error: 'meta_proxy_unavailable' }, { status: 502 });
  }
}

export const dynamic = 'force-dynamic';

export const GET = proxyMetaRequest;
export const POST = proxyMetaRequest;
