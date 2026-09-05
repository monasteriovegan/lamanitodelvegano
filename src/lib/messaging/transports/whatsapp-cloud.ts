import 'server-only';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { normalizarTelefonoChile } from '@/lib/whatsapp/client';
import { MetaConnectionsRepository } from '@/lib/repositories/meta-connections-repository';
import { automaticRepliesEnabled, evaluateMessagingCapability, resolveChannelSendMode } from '@/lib/messaging/capability-policy';
import { createWhatsAppCloudSender } from '@/lib/messaging/whatsapp-cloud-sender';

export async function sendWhatsAppCloud(
  input: { to: string; text: string },
  options: { manual?: boolean; automatic?: boolean; businessUnitId: string },
) {
  const db = createSupabaseServiceClient();
  const { data: settings, error: settingsError } = await db.from('channel_settings')
    .select('enabled,auto_reply_enabled,read_only_mode')
    .eq('business_unit_id', options.businessUnitId)
    .eq('channel', 'whatsapp')
    .maybeSingle();
  if (settingsError) throw settingsError;

  const sendMode = resolveChannelSendMode(settings);
  if (options.automatic && !automaticRepliesEnabled(settings)) {
    throw new Error(settings?.read_only_mode ? 'send_mode_read_only' : 'channel_disabled');
  }

  const send = createWhatsAppCloudSender({
    resolveSendMode: () => sendMode,
    evaluateCapability: evaluateMessagingCapability,
    getCredential: async (businessUnitId) => new MetaConnectionsRepository(db).getActiveCredential(
      businessUnitId,
      'whatsapp_phone_number',
    ),
    normalizePhone: normalizarTelefonoChile,
    fetchImpl: fetch,
    graphVersion: process.env.META_GRAPH_VERSION || 'v26.0',
    writeHealth: async (update) => {
      const now = new Date().toISOString();
      await db.from('messaging_transport_status').upsert({
        transport: 'cloud_api',
        status: update.status,
        last_error: update.lastError,
        ...(update.outboundSucceeded ? { last_outbound_at: now } : {}),
        updated_at: now,
      });
    },
  });
  return send(input, options);
}
