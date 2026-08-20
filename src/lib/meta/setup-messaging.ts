import 'server-only';
import { runtimeSiteUrl } from '@/lib/site-url';

const DEFAULT_APP_ID = '1691394752113175';
const DEFAULT_PAGE_ID = '1210803402107834';
const DEFAULT_IG_BUSINESS_ID = '17841419477422736';
const DEFAULT_WABA_ID = '1129249369256097';

export type MetaMessagingSetupResult = {
  ok: boolean;
  tokenValid: boolean;
  permissions: string[];
  page: { id: string; name: string | null; instagramBusinessId: string | null } | null;
  instagramAppSubscription: { ok: boolean; status: number; callbackUrl?: string; error?: string } | null;
  pageSubscription: { ok: boolean; status: number; fields?: string[]; error?: string } | null;
  wabaSubscription: { ok: boolean; status: number; subscribed?: boolean; error?: string } | null;
  warnings: string[];
};

async function graphJson(url: URL, token: string, init: RequestInit = {}) {
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

function graphError(body: any, fallback: string) {
  return String(body?.error?.message || body?.message || fallback);
}

async function configureInstagramAppCallback(version: string, verifyToken?: string | null) {
  if (!process.env.META_APP_SECRET || !verifyToken) {
    return { ok: false, status: 0, error: 'Falta META_APP_SECRET o verify token' };
  }

  const appId = process.env.META_APP_ID || DEFAULT_APP_ID;
  const tokenUrl = new URL(`https://graph.facebook.com/${version}/oauth/access_token`);
  tokenUrl.searchParams.set('client_id', appId);
  tokenUrl.searchParams.set('client_secret', process.env.META_APP_SECRET);
  tokenUrl.searchParams.set('grant_type', 'client_credentials');
  const tokenResponse = await fetch(tokenUrl, { cache: 'no-store' });
  const tokenBody = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || !tokenBody?.access_token) {
    return { ok: false, status: tokenResponse.status, error: graphError(tokenBody, 'No se obtuvo App Access Token') };
  }

  const siteUrl = runtimeSiteUrl();
  const callbackUrl = `${siteUrl}/api/instagram`;
  const subscriptionUrl = new URL(`https://graph.facebook.com/${version}/${appId}/subscriptions`);
  const body = new URLSearchParams({
    object: 'instagram',
    callback_url: callbackUrl,
    fields: 'messages,messaging_postbacks',
    verify_token: verifyToken,
    include_values: 'true',
  });

  const response = await fetch(subscriptionUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${String(tokenBody.access_token)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
    cache: 'no-store',
  });
  const responseBody = await response.json().catch(() => ({}));
  return response.ok && responseBody?.success
    ? { ok: true, status: response.status, callbackUrl }
    : { ok: false, status: response.status, callbackUrl, error: graphError(responseBody, 'No se pudo configurar callback Instagram') };
}

