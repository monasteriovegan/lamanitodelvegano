import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { getCurrentAdminUser } from '@/lib/supabase/server-auth';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const admin = await getCurrentAdminUser();
  if (!admin || !['admin', 'soporte', 'owner', 'supervisor', 'human_agent'].includes(admin.rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await context.params;
  const db = createSupabaseServiceClient();
  const { data: conversation, error: conversationError } = await db
    .from('conversations')
    .select('id,channel')
    .eq('id', id)
    .in('channel', ['whatsapp', 'instagram', 'web'])
    .maybeSingle();

  if (conversationError) return NextResponse.json({ error: conversationError.message }, { status: 400 });
  if (!conversation) return NextResponse.json({ error: 'conversation_not_found' }, { status: 404 });

  const { data, error } = await db
    .from('omnichannel_messages')
    .select('id,direction,message_type,body,status,provider,transport,external_message_id,provider_message_id,sent_at,delivered_at,read_at,created_at,payload')
    .eq('conversation_id', id)
    .not('message_type', 'like', 'status:%')
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await db
    .from('conversations')
    .update({ unread_count: 0, updated_at: new Date().toISOString() })
    .eq('id', id);

  const mapped = (data || [])
    .filter((message: any) => !message.message_type?.startsWith('status:'))
    .map((message: any) => ({
      ...message,
      provider: message.provider || message.payload?.provider || null,
      transport: message.transport || message.payload?.transport || null,
      source: message.payload?.source || message.payload?.raw?.source || null,
      timestamp: message.sent_at || message.created_at,
    }))
    .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return NextResponse.json({
    channel: conversation.channel,
    data: mapped,
  });
}
