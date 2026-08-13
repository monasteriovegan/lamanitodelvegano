import { getCurrentAdminUser } from '@/lib/supabase/server-auth';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { sendMessage } from '@/lib/messaging/send';
import { persistMessage } from '@/lib/messaging/messages';
import { normalizePhone } from '@/lib/messaging/normalize';
import { ConversationRepository } from '@/lib/repositories/conversations-repository';

export async function POST(request: Request) {
  const admin = await getCurrentAdminUser();
  if (!admin) return Response.json({ error: 'unauthorized' }, { status: 401 });
  if (!['owner', 'admin', 'supervisor', 'human_agent', 'soporte'].includes(admin.rol)) {
    return Response.json({ error: 'forbidden' }, { status: 403 });
  }

  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: 'invalid_origin' }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as {
    conversationId?: string;
    text?: string;
  } | null;
  if (
    !body?.conversationId ||
    typeof body.text !== 'string' ||
    !body.text.trim() ||
    body.text.length > 4096
  ) {
    return Response.json({ error: 'invalid_payload' }, { status: 400 });
  }

  const db = createSupabaseServiceClient();
  const conversation = await new ConversationRepository(db).findByChannel(body.conversationId, 'whatsapp');
  if (!conversation) {
    return Response.json({ error: 'conversation_not_found' }, { status: 404 });
  }

  try {
    const text = body.text.trim();
    const result = await sendMessage({
      channel: 'whatsapp',
      conversationId: conversation.id,
      customerId: conversation.customer_id ?? undefined,
      to: conversation.external_thread_id,
      text,
      mode: 'manual',
    });
    const message = await persistMessage(db, {
      channel: 'whatsapp',
      provider: 'meta',
      transport: 'cloud_api',
      provider_message_id: result.providerMessageId,
      external_thread_id: normalizePhone(conversation.external_thread_id),
      external_user_id: normalizePhone(conversation.external_thread_id),
      direction: 'outbound',
      sender_type: 'human',
      text,
      message_type: 'text',
      sent_at: new Date().toISOString(),
      raw_payload: result.raw,
    });
    return Response.json({
      ok: true,
      messageId: message.messageId,
      providerMessageId: result.providerMessageId,
      ai_called: false,
    });
  } catch (error) {
    console.error('manual_whatsapp_send_failed', {
      message: error instanceof Error ? error.message : 'unknown',
    });
    return Response.json({ error: 'send_failed' }, { status: 502 });
  }
}
