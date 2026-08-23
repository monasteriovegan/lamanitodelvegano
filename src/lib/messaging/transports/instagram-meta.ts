import 'server-only';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { MetaConnectionsRepository } from '@/lib/repositories/meta-connections-repository';

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

  const pages = Array.isArray(body.data) ? body.data as Array<{ access_token?: string; instagram_business_account?: { id?: string } }> : [];
  const page = pages.find(
    (item) => String(item?.instagram_business_account?.id || '') === instagramBusinessId,
  );
  if (!page?.access_token) throw new Error('instagram_page_token_not_found');
  return String(page.access_token);
}

async function sendWithFacebookLogin(input: { to: string; text: string }, userAccessToken: string, instagramBusinessId: string) {
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
  options: { manual?: boolean; automatic?: boolean; businessUnitId: string },
) {
  if (!options.manual && !options.automatic && process.env.META_SEND_MODE !== 'live') {
    throw new Error('real_sends_disabled');
  }

  const db = createSupabaseServiceClient();
  const credential = await new MetaConnectionsRepository(db).getActiveCredential(
    options.businessUnitId,
    'instagram_account',
  );

  const result = await sendWithFacebookLogin(input, credential.accessToken, credential.externalId);
  const transportMode = 'facebook_login' as const;

  const { response, body } = result as { response: Response; body: { message_id?: string; messages?: Array<{ id?: string }> } };
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
