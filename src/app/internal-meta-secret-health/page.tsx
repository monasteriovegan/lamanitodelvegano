export const dynamic = 'force-static';

const APP_ID = '1691394752113175';

export default async function SecretHealthPage() {
  const secret = process.env.META_APP_SECRET;
  if (!secret) {
    const result = { secret_ok: false, token_status: 0, subscriptions_status: 0, error: 'missing_secret' };
    console.log('META_APP_SUBSCRIPTIONS=' + JSON.stringify(result));
    return <pre>{JSON.stringify(result)}</pre>;
  }

  const tokenUrl = new URL('https://graph.facebook.com/v26.0/oauth/access_token');
  tokenUrl.searchParams.set('client_id', APP_ID);
  tokenUrl.searchParams.set('client_secret', secret);
  tokenUrl.searchParams.set('grant_type', 'client_credentials');
  const tokenResponse = await fetch(tokenUrl, { cache: 'no-store' });
  const tokenBody = await tokenResponse.json().catch(() => ({}));
  const token = tokenBody?.access_token as string | undefined;

  let subscriptionsStatus = 0;
  let subscriptionsError: string | null = null;
  let subscriptions: Array<{object:string|null,callback_url:string|null,active:boolean|null,fields:string[]}> = [];

  if (token) {
    const url = new URL(`https://graph.facebook.com/v26.0/${APP_ID}/subscriptions`);
    url.searchParams.set('access_token', token);
    const response = await fetch(url, { cache: 'no-store' });
    const body = await response.json().catch(() => ({}));
    subscriptionsStatus = response.status;
    subscriptionsError = body?.error?.message ?? null;
    subscriptions = Array.isArray(body?.data) ? body.data.map((item:any) => ({
      object: item?.object ?? null,
      callback_url: item?.callback_url ?? null,
      active: item?.active ?? null,
      fields: Array.isArray(item?.fields) ? item.fields.map((f:any) => typeof f === 'string' ? f : f?.name).filter(Boolean) : [],
    })) : [];
  }

  const result = {
    secret_ok: tokenResponse.ok && Boolean(token),
    token_status: tokenResponse.status,
    subscriptions_status: subscriptionsStatus,
    subscriptions_error: subscriptionsError,
    subscriptions,
  };
  console.log('META_APP_SUBSCRIPTIONS=' + JSON.stringify(result));
  return <pre>{JSON.stringify(result)}</pre>;
}
