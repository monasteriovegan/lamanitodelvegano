export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const url = new URL('/api/meta/messages', origin);
  url.searchParams.set('connection_id', 'd51efda7-47a5-4ce4-9e91-23eaf2ad0dd7');

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
    cache: 'no-store',
  });
  const body = await response.text();
  return Response.json({ status: response.status, body: body.slice(0, 2000) });
}
