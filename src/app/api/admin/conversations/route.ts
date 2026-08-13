import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { getCurrentAdminUser } from '@/lib/supabase/server-auth';

export async function GET() {
  const admin = await getCurrentAdminUser();
  if (!admin || !['admin', 'soporte', 'owner', 'supervisor', 'human_agent'].includes(admin.rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const db = createSupabaseServiceClient();
  const { data: conversations, error } = await db
    .from('conversations')
    .select('id,customer_id,contact_id,external_conversation_id,last_message_at,status,automation_status,human_takeover,unread_count,provider,transport,metadata')
    .eq('channel', 'whatsapp')
    .order('last_message_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const rows = conversations || [];
  if (rows.length === 0) return NextResponse.json({ data: [] });

  const contactIds = Array.from(new Set(rows.map((row: any) => row.customer_id || row.contact_id).filter(Boolean)));
  const conversationIds = rows.map((row: any) => row.id);

  const [{ data: contacts }, { data: messages }] = await Promise.all([
    contactIds.length
      ? db.from('omnichannel_contacts').select('id,display_name,nombre,phone,external_id,crm_status').in('id', contactIds)
      : Promise.resolve({ data: [] as any[] }),
    db
      .from('omnichannel_messages')
      .select('conversation_id,body,direction,status,created_at')
      .in('conversation_id', conversationIds)
      .order('created_at', { ascending: false })
      .limit(300),
  ]);

  const contactMap = new Map((contacts || []).map((contact: any) => [contact.id, contact]));
  const lastMessageMap = new Map<string, any>();
  for (const message of messages || []) {
    if (!lastMessageMap.has(message.conversation_id)) lastMessageMap.set(message.conversation_id, message);
  }

  const data = rows.map((row: any) => {
    const contact = contactMap.get(row.customer_id || row.contact_id);
    const last = lastMessageMap.get(row.id);
    return {
      id: row.id,
      name: contact?.nombre || contact?.display_name || row.metadata?.external_username || row.external_conversation_id,
      phone: contact?.phone || contact?.external_id || row.external_conversation_id,
      customerId: row.customer_id || row.contact_id || null,
      crmStatus: contact?.crm_status || 'new',
      externalThreadId: row.external_conversation_id,
      status: row.status || row.automation_status || 'open',
      humanTakeover: Boolean(row.human_takeover),
      unreadCount: Number(row.unread_count || 0),
      provider: row.provider || null,
      transport: row.transport || null,
      lastMessage: last?.body || null,
      lastDirection: last?.direction || null,
      lastMessageStatus: last?.status || null,
      lastMessageAt: last?.created_at || row.last_message_at || null,
    };
  });

  return NextResponse.json({ data });
}