export async function setupMetaMessaging(
  userAccessToken: string,
  options: { verifyToken?: string | null } = {},
): Promise<MetaMessagingSetupResult> {
  const version = process.env.META_GRAPH_VERSION || 'v26.0';
  const pageId = process.env.META_PAGE_ID || DEFAULT_PAGE_ID;
  const instagramBusinessId = process.env.META_INSTAGRAM_BUSINESS_ID || DEFAULT_IG_BUSINESS_ID;
  const wabaId = process.env.META_WABA_ID || DEFAULT_WABA_ID;
  const result: MetaMessagingSetupResult = {
    ok: false,
    tokenValid: false,
    permissions: [],
    page: null,
    instagramAppSubscription: null,
    pageSubscription: null,
    wabaSubscription: null,
    warnings: [],
  };

  result.instagramAppSubscription = await configureInstagramAppCallback(version, options.verifyToken);
  if (!result.instagramAppSubscription.ok && result.instagramAppSubscription.error) {
    result.warnings.push(`Instagram webhook: ${result.instagramAppSubscription.error}`);
  }

  const permissionsUrl = new URL(`https://graph.facebook.com/${version}/me/permissions`);
  const permissionsResult = await graphJson(permissionsUrl, userAccessToken);
  if (!permissionsResult.response.ok) {
    result.warnings.push(graphError(permissionsResult.body, `Meta HTTP ${permissionsResult.response.status}`));
    return result;
  }
  result.tokenValid = true;
  result.permissions = (permissionsResult.body?.data || [])
    .filter((item: any) => item?.status === 'granted')
    .map((item: any) => String(item.permission));

  const pagesUrl = new URL(`https://graph.facebook.com/${version}/me/accounts`);
  pagesUrl.searchParams.set('fields', 'id,name,access_token,tasks,instagram_business_account');
  pagesUrl.searchParams.set('limit', '100');
  const pagesResult = await graphJson(pagesUrl, userAccessToken);
  if (!pagesResult.response.ok) {
    result.warnings.push(`No se pudieron leer las páginas: ${graphError(pagesResult.body, String(pagesResult.response.status))}`);
  }

  const pages = pagesResult.body?.data || [];
  const page = pages.find((item: any) => String(item?.id || '') === pageId)
    || pages.find((item: any) => String(item?.instagram_business_account?.id || '') === instagramBusinessId)
    || null;

  if (page) {
    result.page = {
      id: String(page.id),
      name: page.name ? String(page.name) : null,
      instagramBusinessId: page?.instagram_business_account?.id ? String(page.instagram_business_account.id) : null,
    };

    if (page.access_token) {
      const subscribeUrl = new URL(`https://graph.facebook.com/${version}/${encodeURIComponent(String(page.id))}/subscribed_apps`);
      subscribeUrl.searchParams.set('subscribed_fields', 'messages,messaging_postbacks');
      const subscribeResult = await graphJson(subscribeUrl, String(page.access_token), { method: 'POST' });

      if (subscribeResult.response.ok && subscribeResult.body?.success) {
        const inspectUrl = new URL(`https://graph.facebook.com/${version}/${encodeURIComponent(String(page.id))}/subscribed_apps`);
        const inspectResult = await graphJson(inspectUrl, String(page.access_token));
        const app = (inspectResult.body?.data || []).find((item: any) => String(item?.id || '') === (process.env.META_APP_ID || DEFAULT_APP_ID));
        result.pageSubscription = {
          ok: true,
          status: subscribeResult.response.status,
          fields: Array.isArray(app?.subscribed_fields) ? app.subscribed_fields.map((field: unknown) => String(field)) : ['messages', 'messaging_postbacks'],
        };
      } else {
        result.pageSubscription = {
          ok: false,
          status: subscribeResult.response.status,
          error: graphError(subscribeResult.body, 'No se pudo suscribir la página'),
        };
      }
    } else {
      result.pageSubscription = { ok: false, status: 0, error: 'No se obtuvo Page Access Token' };
    }
  } else {
    result.warnings.push('No se encontró la Página vinculada a @lamanitodelvegano en /me/accounts.');
  }

  const wabaUrl = new URL(`https://graph.facebook.com/${version}/${encodeURIComponent(wabaId)}/subscribed_apps`);
  wabaUrl.searchParams.set('subscribed_fields', 'messages');
  const wabaResult = await graphJson(wabaUrl, userAccessToken, { method: 'POST' });
  result.wabaSubscription = wabaResult.response.ok && wabaResult.body?.success
    ? { ok: true, status: wabaResult.response.status, subscribed: true }
    : { ok: false, status: wabaResult.response.status, error: graphError(wabaResult.body, 'No se pudo verificar la suscripción WABA') };

  const required = [
    'pages_show_list',
    'pages_messaging',
    'instagram_basic',
    'instagram_manage_messages',
    'whatsapp_business_management',
    'whatsapp_business_messaging',
  ];
  const missing = required.filter((permission) => !result.permissions.includes(permission));
  if (missing.length) result.warnings.push(`Permisos faltantes: ${missing.join(', ')}`);

  result.ok = result.tokenValid
    && Boolean(result.instagramAppSubscription?.ok)
    && Boolean(result.pageSubscription?.ok)
    && Boolean(result.wabaSubscription?.ok)
    && missing.length === 0;
  return result;
}
