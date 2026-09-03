import 'server-only';

const DEFAULT_INSTAGRAM_APP_ID = '4495025437486041';
export const INSTAGRAM_LOGIN_SCOPES = [
  'instagram_business_basic',
  'instagram_business_manage_messages',
] as const;

function instagramAppId() {
  return process.env.META_INSTAGRAM_APP_ID || DEFAULT_INSTAGRAM_APP_ID;
}

function instagramAppSecret() {
  const secret = process.env.META_INSTAGRAM_APP_SECRET;
  if (!secret) throw new Error('instagram_app_secret_not_configured');
  return secret;
}

export function instagramLoginCallbackUrl(origin: string) {
  return new URL('/api/meta/oauth/callback', origin).toString();
}

export function instagramLoginAuthorizationUrl(origin: string, state: string) {
  const url = new URL('https://www.instagram.com/oauth/authorize');
  url.searchParams.set('client_id', instagramAppId());
  url.searchParams.set('redirect_uri', instagramLoginCallbackUrl(origin));
  url.searchParams.set('scope', INSTAGRAM_LOGIN_SCOPES.join(','));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', state);
  url.searchParams.set('enable_fb_login', '0');
  return url;
}

async function responseJson(response: Response, fallback: string) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = String(body?.error_type || body?.error?.code || response.status);
    throw new Error(`${fallback}:${code}`);
  }
  return body;
}

export async function exchangeInstagramLoginCode(code: string, origin: string) {
  const form = new URLSearchParams();
  form.set('client_id', instagramAppId());
  form.set('client_secret', instagramAppSecret());
  form.set('grant_type', 'authorization_code');
  form.set('redirect_uri', instagramLoginCallbackUrl(origin));
  form.set('code', code);

  const shortResponse = await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
    cache: 'no-store',
  });
  const short = await responseJson(shortResponse, 'instagram_code_exchange_failed');
  const shortToken = String(short.access_token || '');
  if (!shortToken) throw new Error('instagram_short_token_missing');

  const longUrl = new URL('https://graph.instagram.com/access_token');
  longUrl.searchParams.set('grant_type', 'ig_exchange_token');
  longUrl.searchParams.set('client_secret', instagramAppSecret());
  longUrl.searchParams.set('access_token', shortToken);
  const longResponse = await fetch(longUrl, { cache: 'no-store' });
  const long = await responseJson(longResponse, 'instagram_long_token_exchange_failed');
  return {
    accessToken: String(long.access_token || shortToken),
    expiresIn: Number(long.expires_in || short.expires_in || 0),
  };
}

export async function discoverInstagramLoginProfile(accessToken: string) {
  const version = process.env.META_GRAPH_VERSION || 'v26.0';
  const url = new URL(`https://graph.instagram.com/${version}/me`);
  url.searchParams.set('fields', 'id,username,name');
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  const body = await responseJson(response, 'instagram_profile_discovery_failed');
  const id = String(body?.id || '');
  if (!id) throw new Error('instagram_profile_id_missing');
  return {
    id,
    username: body?.username ? String(body.username) : null,
    name: body?.name ? String(body.name) : null,
  };
}
