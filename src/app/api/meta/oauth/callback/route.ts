import { getCurrentAdminUser } from '@/lib/supabase/server-auth';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { discoverMetaAssets, exchangeMetaCode } from '@/lib/meta/oauth';
import { encryptMetaToken, hashOAuthState } from '@/lib/meta/token-crypto';

export const dynamic = 'force-dynamic';

function safeRedirect(origin: string, params: Record<string, string>) {
  const target = new URL('/admin/integraciones', origin);
  for (const [key, value] of Object.entries(params)) target.searchParams.set(key, value);
  return Response.redirect(target);
}

export async function GET(request: Request) {
  const user = await getCurrentAdminUser();
  const url = new URL(request.url);
  if (!user) return safeRedirect(url.origin, { meta_error: 'unauthorized' });
  const state = url.searchParams.get('state');
  const code = url.searchParams.get('code');
  if (!state || !code) return safeRedirect(url.origin, { meta_error: 'oauth_denied' });

  const db = createSupabaseServiceClient();
  const { data: consumed, error: stateError } = await db.rpc('consume_meta_oauth_state', {
    p_state_hash: hashOAuthState(state), p_user_id: user.id,
  });
  const stateRow = consumed?.[0];
  if (stateError || !stateRow) return safeRedirect(url.origin, { meta_error: 'invalid_or_expired_state' });

  try {
    const exchanged = await exchangeMetaCode(code, url.origin);
    const key = process.env.META_TOKEN_ENCRYPTION_KEY;
    if (!key) throw new Error('token_encryption_key_not_configured');
    const encrypted = encryptMetaToken(exchanged.accessToken, key);
    const assets = await discoverMetaAssets(exchanged.accessToken);
    const { data: connection, error: connectionError } = await db.from('meta_connections').insert({
      business_unit_id: stateRow.business_unit_id,
      access_token_ciphertext: encrypted.ciphertext,
      access_token_iv: encrypted.iv,
      access_token_tag: encrypted.tag,
      granted_scopes: stateRow.requested_capabilities,
      token_expires_at: exchanged.expiresIn ? new Date(Date.now() + exchanged.expiresIn * 1000).toISOString() : null,
      status: 'pending', connected_by: user.id,
    }).select('id').single();
    if (connectionError) throw connectionError;
    for (const asset of assets) {
      const { data: existing } = await db.from('meta_connection_assets').select('id,business_unit_id')
        .eq('asset_type', asset.asset_type).eq('external_id', asset.external_id).maybeSingle();
      if (existing && existing.business_unit_id !== stateRow.business_unit_id) continue;
      const payload = { connection_id: connection.id, business_unit_id: stateRow.business_unit_id, ...asset, selected: false, subscribed: false };
      const result = existing
        ? await db.from('meta_connection_assets').update(payload).eq('id', existing.id).eq('business_unit_id', stateRow.business_unit_id)
        : await db.from('meta_connection_assets').insert(payload);
      if (result.error) throw result.error;
    }
    return safeRedirect(url.origin, { meta_connection: connection.id, meta_select: '1' });
  } catch (error) {
    console.error('meta_oauth_callback_failed', { reason: error instanceof Error ? error.message.split(':')[0] : 'unknown' });
    return safeRedirect(url.origin, { meta_error: 'callback_failed' });
  }
}
