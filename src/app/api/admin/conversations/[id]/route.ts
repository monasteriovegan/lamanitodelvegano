import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { getCurrentAdminUser } from '@/lib/supabase/server-auth';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const admin = await getCurrentAdminUser();
  if (!admin || !['admin', 'owner', 'supervisor', 'soporte'].includes(admin.rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: 'invalid_origin' }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as { personal?: boolean } | null;
  if (typeof body?.personal !== 'boolean') {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }

  const { id } = await context.params;
  const db = createSupabaseServiceClient();
  const { data: conversation, error } = await db
    .from('conversations')
    .select('id,customer_id,contact_id,metadata,labels')
    .eq('id', id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!conversation) return NextResponse.json({ error: 'conversation_not_found' }, { status: 404 });

  const labels = new Set<string>(Array.isArray(conversation.labels) ? conversation.labels : []);
  body.personal ? labels.add('personal') : labels.delete('personal');
  const conversationMetadata = {
    ...(conversation.metadata && typeof conversation.metadata === 'object' ? conversation.metadata : {}),
    personal: body.personal,
  };

  const { error: conversationUpdateError } = await db
    .from('conversations')
    .update({
      labels: Array.from(labels),
      metadata: conversationMetadata,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (conversationUpdateError) {
    return NextResponse.json({ error: conversationUpdateError.message }, { status: 400 });
  }

  const customerId = conversation.customer_id || conversation.contact_id;
  if (customerId) {
    const { data: contact } = await db
      .from('omnichannel_contacts')
      .select('metadata')
      .eq('id', customerId)
      .maybeSingle();
    const metadata = {
      ...(contact?.metadata && typeof contact.metadata === 'object' ? contact.metadata : {}),
      personal: body.personal,
    };
    await db.from('omnichannel_contacts').update({ metadata, updated_at: new Date().toISOString() }).eq('id', customerId);
  }

  return NextResponse.json({ ok: true, personal: body.personal, ai_called: false });
}
