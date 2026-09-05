import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { sendMessage } from '@/lib/messaging/send';
import { persistMessage } from '@/lib/messaging/messages';
import { evaluateConversationOpportunity } from '@/lib/opportunities/service';
import { enviarEmail } from '@/lib/email/resend';
import { plantillaCarritoAbandonado } from '@/lib/email/templates';
import type { ItemCarrito } from '@/types/domain';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const HORAS_INACTIVIDAD = 2;
const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

function recoveryText(nombre: string, items: ItemCarrito[], subtotal: number) {
  const firstName = nombre ? ` ${nombre.split(' ')[0]}` : '';
  const itemNames = items.slice(0, 2).map((item) => `${item.qty}× ${item.nombre}`).join(', ');
  const more = items.length > 2 ? ` +${items.length - 2} más` : '';
  return `Hola${firstName} 🌱 Dejaste ${itemNames || 'productos'}${more} en tu carrito ($${subtotal.toLocaleString('es-CL')}). Si quieres, te ayudo a terminar el pedido por aquí.`;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const db = createSupabaseServiceClient();
  const limite = new Date(Date.now() - HORAS_INACTIVIDAD * 60 * 60 * 1000).toISOString();
  const { data: globalConfig } = await db.from('integraciones_secretas').select('ai_enabled').eq('id', 'global').maybeSingle();
  const cutoverToOpportunityEngine = String(process.env.SALES_OPPORTUNITY_CART_CUTOVER || '').toLowerCase() === 'true';

  const { data: carritos, error } = await db
    .from('carritos_abandonados')
    .select('id,business_unit_id,conversation_id,customer_id,source_channel,nombre,email,telefono,items,subtotal,contactado,recuperado,last_activity_at')
    .eq('contactado', false)
    .eq('recuperado', false)
    .lte('last_activity_at', limite)
    .limit(50);

  if (error) {
    console.error('Error buscando carritos abandonados:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let enviados = 0;
  let fallidos = 0;
  let omitidos = 0;

  for (const carrito of carritos || []) {
    const items = Array.isArray(carrito.items) ? carrito.items as ItemCarrito[] : [];
    const nombre = String(carrito.nombre || '');
    const subtotal = Number(carrito.subtotal || 0);
    let sent = false;

    if (carrito.conversation_id) {
      try {
        await evaluateConversationOpportunity(db, carrito.conversation_id);
      } catch (opportunityError) {
        console.error('cart_opportunity_evaluation_failed', {
          cartId: carrito.id,
          reason: opportunityError instanceof Error ? opportunityError.message : 'unknown',
        });
      }
    }

    // During observation the legacy sender stays active. Once the explicit
    // cutover switch is enabled, this cron stops sending so only the new runner
    // owns the cart-abandoned stage.
    if (cutoverToOpportunityEngine) {
      omitidos += 1;
      continue;
    }

    if (globalConfig?.ai_enabled && carrito.telefono && carrito.conversation_id && carrito.source_channel === 'whatsapp') {
      const { data: conversation } = await db.from('conversations')
        .select('id,ai_enabled,human_takeover,labels,metadata,external_conversation_id')
        .eq('id', carrito.conversation_id)
        .maybeSingle();
      const personal = Boolean(conversation?.metadata?.personal || conversation?.labels?.includes?.('personal'));

      if (conversation?.ai_enabled && !conversation.human_takeover && !personal) {
        const { data: lastInbound } = await db.from('omnichannel_messages')
          .select('sent_at,created_at')
          .eq('conversation_id', carrito.conversation_id)
          .eq('direction', 'inbound')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        const inboundAt = lastInbound?.sent_at || lastInbound?.created_at || null;
        const windowOpen = Boolean(inboundAt && Date.now() - new Date(inboundAt).getTime() < SERVICE_WINDOW_MS);

        if (windowOpen) {
          try {
            const text = recoveryText(nombre, items, subtotal);
            const result = await sendMessage({
              channel: 'whatsapp',
              conversationId: carrito.conversation_id,
              customerId: carrito.customer_id || undefined,
              to: String(conversation.external_conversation_id || carrito.telefono),
              text,
              mode: 'automatic',
              automationAuthorized: true,
              agent: 'remy',
            });
            await persistMessage(db, {
              channel: 'whatsapp', provider: 'meta', transport: 'cloud_api', provider_message_id: result.providerMessageId,
              external_thread_id: String(conversation.external_conversation_id || carrito.telefono),
              external_user_id: String(conversation.external_conversation_id || carrito.telefono),
              direction: 'outbound', sender_type: 'remy', text, message_type: 'text', sent_at: new Date().toISOString(),
              raw_payload: { source: 'remy_cart_recovery', deterministic: true, provider_response: result.raw },
            });
            sent = true;
          } catch (sendError) {
            console.error('remy_cart_recovery_whatsapp_failed', {
              cartId: carrito.id,
              reason: sendError instanceof Error ? sendError.message : 'unknown',
            });
          }
        }
      }
    }

    if (!sent && carrito.email) {
      const result = await enviarEmail({
        to: carrito.email,
        subject: 'Dejaste algo en tu carrito 🌿',
        html: plantillaCarritoAbandonado(nombre, items, subtotal),
      });
      sent = result.ok;
    }

    if (sent) {
      enviados += 1;
      await db.from('carritos_abandonados').update({ contactado: true }).eq('id', carrito.id);
    } else {
      const hasRecoveryChannel = Boolean(carrito.email || (carrito.telefono && carrito.conversation_id));
      hasRecoveryChannel ? (fallidos += 1) : (omitidos += 1);
    }
  }

  return NextResponse.json({
    ok: true,
    revisados: carritos?.length || 0,
    enviados,
    fallidos,
    omitidos,
    opportunity_cart_cutover: cutoverToOpportunityEngine,
  });
}
