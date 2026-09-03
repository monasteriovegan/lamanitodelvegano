import 'server-only';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { MetaConnectionsRepository } from '@/lib/repositories/meta-connections-repository';

async function resolvePageAccessToken(
  userAccessToken: string,
  instagramBusinessId: string,
  configuredPageId?: string,
) {
  const version = process.env.META_GRAPH_VERSION || 'v26.0';
  try {
    const response = await fetch(
      `https://graph.facebook.com/${version}/me/accounts?fields=id,name,access_token,instagram_business_account&limit=100`,
      {
        headers: { Authorization: `Bearer ${userAccessToken}` },
        cache: 'no-store',
      },
    );
    const body = await response.json().catch(() => ({}));
    if (response.ok) {
      const pages = Array.isArray(body.data)
        ? body.data as Array<{ id?: string; access_token?: string; instagram_business_account?: { id?: string } }>
        : [];
      const page = pages.find(
        (item) => String(item?.instagram_business_account?.id || '') === instagramBusinessId,
      );
      if (page?.id && page?.access_token) {
        return { pageId: String(page.id), pageAccessToken: String(page.access_token) };
      }
    }
  } catch {}

  const pageId = String(configuredPageId || '');
  if (!pageId) throw new Error('instagram_page_token_not_found');
  const probe = await fetch(
    `https://graph.facebook.com/${version}/${encodeURIComponent(pageId)}?fields=id`,
    {
      headers: { Authorization: `Bearer ${userAccessToken}` },
      cache: 'no-store',
    },
  );
  const probeBody = await probe.json().catch(() => ({}));
  if (!probe.ok || String(probeBody?.id || '') !== pageId) {
    throw new Error('instagram_page_token_not_found');
  }
  return { pageId, pageAccessToken: userAccessToken };
}

async function sendWithInstagramLogin(
  input: { to: string; text: string },
  accessToken: string,
  instagramUserId: string,
) {
  const version = process.env.META_GRAPH_VERSION || 'v26.0';
  const response = await fetch(
    `https://graph.instagram.com/${version}/${encodeURIComponent(instagramUserId)}/messages`,
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

async function sendWithFacebookLogin(
  input: { to: string; text: string },
  userAccessToken: string,
  instagramBusinessId: string,
  configuredPageId?: string,
) {
  const { pageId, pageAccessToken } = await resolvePageAccessToken(
    userAccessToken,
    instagramBusinessId,
    configuredPageId,
  );
  const version = process.env.META_GRAPH_VERSION || 'v26.0';
  const response = await fetch(
    `https://graph.facebook.com/${version}/${encodeURIComponent(pageId)}/messages`,
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
  const repository = new MetaConnectionsRepository(db);
  const routingCredential = await repository.getActiveCredential(
    options.businessUnitId,
    'instagram_account',
  );

  let result: { response: Response; body: { message_id?: string; messages?: Array<{ id?: string }> } };
  let transportMode: 'instagram_login' | 'facebook_login' = 'facebook_login';
  try {
    const instagramCredential = await repository.getInstagramLoginCredential(
      options.businessUnitId,
      routingCredential.externalId,
    );
    result = await sendWithInstagramLogin(
      input,
      instagramCredential.accessToken,
      instagramCredential.externalId,
    );
    transportMode = 'instagram_login';
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown';
    if (reason !== 'instagram_login_not_connected' && reason !== 'instagram_login_reauthorization_required') {
      throw error;
    }
    result = await sendWithFacebookLogin(
      input,
      routingCredential.accessToken,
      routingCredential.externalId,
      routingCredential.metadata?.page_id,
    );
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
