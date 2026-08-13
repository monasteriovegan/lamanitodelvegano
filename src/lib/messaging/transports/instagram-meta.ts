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

async function sendWithInstagramLogin(input: { to: string; text: string }, accessToken: string, igUserId: string) {
  const version = process.env.META_GRAPH_VERSION || 'v26.0';
  const response = await fetch(
    `https://graph.instagram.com/${version}/${encodeURIComponent(igUserId)}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipient: { id: input.to },
        message: { text: input.text },
      }),
      cache: 'no-store',
    },
  );
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

async function sendWithFacebookLogin(input: { to: string; text: string }, userAccessToken: string) {
  const instagramBusinessId = process.env.META_INSTAGRAM_BUSINESS_ID || DEFAULT_IG_BUSINESS_ID;
  const pageAccessToken = await resolvePageAccessToken(userAccessToken, instagramBusinessId);
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
      cache: 'no-store',
    },
  );
  const body = await response.json().catch(() => ({}));
  return { response, body };
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
    .select('wa_access_token,ig_access_token,ig_user_id')
    .eq('id', 'global')
    .maybeSingle();

  let result: { response: Response; body: any };
  let transportMode: 'instagram_login' | 'facebook_login';

  if (config?.ig_access_token && config?.ig_user_id) {
    result = await sendWithInstagramLogin(input, String(config.ig_access_token), String(config.ig_user_id));
    transportMode = 'instagram_login';
  } else if (config?.wa_access_token) {
    result = await sendWithFacebookLogin(input, String(config.wa_access_token));
    transportMode = 'facebook_login';
  } else {
    throw new Error('meta_instagram_token_not_configured');
  }

  const { response, body } = result;
  if (!response.ok) {
    await db.from('messaging_transport_status').upsert({
      transport: 'instagram_api',
      status: 'error',
      last_error: `Meta Instagram ${transportMode} HTTP ${response.status}`,
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
    raw: { ...body, transport_mode: transportMode },
  };
}
