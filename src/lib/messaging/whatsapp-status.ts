import type { MetaSendMode } from './capability-policy';

type TransportStatus = {
  transport?: unknown;
  status?: unknown;
  last_inbound_at?: unknown;
  last_outbound_at?: unknown;
  last_error?: unknown;
  updated_at?: unknown;
  metadata?: { webhook?: { outcome?: unknown } } | null;
};

type IntegrationStatus = { wa_phone_number_id?: unknown; ai_enabled?: unknown };
type AssetStatus = {
  external_id?: unknown;
  metadata?: {
    waba_id?: unknown;
    display_phone_number?: unknown;
    quality_rating?: unknown;
    business_app?: unknown;
  } | null;
};

export function buildWhatsAppStatus(input: {
  transport: TransportStatus | null;
  integration: IntegrationStatus | null;
  asset: AssetStatus | null;
  callbackUrl?: string | null;
  sendMode: MetaSendMode;
}) {
  const metadata = input.asset?.metadata && typeof input.asset.metadata === 'object'
    ? input.asset.metadata
    : {};
  const webhook = input.transport?.metadata?.webhook;
  const phoneNumberId = String(input.asset?.external_id || input.integration?.wa_phone_number_id || '').trim();
  const aiEnabled = typeof input.integration?.ai_enabled === 'boolean'
    ? (input.integration.ai_enabled ? 'ON' : 'OFF')
    : 'unknown';

  return {
    number: String(metadata.display_phone_number || '').trim() || 'unknown',
    business_app: String(metadata.business_app || '').trim() || 'unknown',
    cloud_api: String(input.transport?.status || '').trim() || 'unknown',
    waba_id: String(metadata.waba_id || '').trim() || 'unknown',
    phone_number_id: phoneNumberId || 'unknown',
    quality: String(metadata.quality_rating || '').trim() || 'unknown',
    callback: String(input.callbackUrl || '').trim() || 'unknown',
    webhook: String(webhook?.outcome || '').trim() || 'unknown',
    crm_sync: phoneNumberId ? 'configured' : 'unknown',
    automatic_ai: aiEnabled,
    real_sends: input.sendMode === 'live' ? 'ENABLED' : input.sendMode === 'read_only' ? 'READ_ONLY' : 'DISABLED',
    transports: input.transport ? [input.transport] : [],
  };
}
