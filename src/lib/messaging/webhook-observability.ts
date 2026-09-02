import type { SupabaseClient } from '@supabase/supabase-js';

export type WhatsAppWebhookOutcome =
  | 'received'
  | 'signature_invalid'
  | 'invalid_json'
  | 'payload_ignored'
  | 'phone_number_mismatch'
  | 'asset_not_connected'
  | 'duplicate'
  | 'persistence_failed'
  | 'persisted';

type WhatsAppEnvelopeInspection = {
  objectType: string | null;
  fields: string[];
  messageCount: number;
  statusCount: number;
  echoCount: number;
  observedPhoneNumberId: string | null;
};

type RecordWhatsAppWebhookObservationInput = {
  outcome: WhatsAppWebhookOutcome;
  requestId: string;
  observedPhoneNumberId?: string | null;
  configuredPhoneNumberId?: string | null;
  counts?: { messages: number; statuses: number; echoes: number };
  errorCode?: string | null;
};

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function inspectWhatsAppEnvelope(payload: unknown): WhatsAppEnvelopeInspection {
  const envelope = record(payload);
  const fields = new Set<string>();
  let messageCount = 0;
  let statusCount = 0;
  let echoCount = 0;
  let observedPhoneNumberId: string | null = null;

  for (const entryValue of array(envelope.entry)) {
    const entry = record(entryValue);
    for (const changeValue of array(entry.changes)) {
      const change = record(changeValue);
      if (typeof change.field === 'string' && change.field) fields.add(change.field);
      const value = record(change.value);
      const metadata = record(value.metadata);
      messageCount += array(value.messages).length;
      statusCount += array(value.statuses).length;
      echoCount += array(value.message_echoes).length + array(value.smb_message_echoes).length;
      if (!observedPhoneNumberId && metadata.phone_number_id != null) {
        observedPhoneNumberId = String(metadata.phone_number_id);
      }
    }
  }

  return {
    objectType: typeof envelope.object === 'string' ? envelope.object : null,
    fields: [...fields],
    messageCount,
    statusCount,
    echoCount,
    observedPhoneNumberId,
  };
}

function safeCode(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.replace(/[^a-zA-Z0-9_.:-]/g, '').slice(0, 80);
  return normalized || null;
}

export async function recordWhatsAppWebhookObservation(
  db: SupabaseClient,
  input: RecordWhatsAppWebhookObservationInput,
): Promise<void> {
  const now = new Date().toISOString();
  const { data, error: selectError } = await db
    .from('messaging_transport_status')
    .select('metadata')
    .eq('transport', 'cloud_api')
    .maybeSingle();

  const currentMetadata = !selectError && data?.metadata && typeof data.metadata === 'object'
    ? data.metadata as Record<string, unknown>
    : {};
  const currentWebhook = currentMetadata.webhook && typeof currentMetadata.webhook === 'object'
    ? currentMetadata.webhook as Record<string, unknown>
    : {};
  const counts = input.counts ?? { messages: 0, statuses: 0, echoes: 0 };
  const hasBothPhoneIds = Boolean(input.observedPhoneNumberId && input.configuredPhoneNumberId);
  const errorCode = safeCode(input.errorCode);

  const webhook = {
    ...currentWebhook,
    last_received_at: now,
    last_outcome: input.outcome,
    request_id: safeCode(input.requestId),
    message_count: counts.messages,
    status_count: counts.statuses,
    echo_count: counts.echoes,
    observed_phone_number_id: input.observedPhoneNumberId ?? null,
    configured_phone_number_id: input.configuredPhoneNumberId ?? null,
    phone_number_match: hasBothPhoneIds
      ? input.observedPhoneNumberId === input.configuredPhoneNumberId
      : null,
    error_code: errorCode,
  };

  const { error: upsertError } = await db.from('messaging_transport_status').upsert({
    transport: 'cloud_api',
    metadata: { ...currentMetadata, webhook },
    updated_at: now,
  });

  if (selectError || upsertError) {
    console.error('whatsapp_webhook_observation_failed', {
      stage: upsertError ? 'upsert' : 'select',
      code: safeCode(upsertError?.code || selectError?.code || 'unknown'),
    });
  }
}
