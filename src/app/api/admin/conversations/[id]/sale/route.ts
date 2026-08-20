import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { getCurrentAdminUser } from '@/lib/supabase/server-auth';
import {
  confirmConversationSale,
  prepareConversationSaleDraft,
  type ConversationSaleDraft,
} from '@/lib/orders/conversation-sale';

const ALLOWED_ROLES = new Set(['admin', 'owner', 'supervisor']);

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const admin = await getCurrentAdminUser();
  if (!admin || !ALLOWED_ROLES.has(admin.rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const action = String(body?.action || 'prepare');
  const db = createSupabaseServiceClient();

  try {
    if (action === 'prepare') {
      const draft = await prepareConversationSaleDraft(db, id);
      return NextResponse.json({ ok: true, draft });
    }

    if (action === 'confirm') {
      const draft = body?.draft as ConversationSaleDraft | undefined;
      if (!draft || draft.conversationId !== id) {
        return NextResponse.json({ error: 'sale_draft_invalid' }, { status: 400 });
      }
      const result = await confirmConversationSale(db, draft, admin.id);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'invalid_action' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'conversation_sale_failed';
    const status = message.startsWith('conversation_already_has_order:') ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
