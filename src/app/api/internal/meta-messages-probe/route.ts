export const dynamic = 'force-dynamic';

export async function GET() {
  const configuredUpstream = process.env.META_PROXY_UPSTREAM_URL;
  if (!configuredUpstream) {
    return Response.json({ error: 'meta_proxy_not_configured' }, { status: 503 });
  }

  let upstreamBase: URL;
  try {
    upstreamBase = new URL(configuredUpstream);
  } catch {
    return Response.json({ error: 'meta_proxy_invalid' }, { status: 503 });
  }

  const url = new URL('/api/meta/messages', upstreamBase);
  url.searchParams.set('connection_id', 'd51efda7-47a5-4ce4-9e91-23eaf2ad0dd7');

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
    cache: 'no-store',
  });

  const text = await response.text();
  return Response.json({
    upstream_status: response.status,
    upstream_content_type: response.headers.get('content-type'),
    upstream_body: text.slice(0, 4000),
  });
}
