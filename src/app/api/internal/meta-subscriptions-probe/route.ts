export const dynamic = 'force-dynamic';

const APP_ID = '1691394752113175';

export async function GET() {
  const secret = process.env.META_APP_SECRET;
  if (!secret) return Response.json({ error: 'missing_meta_app_secret' }, { status: 503 });

  const tokenUrl = new URL('https://graph.facebook.com/v26.0/oauth/access_token');
  tokenUrl.searchParams.set('client_id', APP_ID);
  tokenUrl.searchParams.set('client_secret', secret);
  tokenUrl.searchParams.set('grant_type', 'client_credentials');

  const tokenResponse = await fetch(tokenUrl, { cache: 'no-store' });
  const tokenBody = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || !tokenBody?.access_token) {
    return Response.json({
      token_status: tokenResponse.status,
      token_error: tokenBody?.error?.message ?? 'app_token_error',
    });
  }

  const url = new URL(`https://graph.facebook.com/v26.0/${APP_ID}/subscriptions`);
  url.searchParams.set('access_token', tokenBody.access_token);

  const response = await fetch(url, { cache: 'no-store' });
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    return Response.json({ status: response.status, error: body?.error?.message ?? 'graph_error' });
  }

  const data = Array.isArray(body?.data) ? body.data.map((item: any) => ({
    object: item?.object ?? null,
    callback_url: item?.callback_url ?? null,
    active: item?.active ?? null,
    fields: Array.isArray(item?.fields)
      ? item.fields.map((f: any) => typeof f === 'string' ? f : f?.name).filter(Boolean)
      : [],
  })) : [];

  return Response.json({ token_status: tokenResponse.status, status: response.status, data });
}
