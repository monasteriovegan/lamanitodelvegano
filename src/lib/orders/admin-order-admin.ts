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

export type FullOrderUpdateInput = {
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  address?: string | null;
  comuna?: string | null;
  deliveryDate?: string | null;
  paymentMethod?: string | null;
  paymentStatus?: 'pending' | 'paid' | 'failed' | 'refunded' | 'partial';
  shippingCost?: number;
  shippingZoneId?: string | null;
  shippingZoneName?: string | null;
  sourceChannel?: 'web' | 'whatsapp' | 'instagram' | 'messenger' | 'manual' | 'admin';
  estado?: 'Pendiente' | 'Pagado' | 'Despachado' | 'Completado' | 'Cancelado';
  adminNotes?: string | null;
  notes?: string | null;
  items: JsonRecord[];
  stockItems: JsonRecord[];
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

export async function updateFullOrder(
  db: SupabaseClient,
  orderId: string | number,
  input: FullOrderUpdateInput,
  actor: string | null,
): Promise<AdminOrder> {
  const pedidoId = Number(orderId);
  if (!Number.isInteger(pedidoId) || pedidoId <= 0) throw new Error('Pedido inválido.');
  const patch: JsonRecord = {};
  if (input.customerName !== undefined) patch.customer_name = input.customerName;
  if (input.customerPhone !== undefined) patch.customer_phone = input.customerPhone;
  if (input.customerEmail !== undefined) patch.customer_email = input.customerEmail;
  if (input.address !== undefined) patch.address = input.address;
  if (input.comuna !== undefined) patch.comuna = input.comuna;
  if (input.deliveryDate !== undefined) patch.delivery_date = input.deliveryDate;
  if (input.paymentMethod !== undefined) patch.payment_method = input.paymentMethod;
  if (input.paymentStatus !== undefined) patch.payment_status = input.paymentStatus;
  if (input.shippingCost !== undefined) patch.shipping_cost = input.shippingCost;
  if (input.shippingZoneId !== undefined) patch.shipping_zone_id = input.shippingZoneId;
  if (input.shippingZoneName !== undefined) patch.shipping_zone_name = input.shippingZoneName;
  if (input.sourceChannel !== undefined) patch.source_channel = input.sourceChannel;
  if (input.estado !== undefined) patch.estado = input.estado;
  if (input.adminNotes !== undefined) patch.admin_notes = input.adminNotes;
  if (input.notes !== undefined) patch.notes = input.notes;

  const { data, error } = await db.rpc('admin_update_order_v1', {
    p_pedido_id: pedidoId,
    p_actor: actor,
    p_patch: patch,
    p_order_items: input.items,
    p_stock_items: input.stockItems,
  });
  if (error) throw error;
  const updatedId = Number((data as Record<string, unknown> | null)?.pedido_id || pedidoId);
  const order = await new OrderRepository(db).getById(updatedId);
  if (!order) throw new Error('El pedido fue actualizado pero no pudo recuperarse.');
  return order;
}