import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { configureInstagramAppCallback } from '@/lib/meta/setup-messaging';
import { MetaConnectionsRepository } from '@/lib/repositories/meta-connections-repository';

const DEFAULT_APP_ID = '1691394752113175';
const DEFAULT_BRIDGE_APP_ID = '1388581679803769';
const DEFAULT_PAGE_ID = '1210803402107834';
const DEFAULT_META_BUSINESS_ID = '1210930218761819';
const DEFAULT_BUSINESS_UNIT_ID = 'f3b57ce7-0796-40e5-94f1-07cb2b48ba85';

type GraphResult = {
  response: Response;
  body: any;
};

type TokenAttempt = {
  source: 'tenant' | 'legacy';
  resolved: boolean;
  mutationStatus: number | null;
  inspectStatus: number | null;
  primaryAppSubscribed: boolean;
  fields: string[];
  error?: string;
};

type AppAccess = {
  present: boolean;
  valid: boolean;
  status: number;
  token: string | null;
  error: string | null;
};

async function graphJson(url: URL, token: string, init: RequestInit = {}): Promise<GraphResult> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
    cache: 'no-store',
  });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

function graphMessage(body: any, fallback: string) {
  return String(body?.error?.message || body?.message || fallback);
}

function safeSubscriptionData(body: any) {
  return Array.isArray(body?.data)
    ? body.data.map((item: any) => ({
        id: item?.id ? String(item.id) : null,
        name: item?.name ? String(item.name) : null,
        fields: Array.isArray(item?.subscribed_fields)
          ? item.subscribed_fields.map((field: unknown) => String(field))
          : [],
      }))
    : [];
}

async function inspectDirectInstagramSubscription(igId: string, token: string, version: string) {
  const inspect = async (host: 'graph.instagram.com' | 'graph.facebook.com') => {
    const url = new URL(`https://${host}/${version}/${encodeURIComponent(igId)}/subscribed_apps`);
    const result = await graphJson(url, token);
    return {
      host,
      status: result.response.status,
      ok: result.response.ok,
      data: result.response.ok ? safeSubscriptionData(result.body) : [],
      errorCode: result.body?.error?.code ?? null,
      errorSubcode: result.body?.error?.error_subcode ?? null,
      error: result.response.ok ? null : graphMessage(result.body, 'direct_instagram_subscription_failed'),
    };
  };
  return {
    instagramHost: await inspect('graph.instagram.com'),
    facebookHost: await inspect('graph.facebook.com'),
  };
}

async function getAppAccessToken(appId: string, secret: string | undefined, version: string): Promise<AppAccess> {
  if (!secret) return { present: false, valid: false, status: 0, token: null, error: null };
  const url = new URL(`https://graph.facebook.com/${version}/oauth/access_token`);
  url.searchParams.set('client_id', appId);
  url.searchParams.set('client_secret', secret);
  url.searchParams.set('grant_type', 'client_credentials');
  const response = await fetch(url, { cache: 'no-store' });
  const body = await response.json().catch(() => ({}));
  const token = response.ok && body?.access_token ? String(body.access_token) : null;
  return {
    present: true,
    valid: Boolean(token),
    status: response.status,
    token,
    error: response.ok ? null : graphMessage(body, 'app_secret_invalid'),
  };
}

async function debugTenantToken(inputToken: string, appToken: string | null, version: string) {
  if (!appToken) {
    return { status: 0, ok: false, appId: null as string | null, isValid: null as boolean | null, type: null as string | null, scopes: [] as string[], error: 'app_access_token_unavailable' };
  }
  const url = new URL(`https://graph.facebook.com/${version}/debug_token`);
  url.searchParams.set('input_token', inputToken);
  const result = await graphJson(url, appToken);
  const data = result.body?.data || {};
  return {
    status: result.response.status,
    ok: result.response.ok,
    appId: data?.app_id ? String(data.app_id) : null,
    isValid: typeof data?.is_valid === 'boolean' ? data.is_valid : null,
    type: data?.type ? String(data.type) : null,
    scopes: Array.isArray(data?.scopes) ? data.scopes.map((scope: unknown) => String(scope)) : [],
    error: result.response.ok ? null : graphMessage(result.body, 'debug_token_failed'),
  };
}

async function inspectAppSubscriptions(appId: string, appToken: string | null, version: string) {
  if (!appToken) {
    return { status: 0, subscriptions: [] as Array<{ object: string | null; callbackUrl: string | null; active: boolean | null; fields: string[] }>, error: 'app_access_token_unavailable' };
  }
  const url = new URL(`https://graph.facebook.com/${version}/${encodeURIComponent(appId)}/subscriptions`);
  const result = await graphJson(url, appToken);
  const subscriptions = result.response.ok && Array.isArray(result.body?.data)
    ? result.body.data.map((item: any) => ({
        object: item?.object ? String(item.object) : null,
        callbackUrl: item?.callback_url ? String(item.callback_url) : null,
        active: typeof item?.active === 'boolean' ? item.active : null,
        fields: Array.isArray(item?.fields)
          ? item.fields.map((field: any) => String(typeof field === 'string' ? field : field?.name || '')).filter(Boolean)
          : [],
      }))
    : [];
  return {
    status: result.response.status,
    subscriptions,
    error: result.response.ok ? null : graphMessage(result.body, 'app_subscriptions_failed'),
  };
}

