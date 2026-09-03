import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { OperationalStatus, Order, OrderItem, PaymentStatus } from '@/types/domain';
import { normalizePhone } from '@/lib/messaging/normalize';
import {
  getSchemaCapabilities,
  requireSchemaCapability,
  type SchemaCapabilities,
} from './schema-capabilities';

type JsonRecord = Record<string, any>;

const TO_OPERATIONAL: Record<string, OperationalStatus> = {
  pendiente: 'pending',
  pending: 'pending',
  confirmado: 'confirmed',
  confirmed: 'confirmed',
  pagado: 'confirmed',
  processing: 'processing',
  procesando: 'processing',
  despachado: 'shipped',
  shipped: 'shipped',
  enviado: 'shipped',
  completado: 'delivered',
  delivered: 'delivered',
  entregado: 'delivered',
  cancelado: 'cancelled',
  cancelled: 'cancelled',
  whatsapp: 'pending',
};

const TO_LEGACY: Record<OperationalStatus, string> = {
  pending: 'Pendiente',
  confirmed: 'Pagado',
  processing: 'Pagado',
  shipped: 'Despachado',
  delivered: 'Completado',
  cancelled: 'Cancelado',
};

export type AdminOrder = Order & {
  numeric_id: number;
  legacy_status: string;
  cliente: JsonRecord;
  items: JsonRecord[];
  metodoPago: string | null;
  createdAt: string;
};

export type OrderListFilters = {
  status?: string;
  customerId?: string;
  createdAfter?: string;
  limit?: number;
};

export type CheckoutOrderInput = {
  idempotencyKey: string;
  businessUnitId: string;
  customerId: string | null;
  customerEmail: string | null;
  customerName: string;
  customerPhone: string;
  address: string | null;
  comuna: string | null;
  items: JsonRecord[];
  total: number;
  paymentMethod: string;
  shippingCost: number;
  shippingZoneId: string | null;
  shippingZoneName: string | null;
  loyaltyDiscount: number;
  loyaltyPointsRedeemed: number;
  discountTotal: number;
  stockItems: JsonRecord[];
  attribution: JsonRecord;
  notes?: string | null;
};

export type ConversationOrderInput = {
  idempotencyKey: string;
  businessUnitId: string;
  customerId: string;
  conversationId: string;
  customerEmail: string | null;
  customerName: string;
  customerPhone: string | null;
  address: string | null;
  comuna: string | null;
  items: JsonRecord[];
  stockItems: JsonRecord[];
  total: number;
  paymentMethod: string;
  paymentConfirmed: boolean;
  shippingCost: number;
  shippingZoneId: string | null;
  shippingZoneName: string | null;
  deliveryDate: string | null;
  sourceChannel: string;
  adminNotes: string | null;
  attribution: JsonRecord;
};

export function normalizeOrderStatus(value: unknown): OperationalStatus {
  return TO_OPERATIONAL[String(value || 'pending').trim().toLowerCase()] || 'pending';
}

export function toLegacyOrderStatus(value: OperationalStatus): string {
  return TO_LEGACY[value];
}

