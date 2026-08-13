export const dynamic = 'force-dynamic';

const APP_ID = '1691394752113175';

export async function GET() {
  const secret = process.env.META_APP_SECRET;
  if (!secret) return Response.json({ error: 'missing_meta_app_secret' }, { status: 503 });

  const url = new URL(`https://graph.facebook.com/v26.0/${APP_ID}/subscriptions`);
  url.searchParams.set('access_token', `${APP_ID}|${secret}`);

  const response = await fetch(url, { cache: 'no-store' });
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    return Response.json({ status: response.status, error: body?.error?.message ?? 'graph_error' }, { status: 200 });
  }

  const data = Array.isArray(body?.data) ? body.data.map((item: any) => ({
    object: item?.object ?? null,
    callback_url: item?.callback_url ?? null,
    active: item?.active ?? null,
    fields: Array.isArray(item?.fields)
      ? item.fields.map((f: any) => typeof f === 'string' ? f : f?.name).filter(Boolean)
      : [],
  })) : [];

  return Response.json({ status: response.status, data });
}
