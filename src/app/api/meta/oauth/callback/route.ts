import { getCurrentAdminUser } from '@/lib/supabase/server-auth';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { discoverMetaAssets, exchangeMetaCode } from '@/lib/meta/oauth';
import { discoverInstagramLoginProfile, exchangeInstagramLoginCode } from '@/lib/meta/instagram-login-oauth';
import { encryptMetaToken, hashOAuthState } from '@/lib/meta/token-crypto';

export const dynamic = 'force-dynamic';

function safeRedirect(origin: string, params: Record<string, string>) {
  const target = new URL('/admin/integraciones', origin);
  for (const [key, value] of Object.entries(params)) target.searchParams.set(key, value);
  return Response.redirect(target);
}

function isInstagramLoginState(capabilities: unknown) {
  return Array.isArray(capabilities) && capabilities.includes('instagram_business_basic');
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
    const key = process.env.META_TOKEN_ENCRYPTION_KEY;
    if (!key) throw new Error('token_encryption_key_not_configured');

    if (isInstagramLoginState(stateRow.requested_capabilities)) {
      const exchanged = await exchangeInstagramLoginCode(code, url.origin);
      const profile = await discoverInstagramLoginProfile(exchanged.accessToken);

      const { data: selectedAsset, error: assetError } = await db.from('meta_connection_assets')
        .select('external_id')
        .eq('business_unit_id', stateRow.business_unit_id)
        .eq('asset_type', 'instagram_account')
        .eq('selected', true)
        .limit(1)
        .maybeSingle();
      if (assetError) throw assetError;
      if (selectedAsset?.external_id && String(selectedAsset.external_id) !== profile.id) {
        throw new Error('instagram_login_wrong_account');
      }

      const encrypted = encryptMetaToken(exchanged.accessToken, key);
      await db.from('meta_connections').update({ status: 'revoked', last_error_code: 'reauthorized' })
        .eq('business_unit_id', stateRow.business_unit_id)
        .eq('provider', 'meta_instagram_login')
        .eq('status', 'active');

      const { error: connectionError } = await db.from('meta_connections').insert({
        business_unit_id: stateRow.business_unit_id,
        provider: 'meta_instagram_login',
        external_user_id: profile.id,
        access_token_ciphertext: encrypted.ciphertext,
        access_token_iv: encrypted.iv,
        access_token_tag: encrypted.tag,
        granted_scopes: stateRow.requested_capabilities,
        token_expires_at: exchanged.expiresIn ? new Date(Date.now() + exchanged.expiresIn * 1000).toISOString() : null,
        status: 'active',
        last_health_at: new Date().toISOString(),
        connected_by: user.id,
      });
      if (connectionError) throw connectionError;

      return safeRedirect(url.origin, { instagram_login: 'connected' });
    }

    const exchanged = await exchangeMetaCode(code, url.origin);
    const encrypted = encryptMetaToken(exchanged.accessToken, key);
    const assets = await discoverMetaAssets(exchanged.accessToken);
    const { data: connection, error: connectionError } = await db.from('meta_connections').insert({
      business_unit_id: stateRow.business_unit_id,
      provider: 'meta',
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
    const reason = error instanceof Error ? error.message.split(':')[0] : 'unknown';
    console.error('meta_oauth_callback_failed', { reason });
    return safeRedirect(url.origin, { meta_error: reason });
  }
}
