export const dynamic = 'force-dynamic';

export async function GET() {
  const url = new URL('https://lamanitodelvegano.vercel.app/api/meta/messages');
  url.searchParams.set('connection_id', 'd51efda7-47a5-4ce4-9e91-23eaf2ad0dd7');

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
    cache: 'no-store',
  });

  const text = await response.text();
  return Response.json({
    status: response.status,
    content_type: response.headers.get('content-type'),
    body: text.slice(0, 4000),
  });
}
