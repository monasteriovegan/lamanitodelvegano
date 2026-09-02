type MessageLike = {
  channel: string;
  raw_payload: unknown;
};

export type MetaAssetReference = {
  assetType: 'instagram_account' | 'whatsapp_phone_number';
  externalId: string;
};

type MetaConnectionResolution = {
  business_unit_id?: unknown;
  status?: unknown;
};

export type MetaAssetResolutionRow = {
  business_unit_id?: unknown;
  meta_connections?: MetaConnectionResolution | MetaConnectionResolution[] | null;
};

export function activeMetaAssetBusinessUnit(row: MetaAssetResolutionRow | null): string | null {
  const businessUnitId = String(row?.business_unit_id || '').trim();
  if (!businessUnitId) return null;

  const relation = row?.meta_connections;
  const connection = Array.isArray(relation) ? relation[0] : relation;
  if (!connection || connection.status !== 'active') return null;
  if (String(connection.business_unit_id || '').trim() !== businessUnitId) return null;

  return businessUnitId;
}

export function metaAssetReference(message: MessageLike): MetaAssetReference | null {
  const payload = message.raw_payload as {
    business_instagram_id?: unknown;
    metadata?: { phone_number_id?: unknown };
  } | null;

  if (message.channel === 'instagram') {
    const externalId = String(payload?.business_instagram_id || '').trim();
    return externalId ? { assetType: 'instagram_account', externalId } : null;
  }

  if (message.channel === 'whatsapp') {
    const externalId = String(payload?.metadata?.phone_number_id || '').trim();
    return externalId ? { assetType: 'whatsapp_phone_number', externalId } : null;
  }

  return null;
}
