type MessageLike = {
  channel: string;
  raw_payload: unknown;
};

export type MetaAssetReference = {
  assetType: 'instagram_account' | 'whatsapp_phone_number';
  externalId: string;
};

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
