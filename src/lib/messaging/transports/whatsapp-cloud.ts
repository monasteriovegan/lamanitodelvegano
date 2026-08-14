import 'server-only';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { normalizarTelefonoChile } from '@/lib/whatsapp/client';

export async function sendWhatsAppCloud(
  input: { to: string; text: string },
  options: { manual?: boolean; automatic?: boolean } = {},
) {
  // Human CRM sends and explicitly authorized Remy sends are allowed.
  // Every other automatic path remains blocked unless the global Meta send mode is live.
  if (!options.manual && !options.automatic && process.env.META_SEND_MODE !== 'live') {
    throw new Error('real_sends_disabled');
  }

  const db = createSupabaseServiceClient();
  const { data: config } = await db
    .from('integraciones_secretas')
    .select('wa_access_token,wa_phone_number_id')
    .eq('id', 'global')
    .maybeSingle();
  if (!config?.wa_access_token || !config.wa_phone_number_id) {
    throw new Error('whatsapp_cloud_not_configured');
  }

  const version = process.env.META_GRAPH_VERSION || 'v26.0';
  const response = await fetch(
    `https://graph.facebook.com/${version}/${encodeURIComponent(config.wa_phone_number_id)}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.wa_access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: normalizarTelefonoChile(input.to),
        type: 'text',
        text: { body: input.text, preview_url: false },
      }),
      cache: 'no-store',
    },
  );
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    await db.from('messaging_transport_status').upsert({
      transport: 'cloud_api',
      status: 'error',
      last_error: `Meta HTTP ${response.status}`,
      updated_at: new Date().toISOString(),
    });
    throw new Error(`meta_send_failed:${response.status}`);
  }

  await db.from('messaging_transport_status').upsert({
    transport: 'cloud_api',
    status: 'connected',
    last_outbound_at: new Date().toISOString(),
    last_error: null,
    updated_at: new Date().toISOString(),
  });
  return {
    providerMessageId: String(body.messages?.[0]?.id ?? ''),
    raw: body,
  };
}