export function mapPedidoToAdminOrder(row: JsonRecord): AdminOrder {
  const numericId = Number(row.id);
  if (!Number.isInteger(numericId)) throw new Error(`pedidos.id inválido: ${String(row.id)}`);

  const legacyStatus = String(row.estado ?? row.status ?? 'Pendiente');
  const status = normalizeOrderStatus(legacyStatus);
  const rawItems = Array.isArray(row.items) ? row.items : [];
  const cliente = row.cliente && typeof row.cliente === 'object'
    ? row.cliente
    : {
        nombre: row.nombre_cliente ?? null,
        email: row.customer_email ?? null,
        telefono: row.telefono ?? null,
        direccion: row.direccion ?? null,
        comuna: row.comuna ?? null,
      };
  const createdAt = String(row.created_at ?? row.createdAt ?? new Date(0).toISOString());
  const shippingAmount = Number(row.costo_envio ?? row.costoEnvio ?? 0);
  const total = Number(row.total ?? 0);
  const paymentMethod = row.metodopago ?? row.metodoPago ?? null;
  const orderItems: OrderItem[] = rawItems.map((item: JsonRecord, index: number) => {
    const quantity = Number(item.qty ?? item.quantity ?? 1);
    const unitPrice = Number(item.precio ?? item.unit_price ?? item.price ?? 0);
    return {
      id: String(item.id ?? `${numericId}-${index}`),
      order_id: String(numericId),
      product_id: item.productoId ?? item.product_id ?? null,
      product_name: String(item.nombre ?? item.product_name ?? item.name ?? 'Producto'),
      unit_price: unitPrice,
      quantity,
      subtotal: Number(item.subtotal ?? unitPrice * quantity),
    };
  });

  return {
    id: String(numericId),
    numeric_id: numericId,
    order_number: String(row.order_number ?? `MAN-${numericId}`),
    customer_id: row.customer_id ?? null,
    status,
    legacy_status: legacyStatus,
    payment_status: (row.payment_status ?? (status === 'confirmed' ? 'paid' : 'pending')) as PaymentStatus,
    source: row.source_channel ?? row.source ?? 'web',
    subtotal: Number(row.subtotal ?? Math.max(0, total - shippingAmount)),
    discount_amount: Number(row.discount_total ?? row.loyalty_discount ?? row.descuentoFidelidad ?? 0),
    shipping_amount: shippingAmount,
    tax_amount: Number(row.tax_amount ?? 0),
    total,
    payment_method: paymentMethod,
    tracking_number: row.tracking_number ?? null,
    shipping_address: cliente,
    shipping_zone_id: row.shipping_zone_id ?? null,
    shipping_zone_name: row.shipping_zone_name ?? row.zona_envio ?? row.zonaEnvio ?? null,
    delivery_date: row.fecha_entrega ?? row.fechaDespacho ?? null,
    customer_email: row.customer_email ?? cliente.email ?? null,
    customer_phone: row.telefono ?? cliente.telefono ?? null,
    customer_name: row.nombre_cliente ?? cliente.nombre ?? null,
    notes: row.notas ?? null,
    admin_notes: row.admin_notes ?? null,
    printed_at: row.printed_at ?? row.metadata?.printed_at ?? null,
    last_printed_at: row.last_printed_at ?? row.metadata?.last_printed_at ?? null,
    print_count: Number(row.print_count ?? row.metadata?.print_count ?? 0),
    printed_by: row.printed_by ?? row.metadata?.printed_by ?? null,
    created_at: createdAt,
    updated_at: String(row.updated_at ?? createdAt),
    order_items: orderItems,
    cliente,
    items: rawItems,
    metodoPago: paymentMethod,
    createdAt,
  };
}

function parsePedidoId(id: string | number): number {
  const parsed = typeof id === 'number' ? id : Number(id);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error('El ID de pedido debe ser integer.');
  return parsed;
}

export class OrderRepository {
  private readonly capabilities: SchemaCapabilities;

  constructor(
    private readonly db: SupabaseClient,
    capabilities: SchemaCapabilities = getSchemaCapabilities(),
  ) {
    this.capabilities = capabilities;
  }

  async list(filters: OrderListFilters = {}): Promise<AdminOrder[]> {
    const { data, error } = await this.db.from('pedidos').select('*');
    if (error) throw error;
    let orders = (data || []).map(mapPedidoToAdminOrder);
    if (filters.status && filters.status !== 'todos') {
      const status = normalizeOrderStatus(filters.status);
      orders = orders.filter((order) => order.status === status);
    }
    if (filters.customerId) orders = orders.filter((order) => order.customer_id === filters.customerId);
    if (filters.createdAfter) {
      const start = new Date(filters.createdAfter).getTime();
      orders = orders.filter((order) => new Date(order.created_at).getTime() >= start);
    }
    orders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return filters.limit ? orders.slice(0, filters.limit) : orders;
  }

  async getById(id: string | number): Promise<AdminOrder | null> {
    const { data, error } = await this.db
      .from('pedidos')
      .select('*')
      .eq('id', parsePedidoId(id))
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const order = mapPedidoToAdminOrder(data);
    if (this.capabilities.supportTables) {
      const { data: history, error: historyError } = await this.db
        .from('order_status_history')
        .select('*')
        .eq('pedido_id', order.numeric_id)
        .order('created_at', { ascending: false });
      if (historyError) throw historyError;
      order.history = (history || []).map((item: JsonRecord) => ({
        id: String(item.id),
        order_id: String(item.pedido_id),
        status: item.new_status,
        payment_status: item.payment_status ?? null,
        notes: item.notes ?? null,
        created_by: item.changed_by ?? undefined,
        created_at: String(item.created_at),
      }));
    }
    return order;
  }