async function inspectBusinessApps(businessId: string, token: string, version: string) {
  const inspectEdge = async (edge: 'owned_apps' | 'client_apps') => {
    const url = new URL(`https://graph.facebook.com/${version}/${encodeURIComponent(businessId)}/${edge}`);
    url.searchParams.set('fields', 'id,name');
    url.searchParams.set('limit', '100');
    const result = await graphJson(url, token);
    const apps = result.response.ok && Array.isArray(result.body?.data)
      ? result.body.data.map((item: any) => ({
          id: String(item?.id || ''),
          name: item?.name ? String(item.name) : null,
        })).filter((item: { id: string }) => Boolean(item.id))
      : [];
    return {
      status: result.response.status,
      apps,
      error: result.response.ok ? null : graphMessage(result.body, `${edge}_failed`),
    };
  };
  return {
    owned: await inspectEdge('owned_apps'),
    client: await inspectEdge('client_apps'),
  };
}

async function resolvePageAccessToken(token: string, pageId: string, version: string) {
  const accountsUrl = new URL(`https://graph.facebook.com/${version}/me/accounts`);
  accountsUrl.searchParams.set('fields', 'id,access_token');
  accountsUrl.searchParams.set('limit', '100');
  const accounts = await graphJson(accountsUrl, token);
  if (accounts.response.ok) {
    const page = (accounts.body?.data || []).find((item: any) => String(item?.id || '') === pageId);
    if (page?.access_token) return String(page.access_token);
  }

  const pageUrl = new URL(`https://graph.facebook.com/${version}/${encodeURIComponent(pageId)}`);
  pageUrl.searchParams.set('fields', 'id');
  const direct = await graphJson(pageUrl, token);
  if (direct.response.ok && String(direct.body?.id || '') === pageId) return token;
  return null;
}

async function inspectSubscribedApps(token: string, pageId: string, version: string) {
  const pageToken = await resolvePageAccessToken(token, pageId, version);
  if (!pageToken) return { status: 0, apps: [] as Array<{ id: string; name: string | null; fields: string[] }> };
  const url = new URL(`https://graph.facebook.com/${version}/${encodeURIComponent(pageId)}/subscribed_apps`);
  url.searchParams.set('fields', 'id,name,subscribed_fields');
  const result = await graphJson(url, pageToken);
  const apps = result.response.ok && Array.isArray(result.body?.data)
    ? result.body.data.map((item: any) => ({
        id: String(item?.id || ''),
        name: item?.name ? String(item.name) : null,
        fields: Array.isArray(item?.subscribed_fields)
          ? item.subscribed_fields.map((field: unknown) => String(field))
          : [],
      })).filter((item: { id: string }) => Boolean(item.id))
    : [];
  return { status: result.response.status, apps };
}

async function subscribeAndVerify(input: {
  token: string;
  source: TokenAttempt['source'];
  pageId: string;
  appId: string;
  version: string;
}): Promise<TokenAttempt> {
  const pageToken = await resolvePageAccessToken(input.token, input.pageId, input.version);
  if (!pageToken) {
    return {
      source: input.source,
      resolved: false,
      mutationStatus: null,
      inspectStatus: null,
      primaryAppSubscribed: false,
      fields: [],
      error: 'page_token_not_resolved',
    };
  }

  const subscribeUrl = new URL(`https://graph.facebook.com/${input.version}/${encodeURIComponent(input.pageId)}/subscribed_apps`);
  subscribeUrl.searchParams.set('subscribed_fields', 'messages,messaging_postbacks');
  const mutation = await graphJson(subscribeUrl, pageToken, { method: 'POST' });

  const inspectUrl = new URL(`https://graph.facebook.com/${input.version}/${encodeURIComponent(input.pageId)}/subscribed_apps`);
  inspectUrl.searchParams.set('fields', 'id,name,subscribed_fields');
  const inspection = await graphJson(inspectUrl, pageToken);
  const app = inspection.response.ok
    ? (inspection.body?.data || []).find((item: any) => String(item?.id || '') === input.appId)
    : null;
  const fields = Array.isArray(app?.subscribed_fields)
    ? app.subscribed_fields.map((field: unknown) => String(field))
    : [];
  const primaryAppSubscribed = Boolean(app)
    && fields.includes('messages')
    && fields.includes('messaging_postbacks');

  return {
    source: input.source,
    resolved: true,
    mutationStatus: mutation.response.status,
    inspectStatus: inspection.response.status,
    primaryAppSubscribed,
    fields,
    ...(!primaryAppSubscribed
      ? { error: graphMessage(inspection.body, graphMessage(mutation.body, 'primary_app_not_subscribed')) }
      : {}),
  };
}

