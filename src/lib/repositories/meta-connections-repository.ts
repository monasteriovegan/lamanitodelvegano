import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { activeMetaAssetBusinessUnit, metaAssetReference } from '@/lib/meta/asset-routing';
import type { NormalizedMessage } from '@/lib/messaging/types';
import { decryptMetaToken } from '@/lib/meta/token-crypto';

type MetaAssetType = 'instagram_account' | 'whatsapp_phone_number';

export class MetaConnectionsRepository {
  constructor(private readonly db: SupabaseClient) {}

  async resolveBusinessUnitForMessage(message: NormalizedMessage): Promise<string | null> {
    const asset = metaAssetReference(message);
    if (!asset) return null;

    const { data, error } = await this.db
      .from('meta_connection_assets')
      .select('business_unit_id,meta_connections!inner(business_unit_id,status)')
      .eq('asset_type', asset.assetType)
      .eq('external_id', asset.externalId)
      .eq('selected', true)
      .eq('meta_connections.status', 'active')
      .maybeSingle();
    if (error) throw error;
    return activeMetaAssetBusinessUnit(data);
  }

  async getActiveCredential(businessUnitId: string, assetType: MetaAssetType) {
    const { data: asset, error: assetError } = await this.db
      .from('meta_connection_assets')
      .select('connection_id,external_id,metadata')
      .eq('business_unit_id', businessUnitId)
      .eq('asset_type', assetType)
      .eq('selected', true)
      .limit(1)
      .maybeSingle();
    if (assetError) throw assetError;
    if (!asset) throw new Error(`meta_asset_not_connected:${assetType}`);

    const { data: connection, error: connectionError } = await this.db
      .from('meta_connections')
      .select('access_token_ciphertext,access_token_iv,access_token_tag,status,token_expires_at')
      .eq('id', asset.connection_id)
      .eq('business_unit_id', businessUnitId)
      .eq('status', 'active')
      .maybeSingle();
    if (connectionError) throw connectionError;
    if (!connection) throw new Error('meta_connection_not_active');
    if (connection.token_expires_at && new Date(connection.token_expires_at).getTime() <= Date.now()) {
      await this.db.from('meta_connections').update({ status: 'expired', last_error_code: 'token_expired' })
        .eq('id', asset.connection_id).eq('business_unit_id', businessUnitId);
      throw new Error('meta_reauthorization_required');
    }
    const key = process.env.META_TOKEN_ENCRYPTION_KEY;
    if (!key) throw new Error('token_encryption_key_not_configured');
    return {
      accessToken: decryptMetaToken({
        ciphertext: connection.access_token_ciphertext,
        iv: connection.access_token_iv,
        tag: connection.access_token_tag,
      }, key),
      externalId: String(asset.external_id),
      metadata: (asset.metadata || {}) as Record<string, string>,
      connectionId: String(asset.connection_id),
    };
  }

  async getInstagramLoginCredential(businessUnitId: string) {
    const { data: connection, error } = await this.db
      .from('meta_connections')
      .select('id,external_user_id,access_token_ciphertext,access_token_iv,access_token_tag,status,token_expires_at')
      .eq('business_unit_id', businessUnitId)
      .eq('provider', 'meta_instagram_login')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!connection) throw new Error('instagram_login_not_connected');

    if (connection.token_expires_at && new Date(connection.token_expires_at).getTime() <= Date.now()) {
      await this.db.from('meta_connections').update({ status: 'expired', last_error_code: 'token_expired' })
        .eq('id', connection.id).eq('business_unit_id', businessUnitId);
      throw new Error('instagram_login_reauthorization_required');
    }

    const key = process.env.META_TOKEN_ENCRYPTION_KEY;
    if (!key) throw new Error('token_encryption_key_not_configured');
    return {
      accessToken: decryptMetaToken({
        ciphertext: connection.access_token_ciphertext,
        iv: connection.access_token_iv,
        tag: connection.access_token_tag,
      }, key),
      externalId: String(connection.external_user_id),
      connectionId: String(connection.id),
      tokenExpiresAt: connection.token_expires_at ? String(connection.token_expires_at) : null,
    };
  }
}
