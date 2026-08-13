import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { persistMessage } from '@/lib/messaging/messages';

const TEST_TO = '56951975639';
const TEST_TEXT = 'PRUEBA OUTBOUND CLOUD 001';

export async function GET() {
  const db = createSupabaseServiceClient();

  const { data: conversation, error: conversationError } = await db
    .from('conversations')
    .select('id, external_conversation_id')
    .eq('channel', 'whatsapp')
    .eq('external_conversation_id', TEST_TO)
    .maybeSingle();

  if (conversationError || !conversation) {
    return Response.json({ ok: false, error: 'test_conversation_not_found' }, { status: 404 });
  }

  const { data: existing } = await db
    .from('omnichannel_messages')
    .select('id, external_message_id')
    .eq('conversation_id', conversation.id)
    .eq('direction', 'outbound')
    .eq('body', TEST_TEXT)
    .maybeSingle();

  if (existing) {
    return Response.json({ ok: true, already_sent: true, message_id: existing.id });
  }

  const { data: config, error: configError } = await db
    .from('integraciones_secretas')
    .select('wa_access_token, wa_phone_number_id')
    .eq('id', 'global')
    .maybeSingle();

  if (configError || !config?.wa_access_token || !config.wa_phone_number_id) {
    return Response.json({ ok: false, error: 'whatsapp_cloud_not_configured' }, { status: 500 });
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
        to: TEST_TO,
        type: 'text',
        text: { body: TEST_TEXT, preview_url: false },
      }),
    },
  );

  const metaBody = await response.json().catch(() => ({}));
  if (!response.ok) {
    return Response.json(
      {
        ok: false,
        error: 'meta_send_failed',
        status: response.status,
        meta_code: metaBody?.error?.code ?? null,
        meta_subcode: metaBody?.error?.error_subcode ?? null,
        meta_type: metaBody?.error?.type ?? null,
      },
      { status: 502 },
    );
  }

  const providerMessageId = String(metaBody?.messages?.[0]?.id ?? '');
  if (!providerMessageId) {
    return Response.json({ ok: false, error: 'meta_missing_message_id' }, { status: 502 });
  }

  const stored = await persistMessage(db, {
    channel: 'whatsapp',
    provider: 'meta',
    transport: 'cloud_api',
    provider_message_id: providerMessageId,
    external_thread_id: TEST_TO,
    external_user_id: TEST_TO,
    direction: 'outbound',
    sender_type: 'human',
    text: TEST_TEXT,
    message_type: 'text',
    sent_at: new Date().toISOString(),
    raw_payload: metaBody,
  });

  return Response.json({
    ok: true,
    already_sent: false,
    message_id: stored.messageId,
    provider_message_id: providerMessageId,
    ai_called: false,
  });
}