export async function rewireInstagramWebhook(
  db: SupabaseClient,
  input: {
    verifyToken: string;
    legacyPageToken?: string | null;
    businessUnitId?: string;
  },
) {
  const appId = process.env.META_APP_ID || DEFAULT_APP_ID;
  const bridgeAppId = process.env.META_BRIDGE_APP_ID || DEFAULT_BRIDGE_APP_ID;
  const metaBusinessId = process.env.META_BUSINESS_ID || DEFAULT_META_BUSINESS_ID;
  const businessUnitId = input.businessUnitId || process.env.MANITO_BUSINESS_UNIT_ID || DEFAULT_BUSINESS_UNIT_ID;
  const credential = await new MetaConnectionsRepository(db).getActiveCredential(
    businessUnitId,
    'instagram_account',
  );
  const igId = String(credential.externalId || process.env.META_INSTAGRAM_BUSINESS_ID || '');
  const pageId = String(credential.metadata?.page_id || process.env.META_PAGE_ID || DEFAULT_PAGE_ID);
  const versions = Array.from(new Set([
    process.env.META_GRAPH_VERSION || 'v26.0',
    'v25.0',
    'v24.0',
  ]));

  const primaryAccess = await getAppAccessToken(appId, process.env.META_APP_SECRET, versions[0]);
  const bridgeAccess = await getAppAccessToken(bridgeAppId, process.env.META_BRIDGE_APP_SECRET, versions[0]);
  const primaryTokenDebug = await debugTenantToken(credential.accessToken, primaryAccess.token, versions[0]);
  const bridgeTokenDebug = await debugTenantToken(credential.accessToken, bridgeAccess.token, versions[0]);
  const observedTokenAppIds = [...new Set([primaryTokenDebug.appId, bridgeTokenDebug.appId].filter(Boolean) as string[])];
  const validTokenDebug = [primaryTokenDebug, bridgeTokenDebug].find((item) => item.isValid && item.appId);
  const tenantTokenAppId = validTokenDebug?.appId || (observedTokenAppIds.length === 1 ? observedTokenAppIds[0] : null);
  const appSubscriptions = {
    primary: await inspectAppSubscriptions(appId, primaryAccess.token, versions[0]),
    bridge: await inspectAppSubscriptions(bridgeAppId, bridgeAccess.token, versions[0]),
  };
  const businessApps = await inspectBusinessApps(metaBusinessId, credential.accessToken, versions[0]);
  const directInstagramSubscription = igId
    ? await inspectDirectInstagramSubscription(igId, credential.accessToken, versions[0])
    : null;
  const subscriptionInspection = await inspectSubscribedApps(
    credential.accessToken,
    pageId,
    versions[0],
  );

  let callback: Awaited<ReturnType<typeof configureInstagramAppCallback>> | null = null;
  let callbackVersion: string | null = null;
  for (const version of versions) {
    callback = await configureInstagramAppCallback(version, input.verifyToken);
    if (callback.ok) {
      callbackVersion = version;
      break;
    }
  }

  const tokenCandidates = [
    { source: 'tenant' as const, token: credential.accessToken },
    ...(input.legacyPageToken && input.legacyPageToken !== credential.accessToken
      ? [{ source: 'legacy' as const, token: input.legacyPageToken }]
      : []),
  ];

  const attempts: TokenAttempt[] = [];
  let subscribedVersion: string | null = null;
  for (const version of versions) {
    for (const candidate of tokenCandidates) {
      const attempt = await subscribeAndVerify({
        token: candidate.token,
        source: candidate.source,
        pageId,
        appId,
        version,
      });
      attempts.push(attempt);
      if (attempt.primaryAppSubscribed) {
        subscribedVersion = version;
        break;
      }
    }
    if (subscribedVersion) break;
  }

  const primaryAppSubscribed = attempts.some((attempt) => attempt.primaryAppSubscribed);
  return {
    ok: Boolean(callback?.ok) && primaryAppSubscribed,
    appId,
    bridgeAppId,
    metaBusinessId,
    pageId,
    igId,
    primarySecretPresent: primaryAccess.present,
    primarySecretValid: primaryAccess.valid,
    primarySecretStatus: primaryAccess.status,
    primarySecretError: primaryAccess.error,
    bridgeSecretPresent: bridgeAccess.present,
    bridgeSecretValid: bridgeAccess.valid,
    bridgeSecretStatus: bridgeAccess.status,
    bridgeSecretError: bridgeAccess.error,
    tenantTokenAppId,
    tenantTokenDebug: {
      primary: primaryTokenDebug,
      bridge: bridgeTokenDebug,
    },
    appSubscriptions,
    businessApps,
    directInstagramSubscription,
    subscribedAppsStatus: subscriptionInspection.status,
    subscribedApps: subscriptionInspection.apps,
    callback: callback
      ? {
          ok: callback.ok,
          status: callback.status,
          callbackUrl: callback.callbackUrl || null,
          error: callback.error || null,
        }
      : null,
    callbackVersion,
    primaryAppSubscribed,
    subscribedVersion,
    attempts,
  };
}