  async update(
    id: string | number,
    input: {
      status?: string;
      payment_status?: string;
      tracking_number?: string;
      admin_notes?: string;
      notes?: string;
      customer_name?: string;
      customer_phone?: string;
      customer_email?: string;
      address?: string;
      comuna?: string;
      delivery_date?: string;
      print_action?: 'mark_printed' | 'reset_print';
      update_crm?: boolean;
    },
    changedBy?: string,
  ): Promise<AdminOrder> {
    const pedidoId = parsePedidoId(id);
    const before = await this.getById(pedidoId);
    if (!before) throw new Error('Pedido no encontrado.');
    if (
      input.payment_status !== undefined ||
      input.tracking_number !== undefined ||
      input.admin_notes !== undefined
    ) {
      requireSchemaCapability(this.capabilities, 'orderExtensions');
    }

    const update: JsonRecord = {
      updated_at: new Date().toISOString(),
    };

    if (input.status !== undefined) {
      update.estado = toLegacyOrderStatus(normalizeOrderStatus(input.status));
    }

    if (this.capabilities.orderExtensions) {
      if (input.payment_status !== undefined) update.payment_status = input.payment_status;
      if (input.tracking_number !== undefined) update.tracking_number = input.tracking_number || null;
      if (input.admin_notes !== undefined) update.admin_notes = input.admin_notes || null;
    }

    if (input.notes !== undefined) {
      update.notas = input.notes || null;
    }

    if (input.delivery_date !== undefined) {
      update.fecha_entrega = input.delivery_date || null;
    }

    // Actualización de cliente en JSON y campos planos
    const clienteData = {
      ...(before.cliente && typeof before.cliente === 'object' ? before.cliente : {}),
    };
    let clienteChanged = false;

    if (input.customer_name !== undefined) {
      update.nombre_cliente = input.customer_name || null;
      clienteData.nombre = input.customer_name || null;
      clienteChanged = true;
    }
    if (input.customer_phone !== undefined) {
      const normalizedPhone = input.customer_phone ? normalizePhone(input.customer_phone) : null;
      update.telefono = normalizedPhone;
      clienteData.telefono = normalizedPhone;
      clienteChanged = true;

      // Si el operador marcó explícitamente actualizar la ficha CRM
      if (input.update_crm && before.customer_id) {
        await this.db
          .from('omnichannel_contacts')
          .update({ phone: normalizedPhone, updated_at: new Date().toISOString() })
          .eq('id', before.customer_id);
      }
    }
    if (input.customer_email !== undefined) {
      update.customer_email = input.customer_email || null;
      clienteData.email = input.customer_email || null;
      clienteChanged = true;
      if (input.update_crm && before.customer_id) {
        await this.db
          .from('omnichannel_contacts')
          .update({ email: input.customer_email || null, updated_at: new Date().toISOString() })
          .eq('id', before.customer_id);
      }
    }
    if (input.address !== undefined) {
      update.direccion = input.address || null;
      clienteData.direccion = input.address || null;
      clienteChanged = true;
    }
    if (input.comuna !== undefined) {
      update.comuna = input.comuna || null;
      clienteData.comuna = input.comuna || null;
      clienteChanged = true;
    }

    if (clienteChanged) {
      update.cliente = clienteData;
    }

    // Manejo de Registro de Impresión (F)
    const existingMetadata = {
      ...(before.shipping_address && typeof before.shipping_address === 'object' && before.shipping_address.metadata
        ? before.shipping_address.metadata
        : {}),
    };

    if (input.print_action === 'mark_printed') {
      const nextCount = (before.print_count || 0) + 1;
      const nowIso = new Date().toISOString();
      const printMeta = {
        ...existingMetadata,
        printed_at: before.printed_at || nowIso,
        last_printed_at: nowIso,
        print_count: nextCount,
        printed_by: changedBy || null,
      };
      update.metadata = printMeta;
    } else if (input.print_action === 'reset_print') {
      const printMeta = {
        ...existingMetadata,
        printed_at: null,
        last_printed_at: null,
        print_count: 0,
        printed_by: null,
      };
      update.metadata = printMeta;
    }

    const { data, error } = await this.db
      .from('pedidos')
      .update(update)
      .eq('id', pedidoId)
      .select('*')
      .single();
    if (error) throw error;

    const updated = mapPedidoToAdminOrder(data);

    // Registro de auditoría
    if (this.capabilities.supportTables) {
      const changes: string[] = [];
      if (before.legacy_status !== updated.legacy_status) {
        changes.push(`Estado: ${before.legacy_status} → ${updated.legacy_status}`);
      }
      if (before.payment_status !== updated.payment_status) {
        changes.push(`Pago: ${before.payment_status} → ${updated.payment_status}`);
      }
      if (before.customer_phone !== updated.customer_phone) {
        changes.push(`Teléfono: ${before.customer_phone || '—'} → ${updated.customer_phone || '—'}`);
      }
      if (before.notes !== updated.notes) {
        changes.push('Notas del cliente actualizadas');
      }
      if (before.admin_notes !== updated.admin_notes) {
        changes.push('Notas internas actualizadas');
      }
      if (input.print_action === 'mark_printed') {
        changes.push(`Orden impresa (Impresión #${updated.print_count})`);
      } else if (input.print_action === 'reset_print') {
        changes.push('Estado de impresión restablecido');
      }

      if (changes.length > 0) {
        await this.db.from('order_status_history').insert({
          pedido_id: pedidoId,
          old_status: before.legacy_status,
          new_status: updated.legacy_status,
          payment_status: updated.payment_status,
          notes: changes.join(' · '),
          changed_by: changedBy || null,
        });
      }
    }

    return updated;
  }

