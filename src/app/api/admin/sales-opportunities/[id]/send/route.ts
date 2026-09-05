import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { getCurrentAdminUser } from '@/lib/supabase/server-auth';
import { sendMessage } from '@/lib/messaging/send';
import { persistMessage } from '@/lib/messaging/messages';

interface RouteParams { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: RouteParams) {
  const admin = await getCurrentAdminUser();
  if (!admin || admin.rol !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const message = String(body?.message || '').trim();
  if (!message || message.length > 1500) return NextResponse.json({ error: 'Mensaje inválido.' }, { status: 400 });

  const db = createSupabaseServiceClient();
  const { data: opportunity, error: oppError } = await db.from('sales_opportunities')
    .select('*')
    .eq('id', id)
    .in('status', ['open', 'snoozed'])
    .maybeSingle();
  if (oppError) return NextResponse.json({ error: oppError.message }, { status: 500 });
  if (!opportunity) return NextResponse.json({ error: 'Oportunidad no disponible.' }, { status: 404 });
  if (!['instagram', 'whatsapp'].includes(String(opportunity.channel))) {
    return NextResponse.json({ error: 'Canal no soportado.' }, { status: 400 });
  }

  const { data: conversation, error: convError } = await db.from('conversations')
    .select('id,external_conversation_id,customer_id,channel,human_takeover,metadata,labels')
    .eq('id', opportunity.conversation_id)
    .maybeSingle();
  if (convError) return NextResponse.json({ error: convError.message }, { status: 500 });
  if (!conversation?.external_conversation_id) return NextResponse.json({ error: 'La conversación no tiene destinatario válido.' }, { status: 409 });
  if (conversation.human_takeover && String(conversation.metadata?.takeover_owner || '') && String(conversation.metadata?.takeover_owner || '') !== String(admin.id)) {
    return NextResponse.json({ error: 'La conversación está tomada por otro operador.' }, { status: 409 });
  }

  try {
    const result = await sendMessage({
      channel: opportunity.channel as 'instagram' | 'whatsapp',
      conversationId: opportunity.conversation_id,
      customerId: opportunity.customer_id || undefined,
      to: String(conversation.external_conversation_id),
      text: message,
      mode: 'manual',
      automationAuthorized: false,
      agent: 'human',
    });
    const providerMessageId = String((result as any)?.providerMessageId || '');
    const sentAt = new Date().toISOString();

    let persistError: string | null = null;
    try {
      await persistMessage(db, {
        channel: opportunity.channel,
        provider: 'meta',
        transport: opportunity.channel === 'whatsapp' ? 'cloud_api' : 'instagram_api',
        provider_message_id: providerMessageId || `manual-opportunity:${id}:${Date.now()}`,
        external_thread_id: String(conversation.external_conversation_id),
        external_user_id: String(conversation.external_conversation_id),
        direction: 'outbound',
        sender_type: 'human',
        text: message,
        message_type: 'text',
        sent_at: sentAt,
        raw_payload: {
          source: 'sales_opportunity_manual',
          opportunity_id: id,
          admin_id: admin.id,
          provider_message_id: providerMessageId || null,
        },
      });
    } catch (error) {
      persistError = error instanceof Error ? error.message : 'persist_failed';
      console.error('manual_opportunity_persist_failed_after_send', { opportunityId: id, providerMessageId: providerMessageId || null });
    }

    await db.from('sales_opportunities').update({
      status: 'open',
      recommended_message: message,
      last_followup_at: sentAt,
      last_provider_message_id: providerMessageId || null,
      snoozed_until: null,
      last_error: persistError,
    }).eq('id', id);

    return NextResponse.json({ ok: true, providerMessageId: providerMessageId || null, persisted: !persistError });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'send_failed';
    return NextResponse.json({ error: `No se pudo enviar: ${reason}` }, { status: 409 });
  }
}
