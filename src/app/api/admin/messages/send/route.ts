import { getCurrentAdminUser } from '@/lib/supabase/server-auth';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { sendMessage } from '@/lib/messaging/send';
import { persistMessage } from '@/lib/messaging/messages';
import { normalizePhone } from '@/lib/messaging/normalize';
import { ConversationRepository } from '@/lib/repositories/conversations-repository';

const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

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
  if (!body?.conversationId || typeof body.text !== 'string' || !body.text.trim() || body.text.length > 4096) {
    return Response.json({ error: 'invalid_payload' }, { status: 400 });
  }

  const db = createSupabaseServiceClient();
  const conversation = await new ConversationRepository(db).getById(body.conversationId);
  if (!conversation || !['whatsapp', 'instagram'].includes(conversation.channel)) {
    return Response.json({ error: 'conversation_not_found' }, { status: 404 });
  }

  // Prevent accidental provider charges/rejections: this endpoint only sends
  // normal free-form replies while the standard 24h customer-service window is open.
  // Template/campaign sends must use a separate explicit flow later.
  const { data: lastInbound } = await db
    .from('omnichannel_messages')
    .select('sent_at,created_at')
    .eq('conversation_id', conversation.id)
    .eq('direction', 'inbound')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const inboundAt = lastInbound?.sent_at || lastInbound?.created_at || null;
  const windowOpen = Boolean(inboundAt && Date.now() - new Date(inboundAt).getTime() < SERVICE_WINDOW_MS);
  if (!windowOpen) {
    return Response.json({
      error: 'service_window_closed',
      channel: conversation.channel,
      lastInboundAt: inboundAt,
      requiresTemplate: conversation.channel === 'whatsapp',
      message: conversation.channel === 'whatsapp'
        ? 'La ventana de 24 horas está cerrada. Para evitar un envío API cobrable/no permitido, usa la app móvil o una plantilla explícita.'
        : 'La ventana estándar de respuesta de Instagram está cerrada.',
    }, { status: 409 });
  }

  try {
    const text = body.text.trim();
    const result = await sendMessage({
      channel: conversation.channel as 'whatsapp' | 'instagram',
      conversationId: conversation.id,
      customerId: conversation.customer_id ?? undefined,
      to: conversation.external_thread_id,
      text,
      mode: 'manual',
    });

    const externalId = conversation.channel === 'whatsapp'
      ? normalizePhone(conversation.external_thread_id)
      : conversation.external_thread_id;
    const message = await persistMessage(db, {
      channel: conversation.channel as 'whatsapp' | 'instagram',
      provider: 'meta',
      transport: conversation.channel === 'whatsapp' ? 'cloud_api' : 'instagram_api',
      provider_message_id: result.providerMessageId,
      external_thread_id: externalId,
      external_user_id: externalId,
      direction: 'outbound',
      sender_type: 'human',
      text,
      message_type: 'text',
      sent_at: new Date().toISOString(),
      raw_payload: result.raw,
    });

    return Response.json({
      ok: true,
      channel: conversation.channel,
      messageId: message.messageId,
      providerMessageId: result.providerMessageId,
      ai_called: false,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown';
    console.error('manual_omnichannel_send_failed', { channel: conversation.channel, reason });

    const expiredToken = reason.includes('401') || reason.includes('token') || reason.includes('OAuth');
    return Response.json({
      error: expiredToken ? 'meta_token_expired_or_invalid' : 'send_failed',
      detail: reason,
    }, { status: 502 });
  }
}
