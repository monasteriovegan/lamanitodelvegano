import 'server-only';

const DEFAULT_APP_ID = '1691394752113175';
export const INSTAGRAM_REVIEW_SCOPES = [
  'instagram_basic',
  'instagram_manage_messages',
  'pages_manage_metadata',
  'pages_messaging',
  'pages_read_engagement',
  'pages_show_list',
] as const;

function graphVersion() {
  return process.env.META_GRAPH_VERSION || 'v26.0';
}

export function metaCallbackUrl(origin: string) {
  return new URL('/api/meta/oauth/callback', origin).toString();
}

export function metaAuthorizationUrl(origin: string, state: string) {
  const url = new URL(`https://www.facebook.com/${graphVersion()}/dialog/oauth`);
  url.searchParams.set('client_id', process.env.META_APP_ID || DEFAULT_APP_ID);
  url.searchParams.set('redirect_uri', metaCallbackUrl(origin));
  url.searchParams.set('state', state);
  url.searchParams.set('scope', INSTAGRAM_REVIEW_SCOPES.join(','));
  url.searchParams.set('response_type', 'code');
  return url;
}

async function graphJson(url: URL, init?: RequestInit) {
  const response = await fetch(url, { ...init, cache: 'no-store' });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = String(body?.error?.code || response.status);
    throw new Error(`meta_graph_error:${code}`);
  }
  return body;
}

export async function exchangeMetaCode(code: string, origin: string) {
  const secret = process.env.META_APP_SECRET;
  if (!secret) throw new Error('meta_app_secret_not_configured');
  const appId = process.env.META_APP_ID || DEFAULT_APP_ID;
  const exchange = new URL(`https://graph.facebook.com/${graphVersion()}/oauth/access_token`);
  exchange.searchParams.set('client_id', appId);
  exchange.searchParams.set('client_secret', secret);
  exchange.searchParams.set('redirect_uri', metaCallbackUrl(origin));
  exchange.searchParams.set('code', code);
  const short = await graphJson(exchange);

  const durable = new URL(`https://graph.facebook.com/${graphVersion()}/oauth/access_token`);
  durable.searchParams.set('grant_type', 'fb_exchange_token');
  durable.searchParams.set('client_id', appId);
  durable.searchParams.set('client_secret', secret);
  durable.searchParams.set('fb_exchange_token', String(short.access_token));
  const long = await graphJson(durable);
  return {
    accessToken: String(long.access_token || short.access_token),
    expiresIn: Number(long.expires_in || short.expires_in || 0),
  };
}

export type DiscoveredMetaAsset = {
  asset_type: 'page' | 'instagram_account';
  external_id: string;
  display_name: string | null;
  metadata: Record<string, string>;
};

export async function discoverMetaAssets(accessToken: string): Promise<DiscoveredMetaAsset[]> {
  const url = new URL(`https://graph.facebook.com/${graphVersion()}/me/accounts`);
  url.searchParams.set('fields', 'id,name,instagram_business_account{id,username,name}');
  url.searchParams.set('limit', '100');
  const body = await graphJson(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const assets: DiscoveredMetaAsset[] = [];
  for (const page of body.data || []) {
    if (!page?.id) continue;
    assets.push({ asset_type: 'page', external_id: String(page.id), display_name: page.name || null, metadata: {} });
    const ig = page.instagram_business_account;
    if (ig?.id) {
      assets.push({
        asset_type: 'instagram_account',
        external_id: String(ig.id),
        display_name: ig.username ? `@${ig.username}` : ig.name || null,
        metadata: { page_id: String(page.id), username: String(ig.username || '') },
      });
    }
  }
  return assets;
}

export async function subscribeMetaPages(accessToken: string, pageIds: string[]) {
  const uniquePageIds = [...new Set(pageIds.filter(Boolean))];
  if (!uniquePageIds.length) throw new Error('meta_page_selection_required');

  const accountsUrl = new URL(`https://graph.facebook.com/${graphVersion()}/me/accounts`);
  accountsUrl.searchParams.set('fields', 'id,access_token');
  accountsUrl.searchParams.set('limit', '100');
  const accounts = await graphJson(accountsUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const pageTokens = new Map<string, string>();
  for (const page of accounts.data || []) {
    if (page?.id && page?.access_token) pageTokens.set(String(page.id), String(page.access_token));
  }

  for (const pageId of uniquePageIds) {
    const pageToken = pageTokens.get(pageId);
    if (!pageToken) throw new Error('meta_page_token_unavailable');
    const subscriptionUrl = new URL(`https://graph.facebook.com/${graphVersion()}/${pageId}/subscribed_apps`);
    subscriptionUrl.searchParams.set('subscribed_fields', 'messages,messaging_postbacks');
    subscriptionUrl.searchParams.set('access_token', pageToken);
    await graphJson(subscriptionUrl, { method: 'POST' });
  }
  return uniquePageIds;
}

export async function checkMetaToken(accessToken: string) {
  const url = new URL(`https://graph.facebook.com/${graphVersion()}/me`);
  url.searchParams.set('fields', 'id');
  const body = await graphJson(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  return Boolean(body?.id);
}
