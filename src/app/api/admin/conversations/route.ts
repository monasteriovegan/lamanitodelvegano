import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { getCurrentAdminUser } from '@/lib/supabase/server-auth';

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
  const [{ data: contacts }, { data: messages }] = await Promise.all([
    contactIds.length
      ? db.from('omnichannel_contacts').select('id,display_name,nombre,phone,email,external_id,crm_status,metadata').in('id', contactIds)
      : Promise.resolve({ data: [] as any[] }),
    db.from('omnichannel_messages')
      .select('conversation_id,body,direction,status,created_at,sent_at,message_type')
      .in('conversation_id', conversationIds)
      .not('message_type', 'like', 'status:%')
      .order('created_at', { ascending: false })
      .limit(1000),
  ]);

  const contactMap = new Map((contacts || []).map((contact: any) => [contact.id, contact]));
  const lastMessageMap = new Map<string, any>();
  const lastInboundMap = new Map<string, string>();
  for (const message of messages || []) {
    if (message.message_type?.startsWith('status:')) continue;
    if (!lastMessageMap.has(message.conversation_id)) lastMessageMap.set(message.conversation_id, message);
    if (message.direction === 'inbound' && !lastInboundMap.has(message.conversation_id)) {
      lastInboundMap.set(message.conversation_id, message.sent_at || message.created_at);
    }
  }

  const data = rows.map((row: any) => {
    const contact = contactMap.get(row.customer_id || row.contact_id);
    const last = lastMessageMap.get(row.id);
    const lastInboundAt = lastInboundMap.get(row.id) || null;
    const serviceWindowExpiresAt = lastInboundAt
      ? new Date(new Date(lastInboundAt).getTime() + 24 * 60 * 60 * 1000).toISOString()
      : null;
    const labels = Array.isArray(row.labels) ? row.labels.map(String) : [];
    const personal = Boolean(contact?.metadata?.personal || row.metadata?.personal || labels.includes('personal'));
    const instagramUsername = row.channel === 'instagram'
      ? (contact?.metadata?.instagram_username || row.metadata?.external_username || null)
      : null;
    const instagramName = row.channel === 'instagram'
      ? (contact?.metadata?.instagram_name || contact?.display_name || null)
      : null;
    const channelName = row.channel === 'instagram' && instagramUsername
      ? `@${instagramUsername}`
      : (instagramName || contact?.nombre || contact?.display_name || row.metadata?.external_username || (row.channel === 'instagram' ? `Instagram ${row.external_conversation_id}` : row.external_conversation_id));

    return {
      id: row.id,
      channel: row.channel,
      name: channelName,
      customerName: contact?.nombre || null,
      instagramUsername,
      instagramName,
      labels,
      phone: row.channel === 'whatsapp' ? (contact?.phone || contact?.external_id || row.external_conversation_id) : null,
      email: contact?.email || null,
      externalId: contact?.external_id || row.external_conversation_id,
      customerId: row.customer_id || row.contact_id || null,
      crmStatus: contact?.crm_status || 'new',
      externalThreadId: row.external_conversation_id,
      status: row.status || row.automation_status || 'open',
      humanTakeover: Boolean(row.human_takeover),
      unreadCount: Number(row.unread_count || 0),
      provider: row.provider || null,
      transport: row.transport || null,
      lastMessage: last?.body || (last?.message_type ? `[${last.message_type}]` : null),
      lastDirection: last?.direction || null,
      lastMessageStatus: last?.status || null,
      lastMessageAt: last?.sent_at || last?.created_at || row.last_message_at || null,
      lastInboundAt,
      serviceWindowExpiresAt,
      personal,
      aiEnabled: Boolean(row.ai_enabled) && !personal,
    };
  });

  return NextResponse.json({ data });
}
