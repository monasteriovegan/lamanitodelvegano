import { NextResponse, type NextRequest } from 'next/server';
import { BusinessRepository } from '@/lib/repositories/business-repository';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import {
  buildWhatsAppHandoffUrl,
  createHandoffReference,
  extractHandoffReference,
} from '@/lib/ai/remy-handoff-token';

export const dynamic = 'force-dynamic';

const WHATSAPP_PHONE = '56990816124';

function validSessionId(value: unknown) {
  const session = String(value || '').trim();
  return /^[a-zA-Z0-9_-]{8,100}$/.test(session) ? session : null;
}

export async function GET(request: NextRequest) {
  const fallback = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent('Hola, quiero continuar una compra de la web.')}`;
  try {
    const sessionId = validSessionId(request.nextUrl.searchParams.get('sessionId'));
    if (!sessionId) return NextResponse.redirect(fallback);

    const db = createSupabaseServiceClient();
    const business = await new BusinessRepository(db).requireDefault();
    const { data: conversation, error: conversationError } = await db.from('conversations')
      .select('id')
      .eq('business_unit_id', business.id)
      .eq('channel', 'web')
      .eq('external_conversation_id', sessionId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (conversationError) throw conversationError;
    if (!conversation?.id) return NextResponse.redirect(fallback);

    const { data: cart, error: cartError } = await db.from('carritos_abandonados')
      .select('id,metadata')
      .eq('business_unit_id', business.id)
      .eq('conversation_id', conversation.id)
      .eq('recuperado', false)
      .order('last_activity_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (cartError) throw cartError;
    if (!cart?.id) return NextResponse.redirect(fallback);

    const metadata = cart.metadata && typeof cart.metadata === 'object'
      ? cart.metadata as Record<string, any>
      : {};
    const existing = String(metadata?.whatsapp_handoff?.reference || '').trim();
    const reference = extractHandoffReference(existing) === existing
      ? existing
      : createHandoffReference();

    if (reference !== existing) {
      const { error: updateError } = await db.from('carritos_abandonados').update({
        metadata: {
          ...metadata,
          whatsapp_handoff: {
            reference,
            created_at: new Date().toISOString(),
            claimed_at: null,
            claimed_conversation_id: null,
          },
        },
        last_activity_at: new Date().toISOString(),
      }).eq('id', cart.id);
      if (updateError) throw updateError;
    }

    return NextResponse.redirect(buildWhatsAppHandoffUrl(WHATSAPP_PHONE, reference));
  } catch (error) {
    console.error('remy_web_whatsapp_handoff_failed', {
      detail: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.redirect(fallback);
  }
}
