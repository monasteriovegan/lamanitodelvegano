import 'server-only';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

const DEFAULT_IG_BUSINESS_ID = '17841419477422736';

async function resolvePageAccessToken(userAccessToken: string, instagramBusinessId: string) {
  const version = process.env.META_GRAPH_VERSION || 'v26.0';
  const response = await fetch(
    `https://graph.facebook.com/${version}/me/accounts?fields=id,name,access_token,instagram_business_account&limit=100`,
    {
      headers: { Authorization: `Bearer ${userAccessToken}` },
      cache: 'no-store',
    },
  );
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`instagram_page_token_failed:${response.status}`);

  const page = (body.data || []).find(
    (item: any) => String(item?.instagram_business_account?.id || '') === instagramBusinessId,
  );
  if (!page?.access_token) throw new Error('instagram_page_token_not_found');
  return String(page.access_token);
}

export async function sendInstagramMeta(
  input: { to: string; text: string },
  options: { manual?: boolean } = {},
) {
  if (!options.manual && process.env.META_SEND_MODE !== 'live') {
    throw new Error('real_sends_disabled');
  }

  const db = createSupabaseServiceClient();
  const { data: config } = await db
    .from('integraciones_secretas')
    .select('wa_access_token')
    .eq('id', 'global')
    .maybeSingle();
  if (!config?.wa_access_token) throw new Error('meta_user_token_not_configured');

  const instagramBusinessId = process.env.META_INSTAGRAM_BUSINESS_ID || DEFAULT_IG_BUSINESS_ID;
  const pageAccessToken = await resolvePageAccessToken(config.wa_access_token, instagramBusinessId);
  const version = process.env.META_GRAPH_VERSION || 'v26.0';

  const response = await fetch(
    `https://graph.facebook.com/${version}/${encodeURIComponent(instagramBusinessId)}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${pageAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipient: { id: input.to },
        message: { text: input.text },
      }),
    },
  );
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    await db.from('messaging_transport_status').upsert({
      transport: 'instagram_api',
      status: 'error',
      last_error: `Meta Instagram HTTP ${response.status}`,
      updated_at: new Date().toISOString(),
    });
    throw new Error(`instagram_send_failed:${response.status}`);
  }

  await db.from('messaging_transport_status').upsert({
    transport: 'instagram_api',
    status: 'connected',
    last_outbound_at: new Date().toISOString(),
    last_error: null,
    updated_at: new Date().toISOString(),
  });

  return {
    providerMessageId: String(body.message_id ?? body.messages?.[0]?.id ?? ''),
    raw: body,
  };
}
