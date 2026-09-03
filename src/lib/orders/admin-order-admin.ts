import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { OrderRepository, type AdminOrder } from '@/lib/repositories/orders-repository';

type JsonRecord = Record<string, unknown>;

export type ManualOrderInput = {
  idempotencyKey: string;
  businessUnitId: string;
  customerId: string | null;
  customerEmail: string | null;
  customerName: string;
  customerPhone: string | null;
  address: string | null;
  comuna: string | null;
  items: JsonRecord[];
  stockItems: JsonRecord[];
  total: number;
  paymentMethod: string;
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded' | 'partial';
  shippingCost: number;
  shippingZoneId: string | null;
  shippingZoneName: string | null;
  deliveryDate: string | null;
  sourceChannel: 'web' | 'whatsapp' | 'instagram' | 'messenger' | 'manual' | 'admin';
  adminNotes: string | null;
  attribution?: JsonRecord;
};

export async function createManualOrder(
  db: SupabaseClient,
  input: ManualOrderInput,
): Promise<AdminOrder> {
  const { data, error } = await db.rpc('admin_create_order_v1', {
    p_idempotency_key: input.idempotencyKey,
    p_business_unit_id: input.businessUnitId,
    p_customer_id: input.customerId,
    p_customer_email: input.customerEmail,
    p_customer_name: input.customerName,
    p_customer_phone: input.customerPhone,
    p_address: input.address,
    p_comuna: input.comuna,
    p_order_items: input.items,
    p_stock_items: input.stockItems,
    p_total: input.total,
    p_payment_method: input.paymentMethod,
    p_payment_status: input.paymentStatus,
    p_shipping_cost: input.shippingCost,
    p_shipping_zone_id: input.shippingZoneId,
    p_shipping_zone_name: input.shippingZoneName,
    p_delivery_date: input.deliveryDate,
    p_source_channel: input.sourceChannel,
    p_admin_notes: input.adminNotes,
    p_attribution: input.attribution || {},
  });
  if (error) throw error;
  const pedidoId = Number((data as Record<string, unknown> | null)?.pedido_id);
  if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
    throw new Error('admin_create_order_v1 no devolvió pedido_id integer.');
  }
  const order = await new OrderRepository(db).getById(pedidoId);
  if (!order) throw new Error('El pedido manual fue creado pero no pudo recuperarse.');
  return order;
}