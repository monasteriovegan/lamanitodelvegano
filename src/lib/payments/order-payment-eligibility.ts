import type { SupabaseClient } from '@supabase/supabase-js';

export type PaymentEligibilityOrder = {
  id: number;
  business_unit_id?: string | null;
  fecha_entrega?: string | null;
  estado?: string | null;
};

export type PaymentEligibility =
  | { eligible: true; reason: null }
  | { eligible: false; reason: 'order_cancelled' | 'delivery_date_blocked' };

export function isCancelledOrderState(value: unknown) {
  const state = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('es-CL');
  return state === 'cancelado' || state === 'cancelada' || state === 'cancelled' || state === 'canceled';
}

export async function getOrderPaymentEligibility(
  db: SupabaseClient,
  order: PaymentEligibilityOrder,
): Promise<PaymentEligibility> {
  if (isCancelledOrderState(order.estado)) {
    return { eligible: false, reason: 'order_cancelled' };
  }

  const businessUnitId = String(order.business_unit_id || '').trim();
  const deliveryDate = String(order.fecha_entrega || '').trim();
  if (!businessUnitId || !/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate)) {
    return { eligible: true, reason: null };
  }

  const { data, error } = await db
    .from('blocked_delivery_dates')
    .select('id')
    .eq('business_unit_id', businessUnitId)
    .eq('date', deliveryDate)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (data) return { eligible: false, reason: 'delivery_date_blocked' };
  return { eligible: true, reason: null };
}
