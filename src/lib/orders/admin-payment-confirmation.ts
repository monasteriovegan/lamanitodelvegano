import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { OrderRepository } from '@/lib/repositories/orders-repository';

function normalizeConfirmationText(text: string) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-CL')
    .replace(/[.!¡!¿?]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isExplicitAdminPaymentConfirmation(text: string) {
  const normalized = normalizeConfirmationText(text);
  return new Set([
    'pago confirmado',
    'deposito confirmado',
    'transferencia confirmada',
    'pago recibido',
    'deposito recibido',
  ]).has(normalized);
}

export async function applyAdminPaymentConfirmation(
  db: SupabaseClient,
  input: {
    conversationId: string;
    orderId: number | null;
    text: string;
    changedBy?: string | null;
  },
): Promise<{ confirmed: boolean; orderId?: number; reason?: string }> {
  if (!isExplicitAdminPaymentConfirmation(input.text)) return { confirmed: false, reason: 'no_confirmation_phrase' };
  if (!input.orderId) return { confirmed: false, reason: 'conversation_without_order' };

  const repository = new OrderRepository(db);
  const current = await repository.getById(input.orderId);
  if (!current) return { confirmed: false, reason: 'order_not_found' };
  if (current.payment_status === 'paid') return { confirmed: true, orderId: input.orderId, reason: 'already_paid' };
  if (current.payment_status === 'refunded') return { confirmed: false, orderId: input.orderId, reason: 'refunded_order' };

  await repository.update(input.orderId, {
    status: 'confirmed',
    payment_status: 'paid',
  }, input.changedBy || null);

  const { data: conversation } = await db
    .from('conversations')
    .select('labels')
    .eq('id', input.conversationId)
    .maybeSingle();
  const labels = Array.from(new Set([
    ...(Array.isArray(conversation?.labels) ? conversation.labels.map(String).filter((label: string) => label !== 'pago_por_verificar') : []),
    'pedido',
    'pagado',
  ]));
  await db.from('conversations').update({ labels, updated_at: new Date().toISOString() }).eq('id', input.conversationId);
  await db.from('omnichannel_messages').update({ order_id: input.orderId }).eq('conversation_id', input.conversationId).is('order_id', null);

  return { confirmed: true, orderId: input.orderId };
}
