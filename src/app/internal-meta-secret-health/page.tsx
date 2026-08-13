export const dynamic = 'force-static';

const APP_ID = '1691394752113175';

export default async function SecretHealthPage() {
  const secret = process.env.META_APP_SECRET;
  let result: {ok:boolean,status:number,error:string|null};
  if (!secret) {
    result = { ok: false, status: 0, error: 'missing_secret' };
  } else {
    const url = new URL('https://graph.facebook.com/v26.0/oauth/access_token');
    url.searchParams.set('client_id', APP_ID);
    url.searchParams.set('client_secret', secret);
    url.searchParams.set('grant_type', 'client_credentials');
    const response = await fetch(url, { cache: 'no-store' });
    const body = await response.json().catch(() => ({}));
    result = { ok: response.ok && Boolean(body?.access_token), status: response.status, error: body?.error?.message ?? null };
  }
  console.log('META_SECRET_HEALTH=' + JSON.stringify(result));
  return <pre>{JSON.stringify(result)}</pre>;
}
