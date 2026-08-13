import { POST as handleLocalWhatsAppWebhook } from '@/app/api/whatsapp/route';

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

function webhookHeaders(request: Request) {
  const localHeaders = new Headers();
  for (const name of ['content-type', 'user-agent', 'x-hub-signature-256']) {
    const value = request.headers.get(name);
    if (value) localHeaders.set(name, value);
  }
  return localHeaders;
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

  if (route === 'webhooks/whatsapp' && request.method === 'POST' && requestBody) {
    const localRequest = new Request(new URL('/api/whatsapp', incomingUrl.origin), {
      method: 'POST',
      headers: webhookHeaders(request),
      body: requestBody,
    });

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

  // The Meta app historically points Instagram/Messenger notifications to
  // /api/meta/webhooks/messaging. Mirror that signed payload into the local
  // Instagram handler as well as the existing upstream backend. This keeps
  // the CRM working even if the app-level callback has not yet moved to
  // /api/instagram, and avoids importing a second Next route handler here.
  if (route === 'webhooks/messaging' && request.method === 'POST' && requestBody) {
    const localUrl = new URL('/api/instagram', incomingUrl.origin);
    const [localResult, upstreamResult] = await Promise.allSettled([
      fetch(localUrl, {
        method: 'POST',
        headers: webhookHeaders(request),
        body: requestBody,
        redirect: 'manual',
        cache: 'no-store',
      }),
      fetch(upstreamUrl, {
        method: 'POST',
        headers,
        body: requestBody,
        redirect: 'manual',
        cache: 'no-store',
      }),
    ]);

    if (upstreamResult.status === 'rejected') {
      console.error('Meta Instagram upstream compatibility delivery failed', {
        error: upstreamResult.reason instanceof Error ? upstreamResult.reason.message : 'unknown_error',
      });
    }

    if (localResult.status === 'rejected') {
      console.error('Meta Instagram local persistence delivery failed', {
        error: localResult.reason instanceof Error ? localResult.reason.message : 'unknown_error',
      });
      return Response.json({ error: 'instagram_local_handler_failed' }, { status: 500 });
    }

    if (!localResult.value.ok) {
      console.error('Meta Instagram local persistence handler returned non-2xx', {
        status: localResult.value.status,
      });
    }
    return localResult.value;
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
