import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { getCurrentAdminUser } from '@/lib/supabase/server-auth';
import {
  instagramUsernameFromStoredPayload,
  isPlaceholderInstagramName,
  normalizeInstagramUsername,
} from '@/lib/messaging/instagram-identity';

export async function GET(request: Request) {
  const admin = await getCurrentAdminUser();
  if (!admin || !['admin', 'soporte', 'owner', 'supervisor', 'human_agent'].includes(admin.rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const requestedChannel = new URL(request.url).searchParams.get('channel');
  const allowedChannels = ['whatsapp', 'instagram', 'web'];
  const db = createSupabaseServiceClient();
  let query = db
    .from('conversations')
    .select('id,customer_id,contact_id,channel,external_conversation_id,last_message_at,status,automation_status,human_takeover,unread_count,provider,transport,metadata,labels,ai_enabled')
    .in('channel', allowedChannels)
    .order('last_message_at', { ascending: false });

  if (requestedChannel && allowedChannels.includes(requestedChannel)) query = query.eq('channel', requestedChannel);
  const { data: conversations, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const rows = conversations || [];
  if (rows.length === 0) return NextResponse.json({ data: [] });

  const contactIds = Array.from(new Set(rows.map((row: any) => row.customer_id || row.contact_id).filter(Boolean)));
  const conversationIds = rows.map((row: any) => row.id);
  const [{ data: contacts }, { data: summaries, error: summaryError }] = await Promise.all([
    contactIds.length
      ? db.from('omnichannel_contacts').select('id,display_name,nombre,phone,email,external_id,crm_status,metadata').in('id', contactIds)
      : Promise.resolve({ data: [] as any[] }),
    db.rpc('admin_conversation_inbox_summary_v1', { p_conversation_ids: conversationIds }),
  ]);
  if (summaryError) return NextResponse.json({ error: summaryError.message }, { status: 400 });

  const contactMap = new Map((contacts || []).map((contact: any) => [contact.id, contact]));
  const summaryMap = new Map((summaries || []).map((summary: any) => [String(summary.conversation_id), summary]));

  const data = rows
    .filter((row: any) => Boolean(summaryMap.get(row.id)?.last_message_at))
    .map((row: any) => {
      const contact = contactMap.get(row.customer_id || row.contact_id);
      const summary = summaryMap.get(row.id) as any;
      const lastInboundAt = summary?.last_inbound_at || null;
      const serviceWindowExpiresAt = lastInboundAt
        ? new Date(new Date(lastInboundAt).getTime() + 24 * 60 * 60 * 1000).toISOString()
        : null;
      const personal = Boolean(contact?.metadata?.personal || row.metadata?.personal || row.labels?.includes?.('personal'));
      const instagramUsername = row.channel === 'instagram'
        ? normalizeInstagramUsername(row.metadata?.external_username)
          || normalizeInstagramUsername(contact?.metadata?.instagram_username)
          || normalizeInstagramUsername(contact?.display_name)
          || instagramUsernameFromStoredPayload(summary?.last_payload)
          || null
        : null;
      const contactName = row.channel === 'instagram' && isPlaceholderInstagramName(contact?.nombre, row.external_conversation_id)
        ? null
        : contact?.nombre || null;
      const instagramDisplayName = row.channel === 'instagram'
        ? (
            contactName && instagramUsername
              ? `${contactName} · ${instagramUsername}`
              : contactName || instagramUsername || contact?.display_name || `Instagram ${row.external_conversation_id}`
          )
        : null;

      const visibleLastAt = summary?.last_message_at || row.last_message_at || null;
      const externalOutboundAt = row.channel === 'whatsapp' && typeof row.metadata?.external_outbound_at === 'string'
        ? row.metadata.external_outbound_at
        : null;
      const externalOutboundIsNewer = Boolean(
        externalOutboundAt
        && (!visibleLastAt || new Date(externalOutboundAt).getTime() > new Date(visibleLastAt).getTime()),
      );

      return {
        id: row.id,
        channel: row.channel,
        name: row.channel === 'instagram'
          ? instagramDisplayName
          : contact?.nombre || contact?.display_name || row.external_conversation_id,
        phone: row.channel === 'whatsapp' ? (contact?.phone || contact?.external_id || row.external_conversation_id) : null,
        email: contact?.email || null,
        externalId: row.channel === 'instagram'
          ? (instagramUsername ? instagramUsername.replace(/^@/, '') : contact?.external_id || row.external_conversation_id)
          : contact?.external_id || row.external_conversation_id,
        instagramUsername,
        customerId: row.customer_id || row.contact_id || null,
        crmStatus: contact?.crm_status || 'new',
        externalThreadId: row.external_conversation_id,
        status: row.status || row.automation_status || 'open',
        humanTakeover: Boolean(row.human_takeover),
        unreadCount: Number(row.unread_count || 0),
        provider: row.provider || null,
        transport: row.transport || null,
        lastMessage: externalOutboundIsNewer
          ? 'Respuesta enviada desde WhatsApp Business · contenido no sincronizado'
          : summary?.last_body || (summary?.last_message_type ? `[${summary.last_message_type}]` : null),
        lastDirection: externalOutboundIsNewer ? 'outbound' : summary?.last_direction || null,
        lastMessageStatus: externalOutboundIsNewer ? row.metadata?.external_outbound_status || 'sent' : summary?.last_status || null,
        lastMessageAt: externalOutboundIsNewer ? externalOutboundAt : visibleLastAt,
        lastInboundAt,
        serviceWindowExpiresAt,
        personal,
        aiEnabled: Boolean(row.ai_enabled) && !personal,
      };
    });

  return NextResponse.json({ data });
}
