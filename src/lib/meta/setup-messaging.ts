import 'server-only';

const DEFAULT_PAGE_ID = '1210803402107834';
const DEFAULT_IG_BUSINESS_ID = '17841419477422736';
const DEFAULT_WABA_ID = '1129249369256097';

export type MetaMessagingSetupResult = {
  ok: boolean;
  tokenValid: boolean;
  permissions: string[];
  page: { id: string; name: string | null; instagramBusinessId: string | null } | null;
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

export async function setupMetaMessaging(userAccessToken: string): Promise<MetaMessagingSetupResult> {
  const version = process.env.META_GRAPH_VERSION || 'v26.0';
  const pageId = process.env.META_PAGE_ID || DEFAULT_PAGE_ID;
  const instagramBusinessId = process.env.META_INSTAGRAM_BUSINESS_ID || DEFAULT_IG_BUSINESS_ID;
  const wabaId = process.env.META_WABA_ID || DEFAULT_WABA_ID;
  const result: MetaMessagingSetupResult = {
    ok: false,
    tokenValid: false,
    permissions: [],
    page: null,
    pageSubscription: null,
    wabaSubscription: null,
    warnings: [],
  };

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
      // For Facebook Login, the linked Page is the asset that receives the
      // messaging webhook subscription. Keep the fields minimal and official.
      const subscribeUrl = new URL(`https://graph.facebook.com/${version}/${encodeURIComponent(String(page.id))}/subscribed_apps`);
      subscribeUrl.searchParams.set('subscribed_fields', 'messages,messaging_postbacks');
      const subscribeResult = await graphJson(subscribeUrl, String(page.access_token), { method: 'POST' });

      if (subscribeResult.response.ok && subscribeResult.body?.success) {
        const inspectUrl = new URL(`https://graph.facebook.com/${version}/${encodeURIComponent(String(page.id))}/subscribed_apps`);
        const inspectResult = await graphJson(inspectUrl, String(page.access_token));
        const app = (inspectResult.body?.data || []).find((item: any) => String(item?.id || '') === (process.env.META_APP_ID || '1691394752113175'));
        result.pageSubscription = {
          ok: true,
          status: subscribeResult.response.status,
          fields: Array.isArray(app?.subscribed_fields) ? app.subscribed_fields.map(String) : ['messages', 'messaging_postbacks'],
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

  // Preserve the already-working WhatsApp subscription. POSTing the same
  // official `messages` field is idempotent and avoids changing number/certificate/coexistence settings.
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

  result.ok = result.tokenValid && Boolean(result.pageSubscription?.ok) && Boolean(result.wabaSubscription?.ok) && missing.length === 0;
  return result;
}
