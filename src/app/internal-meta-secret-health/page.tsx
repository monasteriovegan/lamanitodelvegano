export const dynamic = 'force-static';

const APP_ID = '1691394752113175';
const WABA_ID = '1129249369256097';

export default async function SecretHealthPage() {
  const secret = process.env.META_APP_SECRET;
  if (!secret) {
    const result = { secret_ok: false, token_status: 0, waba_status: 0, waba_error: 'missing_secret' };
    console.log('META_WABA_READ=' + JSON.stringify(result));
    return <pre>{JSON.stringify(result)}</pre>;
  }

  const tokenUrl = new URL('https://graph.facebook.com/v26.0/oauth/access_token');
  tokenUrl.searchParams.set('client_id', APP_ID);
  tokenUrl.searchParams.set('client_secret', secret);
  tokenUrl.searchParams.set('grant_type', 'client_credentials');
  const tokenResponse = await fetch(tokenUrl, { cache: 'no-store' });
  const tokenBody = await tokenResponse.json().catch(() => ({}));
  const token = tokenBody?.access_token as string | undefined;

  let wabaStatus = 0;
  let wabaError: string | null = null;
  let appCount: number | null = null;

  if (token) {
    const wabaUrl = new URL(`https://graph.facebook.com/v26.0/${WABA_ID}/subscribed_apps`);
    const wabaResponse = await fetch(wabaUrl, {
      headers: { authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    const wabaBody = await wabaResponse.json().catch(() => ({}));
    wabaStatus = wabaResponse.status;
    wabaError = wabaBody?.error?.message ?? null;
    appCount = Array.isArray(wabaBody?.data) ? wabaBody.data.length : null;
  }

  const result = {
    secret_ok: tokenResponse.ok && Boolean(token),
    token_status: tokenResponse.status,
    waba_status: wabaStatus,
    waba_error: wabaError,
    subscribed_app_count: appCount,
  };
  console.log('META_WABA_READ=' + JSON.stringify(result));
  return <pre>{JSON.stringify(result)}</pre>;
}