  async createConversationOrder(input: ConversationOrderInput): Promise<AdminOrder> {
    requireSchemaCapability(this.capabilities, 'orderExtensions');
    const { data, error } = await this.db.rpc('conversation_create_order_v1', {
      p_idempotency_key: input.idempotencyKey,
      p_business_unit_id: input.businessUnitId,
      p_customer_id: input.customerId,
      p_conversation_id: input.conversationId,
      p_customer_email: input.customerEmail,
      p_customer_name: input.customerName,
      p_customer_phone: input.customerPhone,
      p_address: input.address,
      p_comuna: input.comuna,
      p_order_items: input.items,
      p_stock_items: input.stockItems,
      p_total: input.total,
      p_payment_method: input.paymentMethod,
      p_payment_confirmed: input.paymentConfirmed,
      p_shipping_cost: input.shippingCost,
      p_shipping_zone_id: input.shippingZoneId,
      p_shipping_zone_name: input.shippingZoneName,
      p_delivery_date: input.deliveryDate,
      p_source_channel: input.sourceChannel,
      p_admin_notes: input.adminNotes,
      p_attribution: input.attribution,
    });
    if (error) throw error;
    const pedidoId = Number((data as JsonRecord)?.pedido_id);
    if (!Number.isInteger(pedidoId)) throw new Error('conversation_create_order_v1 no devolvió pedido_id integer.');
    const order = await this.getById(pedidoId);
    if (!order) throw new Error('El pedido de conversación fue creado pero no pudo recuperarse.');
    return order;
  }

  async createTransactionalCheckout(input: CheckoutOrderInput): Promise<AdminOrder> {
    requireSchemaCapability(this.capabilities, 'orderExtensions');
    const { data, error } = await this.db
      .rpc('checkout_create_order_v2', {
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
        p_shipping_cost: input.shippingCost,
        p_shipping_zone_id: input.shippingZoneId,
        p_shipping_zone_name: input.shippingZoneName,
        p_discount_total: input.discountTotal,
        p_loyalty_discount: input.loyaltyDiscount,
        p_loyalty_points_redeemed: input.loyaltyPointsRedeemed,
        p_attribution: input.attribution,
      });
    if (error) throw error;
    const pedidoId = Number((data as JsonRecord)?.pedido_id);
    if (!Number.isInteger(pedidoId)) throw new Error('checkout_create_order_v2 no devolvió pedido_id integer.');

    if (input.notes) {
      await this.db.from('pedidos').update({ notas: input.notes }).eq('id', pedidoId);
    }

    const order = await this.getById(pedidoId);
    if (!order) throw new Error('El checkout fue creado pero no pudo recuperarse.');
    return order;
  }
}
