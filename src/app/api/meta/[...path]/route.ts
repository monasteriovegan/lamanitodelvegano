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

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'HEAD'
        ? undefined
        : await request.arrayBuffer(),
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
