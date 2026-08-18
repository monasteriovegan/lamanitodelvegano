import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/supabase/require-role';

export const dynamic = 'force-dynamic';

async function graph(url: string, token: string) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, ok: response.ok, body };
}

export default async function InstagramDiagnosticPage() {
  await requireRole(['admin']);
  const db = createSupabaseServiceClient();
  const { data: config } = await db
    .from('integraciones_secretas')
    .select('wa_access_token')
    .eq('id', 'global')
    .maybeSingle();

  if (!config?.wa_access_token) {
    return <pre>{JSON.stringify({ ok: false, reason: 'missing_token' }, null, 2)}</pre>;
  }

  const version = process.env.META_GRAPH_VERSION || 'v26.0';
  const pageId = process.env.META_PAGE_ID || '1210803402107834';
  const igId = process.env.META_INSTAGRAM_BUSINESS_ID || '17841419477422736';
  const userToken = String(config.wa_access_token);

  const permissions = await graph(`https://graph.facebook.com/${version}/me/permissions`, userToken);
  const accounts = await graph(`https://graph.facebook.com/${version}/me/accounts?fields=id,name,access_token,tasks,instagram_business_account&limit=100`, userToken);
  const page = Array.isArray(accounts.body?.data)
    ? accounts.body.data.find((item: any) => String(item?.id || '') === pageId)
    : null;
  const pageToken = page?.access_token ? String(page.access_token) : null;

  const pageSubscriptions = pageToken
    ? await graph(`https://graph.facebook.com/${version}/${pageId}/subscribed_apps`, pageToken)
    : { status: 0, ok: false, body: { error: 'missing_page_token' } };

  const igProfile = pageToken
    ? await graph(`https://graph.facebook.com/${version}/${igId}?fields=id,username,name`, pageToken)
    : { status: 0, ok: false, body: { error: 'missing_page_token' } };

  const conversations = pageToken
    ? await graph(`https://graph.facebook.com/${version}/${igId}/conversations?platform=instagram&fields=id,updated_time&limit=10`, pageToken)
    : { status: 0, ok: false, body: { error: 'missing_page_token' } };

  const granted = Array.isArray(permissions.body?.data)
    ? permissions.body.data.filter((x: any) => x?.status === 'granted').map((x: any) => String(x.permission))
    : [];
  const subs = Array.isArray(pageSubscriptions.body?.data)
    ? pageSubscriptions.body.data.map((x: any) => ({ id: x?.id, subscribed_fields: x?.subscribed_fields || [] }))
    : [];

  return (
    <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify({
      ok: true,
      tokenValid: permissions.ok,
      granted,
      pageFound: Boolean(page),
      pageTasks: page?.tasks || [],
      linkedInstagramId: page?.instagram_business_account?.id || null,
      pageSubscriptions: { status: pageSubscriptions.status, ok: pageSubscriptions.ok, data: subs, error: pageSubscriptions.body?.error?.message || null },
      igProfile: { status: igProfile.status, ok: igProfile.ok, id: igProfile.body?.id || null, username: igProfile.body?.username || null, error: igProfile.body?.error?.message || null },
      conversations: {
        status: conversations.status,
        ok: conversations.ok,
        count: Array.isArray(conversations.body?.data) ? conversations.body.data.length : 0,
        latest: Array.isArray(conversations.body?.data) ? conversations.body.data.slice(0, 3) : [],
        errorCode: conversations.body?.error?.code || null,
        errorSubcode: conversations.body?.error?.error_subcode || null,
        error: conversations.body?.error?.message || null,
      },
    }, null, 2)}</pre>
  );
}
