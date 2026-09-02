import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AdminOrder } from '@/lib/repositories/orders-repository';
import { sendMessage } from '@/lib/messaging/send';
import { persistMessage } from '@/lib/messaging/messages';
import { enviarEmail } from '@/lib/email/resend';
import { runtimeSiteUrl } from '@/lib/site-url';

const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

type OrderNotificationEvent = 'payment_paid' | 'shipped';
export type OrderNotificationResult = {
  event: OrderNotificationEvent;
  channel: 'whatsapp' | 'email' | 'none';
  sent: boolean;
  reason?: string;
};

function clp(value: number) {
  return `$${Number(value || 0).toLocaleString('es-CL')}`;
}

function firstName(order: AdminOrder) {
  return String(order.customer_name || '').trim().split(/\s+/)[0] || '';
}

function notificationText(order: AdminOrder, event: OrderNotificationEvent) {
  const name = firstName(order);
  const hello = name ? `Hola ${name}. ` : '';
  if (event === 'payment_paid') {
    return `${hello}¡Pago confirmado! ✅ Recibimos el pago de tu pedido #${order.numeric_id} por ${clp(order.total)}. Quedó registrado correctamente y te avisaremos cuando vaya en camino.`;
  }
  const tracking = order.tracking_number ? ` Seguimiento: ${order.tracking_number}.` : '';
  return `${hello}¡Tu pedido #${order.numeric_id} va en camino! 🚚${tracking} Puedes revisar su estado en ${runtimeSiteUrl()}/pedido/${order.numeric_id}`;
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function notificationEmail(order: AdminOrder, event: OrderNotificationEvent) {
  const name = escapeHtml(firstName(order));
  const orderId = escapeHtml(order.numeric_id);
  const tracking = order.tracking_number
    ? `<p style="font-size:14px;color:#444;margin:12px 0 0;"><strong>Seguimiento:</strong> ${escapeHtml(order.tracking_number)}</p>`
    : '';
  const content = event === 'payment_paid'
    ? `<h1 style="font-size:22px;margin:0 0 10px;">¡Pago confirmado! ✅</h1>
       <p style="font-size:15px;color:#444;line-height:1.55;">${name ? `Hola ${name}. ` : ''}Recibimos el pago de tu pedido <strong>#${orderId}</strong> por <strong>${escapeHtml(clp(order.total))}</strong>. Te avisaremos cuando vaya en camino.</p>`
    : `<h1 style="font-size:22px;margin:0 0 10px;">Tu pedido va en camino 🚚</h1>
       <p style="font-size:15px;color:#444;line-height:1.55;">${name ? `Hola ${name}. ` : ''}Tu pedido <strong>#${orderId}</strong> ya salió a despacho.</p>
       ${tracking}
       <p style="margin:18px 0 0;"><a href="${runtimeSiteUrl()}/pedido/${orderId}" style="display:inline-block;background:#059669;color:white;text-decoration:none;padding:11px 18px;border-radius:999px;font-size:14px;font-weight:600;">Ver estado del pedido</a></p>`;

  return `<div style="background:#f5f7f5;padding:24px 0;"><div style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff;border-radius:16px;border:1px solid #e5e5e5;"><p style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#059669;font-weight:700;margin:0 0 16px;">La Manito Del Vegano</p>${content}<p style="margin-top:32px;padding-top:16px;border-top:1px solid #eee;font-size:12px;color:#888;">100% plant-based · Santiago y Pucón</p></div></div>`;
}

export function orderNotificationEvents(before: AdminOrder, after: AdminOrder): OrderNotificationEvent[] {
  const events: OrderNotificationEvent[] = [];
  if (before.payment_status !== 'paid' && after.payment_status === 'paid') events.push('payment_paid');
  if (before.status !== 'shipped' && after.status === 'shipped') events.push('shipped');
  return events;
}

async function latestWhatsappConversation(db: SupabaseClient, order: AdminOrder) {
  if (!order.customer_id) return null;
  const { data, error } = await db.from('conversations')
    .select('id,external_conversation_id,last_message_at')
    .eq('customer_id', order.customer_id)
    .eq('channel', 'whatsapp')
    .order('last_message_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function whatsappWindowOpen(db: SupabaseClient, conversationId: string) {
  const { data, error } = await db.from('omnichannel_messages')
    .select('sent_at,created_at')
    .eq('conversation_id', conversationId)
    .eq('direction', 'inbound')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const inboundAt = data?.sent_at || data?.created_at || null;
  if (!inboundAt) return false;
  const elapsed = Date.now() - new Date(inboundAt).getTime();
  return Number.isFinite(elapsed) && elapsed >= 0 && elapsed < SERVICE_WINDOW_MS;
}

async function sendOne(db: SupabaseClient, order: AdminOrder, event: OrderNotificationEvent): Promise<OrderNotificationResult> {
  const text = notificationText(order, event);

  try {
    const conversation = await latestWhatsappConversation(db, order);
    if (conversation?.id && await whatsappWindowOpen(db, String(conversation.id))) {
      const to = String(conversation.external_conversation_id || order.customer_phone || '').trim();
      if (to) {
        try {
          const result = await sendMessage({
            channel: 'whatsapp',
            conversationId: String(conversation.id),
            customerId: order.customer_id || undefined,
            to,
            text,
            mode: 'automatic',
            automationAuthorized: true,
            agent: 'remy',
          });
          await persistMessage(db, {
            channel: 'whatsapp',
            provider: 'meta',
            transport: 'cloud_api',
            provider_message_id: result.providerMessageId,
            external_thread_id: to,
            external_user_id: to,
            direction: 'outbound',
            sender_type: 'remy',
            text,
            message_type: 'text',
            sent_at: new Date().toISOString(),
            raw_payload: {
              source: 'order_status_notification',
              deterministic: true,
              event,
              order_id: order.numeric_id,
              provider_response: result.raw,
            },
          });
          return { event, channel: 'whatsapp', sent: true };
        } catch (error) {
          console.error('order_notification_whatsapp_failed', {
            orderId: order.numeric_id,
            event,
            reason: error instanceof Error ? error.message : 'unknown',
          });
        }
      }
    }
  } catch (error) {
    console.error('order_notification_window_check_failed', {
      orderId: order.numeric_id,
      event,
      reason: error instanceof Error ? error.message : 'unknown',
    });
  }

  const email = String(order.customer_email || '').trim();
  if (email) {
    const result = await enviarEmail({
      to: email,
      subject: event === 'payment_paid'
        ? `Pago confirmado · Pedido #${order.numeric_id}`
        : `Tu pedido #${order.numeric_id} va en camino 🚚`,
      html: notificationEmail(order, event),
    });
    if (result.ok) return { event, channel: 'email', sent: true };
    return { event, channel: 'email', sent: false, reason: result.error };
  }

  return { event, channel: 'none', sent: false, reason: 'no_available_channel' };
}

export async function notifyOrderTransitions(
  db: SupabaseClient,
  before: AdminOrder,
  after: AdminOrder,
): Promise<OrderNotificationResult[]> {
  const events = orderNotificationEvents(before, after);
  const results: OrderNotificationResult[] = [];
  for (const event of events) results.push(await sendOne(db, after, event));
  return results;
}
