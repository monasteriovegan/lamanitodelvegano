import { createSupabaseServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function MetaCapabilitiesProbe() {
  const db = createSupabaseServiceClient();
  const { data: config } = await db
    .from('integraciones_secretas')
    .select('wa_access_token')
    .eq('id', 'global')
    .maybeSingle();

  if (!config?.wa_access_token) {
    return <pre>{JSON.stringify({ ok: false, error: 'missing_token' }, null, 2)}</pre>;
  }

  const version = process.env.META_GRAPH_VERSION || 'v26.0';
  const igId = '17841419477422736';
  const checks: Record<string, unknown> = {};

  const requests = [
    ['instagram_account', `https://graph.facebook.com/${version}/${igId}?fields=id,username,name`],
    ['permissions', `https://graph.facebook.com/${version}/me/permissions`],
    ['instagram_conversations', `https://graph.facebook.com/${version}/${igId}/conversations?platform=instagram&limit=1`],
  ] as const;

  for (const [key, url] of requests) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${config.wa_access_token}` },
      cache: 'no-store',
    });
    const body = await response.json().catch(() => ({}));
    checks[key] = {
      status: response.status,
      ok: response.ok,
      body,
    };
  }

  return <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify({ ok: true, checks }, null, 2)}</pre>;
}
