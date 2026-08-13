export const dynamic = 'force-dynamic';

const APP_ID = '1691394752113175';

export async function GET() {
  const secret = process.env.META_APP_SECRET;
  if (!secret) return Response.json({ ok: false, error: 'missing_secret' }, { status: 503 });

  const url = new URL('https://graph.facebook.com/v26.0/oauth/access_token');
  url.searchParams.set('client_id', APP_ID);
  url.searchParams.set('client_secret', secret);
  url.searchParams.set('grant_type', 'client_credentials');

  const response = await fetch(url, { cache: 'no-store' });
  const body = await response.json().catch(() => ({}));
  return Response.json({ ok: response.ok && Boolean(body?.access_token), status: response.status, error: body?.error?.message ?? null });
}
