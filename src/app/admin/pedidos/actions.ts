'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/supabase/require-role';
import { enviarEmail } from '@/lib/email/resend';
import { plantillaPedidoDespachado } from '@/lib/email/templates';
import type { EstadoPedido, Pedido } from '@/types/domain';
import { OrderRepository, normalizeOrderStatus } from '@/lib/repositories/orders-repository';
import {
  createManualOrder,
  updateFullOrder,
  type FullOrderUpdateInput,
  type ManualOrderInput,
} from '@/lib/orders/admin-order-admin';

const BUSINESS_UNIT_ID = 'f3b57ce7-0796-40e5-94f1-07cb2b48ba85';
const PAYMENT_STATUSES = new Set(['pending', 'paid', 'failed', 'refunded', 'partial']);
const CHANNELS = new Set(['web', 'whatsapp', 'instagram', 'messenger', 'manual', 'admin']);
const LEGACY_STATUSES = new Set(['Pendiente', 'Pagado', 'Despachado', 'Completado', 'Cancelado']);

type RawItem = {
  custom?: boolean;
  productoId?: string | null;
  nombre?: string;
  qty?: number | string;
  precio?: number | string;
  formato?: string | null;
  variedad?: string | null;
  notas?: string | null;
};

type AdminOrderPayload = {
  draftKey?: string;
  customerId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  address?: string | null;
  comuna?: string | null;
  deliveryDate?: string | null;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  shippingCost?: number | string | null;
  shippingZoneId?: string | null;
  shippingZoneName?: string | null;
  sourceChannel?: string | null;
  estado?: string | null;
  adminNotes?: string | null;
  notes?: string | null;
  items?: RawItem[];
};

function cleanText(value: unknown) {
  const text = String(value ?? '').trim();
  return text || null;
}

function normalizeOrderItems(raw: unknown) {
  if (!Array.isArray(raw) || raw.length === 0) throw new Error('El pedido debe tener al menos un producto.');
  const items = raw.map((input, index) => {
    const row = (input || {}) as RawItem;
    const qty = Math.trunc(Number(row.qty));
    const precio = Math.round(Number(row.precio));
    const nombre = cleanText(row.nombre);
    const productoId = cleanText(row.productoId);
    const custom = Boolean(row.custom || !productoId);
    if (!Number.isInteger(qty) || qty <= 0) throw new Error(`Cantidad inválida en el ítem ${index + 1}.`);
    if (!Number.isFinite(precio) || precio < 0) throw new Error(`Precio inválido en el ítem ${index + 1}.`);
    if (!nombre) throw new Error(`Falta el nombre del ítem ${index + 1}.`);
    if (!custom && !productoId) throw new Error(`Falta el producto de catálogo en el ítem ${index + 1}.`);
    return {
      ...(custom ? { custom: true } : { productoId }),
      nombre,
      qty,
      precio,
      ...(cleanText(row.formato) ? { formato: cleanText(row.formato) } : {}),
      ...(cleanText(row.variedad) ? { variedad: cleanText(row.variedad) } : {}),
      ...(cleanText(row.notas) ? { notas: cleanText(row.notas) } : {}),
    };
  });
  const stockItems = items.filter((item) => 'productoId' in item && Boolean(item.productoId));
  const subtotal = items.reduce((sum, item) => sum + item.qty * item.precio, 0);
  return { items, stockItems, subtotal };
}

function parseShipping(value: unknown) {
  const number = Math.round(Number(value || 0));
  if (!Number.isFinite(number) || number < 0) throw new Error('Costo de envío inválido.');
  return number;
}

export async function cambiarEstadoPedido(id: string, nuevoEstado: EstadoPedido) {
  await requireRole(['admin', 'soporte', 'bodega']);

  const supabase = createSupabaseServiceClient();
  const pedido = await new OrderRepository(supabase).update(id, { status: normalizeOrderStatus(nuevoEstado) });

  if (nuevoEstado === 'Despachado' && pedido.cliente?.email) {
    enviarEmail({
      to: pedido.cliente.email,
      subject: `Tu pedido #${id.slice(0, 8)} va en camino 🚚`,
      html: plantillaPedidoDespachado(pedido as unknown as Pedido),
    }).then((res) => {
      if (!res.ok) console.error('No se pudo enviar email de despacho:', res.error);
    });
  }

  revalidatePath('/admin/pedidos');
  revalidatePath('/admin');
}

export async function guardarPedidoGestion(
  id: string,
  nuevoEstado: EstadoPedido,
  trackingNumber: string,
  adminNotes: string
) {
  await requireRole(['admin', 'soporte', 'bodega']);

  const supabase = createSupabaseServiceClient();
  const pedido = await new OrderRepository(supabase).update(id, {
    status: normalizeOrderStatus(nuevoEstado),
    tracking_number: trackingNumber,
    admin_notes: adminNotes,
  });

  if (nuevoEstado === 'Despachado' && pedido?.cliente?.email) {
    enviarEmail({
      to: pedido.cliente.email,
      subject: `Tu pedido #${id.slice(0, 8)} va en camino 🚚`,
      html: plantillaPedidoDespachado(pedido as unknown as Pedido),
    }).then((res) => {
      if (!res.ok) console.error('No se pudo enviar email de despacho:', res.error);
    });
  }

  revalidatePath(`/admin/pedidos/${id}`);
  revalidatePath('/admin/pedidos');
  revalidatePath('/admin');
}

export async function guardarPedidoCompleto(id: string, payload: AdminOrderPayload) {
  const admin = await requireRole(['admin', 'soporte']);
  const { items, stockItems } = normalizeOrderItems(payload.items);
  const paymentStatus = String(payload.paymentStatus || 'pending');
  const sourceChannel = String(payload.sourceChannel || 'manual');
  const estado = String(payload.estado || 'Pendiente');
  if (!PAYMENT_STATUSES.has(paymentStatus)) throw new Error('Estado de pago inválido.');
  if (!CHANNELS.has(sourceChannel)) throw new Error('Canal inválido.');
  if (!LEGACY_STATUSES.has(estado)) throw new Error('Estado operacional inválido.');

  const input: FullOrderUpdateInput = {
    customerName: cleanText(payload.customerName),
    customerPhone: cleanText(payload.customerPhone),
    customerEmail: cleanText(payload.customerEmail),
    address: cleanText(payload.address),
    comuna: cleanText(payload.comuna),
    deliveryDate: cleanText(payload.deliveryDate),
    paymentMethod: cleanText(payload.paymentMethod),
    paymentStatus: paymentStatus as FullOrderUpdateInput['paymentStatus'],
    shippingCost: parseShipping(payload.shippingCost),
    shippingZoneId: cleanText(payload.shippingZoneId),
    shippingZoneName: cleanText(payload.shippingZoneName),
    sourceChannel: sourceChannel as FullOrderUpdateInput['sourceChannel'],
    estado: estado as FullOrderUpdateInput['estado'],
    adminNotes: cleanText(payload.adminNotes),
    notes: cleanText(payload.notes),
    items,
    stockItems,
  };

  const db = createSupabaseServiceClient();
  const order = await updateFullOrder(db, id, input, admin.email || admin.id || null);
  revalidatePath(`/admin/pedidos/${id}`);
  revalidatePath('/admin/pedidos');
  revalidatePath('/admin');
  return { ok: true, orderId: order.numeric_id };
}

export async function crearPedidoManual(payload: AdminOrderPayload) {
  const admin = await requireRole(['admin', 'soporte']);
  const { items, stockItems, subtotal } = normalizeOrderItems(payload.items);
  const paymentStatus = String(payload.paymentStatus || 'pending');
  const sourceChannel = String(payload.sourceChannel || 'manual');
  if (!PAYMENT_STATUSES.has(paymentStatus)) throw new Error('Estado de pago inválido.');
  if (!CHANNELS.has(sourceChannel)) throw new Error('Canal inválido.');
  const customerName = cleanText(payload.customerName);
  if (!customerName) throw new Error('El nombre del cliente es obligatorio.');
  const shippingCost = parseShipping(payload.shippingCost);
  const draftKey = cleanText(payload.draftKey) || randomUUID();

  const input: ManualOrderInput = {
    idempotencyKey: `admin:${admin.id}:${draftKey}`,
    businessUnitId: BUSINESS_UNIT_ID,
    customerId: cleanText(payload.customerId),
    customerEmail: cleanText(payload.customerEmail),
    customerName,
    customerPhone: cleanText(payload.customerPhone),
    address: cleanText(payload.address),
    comuna: cleanText(payload.comuna),
    items,
    stockItems,
    total: subtotal + shippingCost,
    paymentMethod: cleanText(payload.paymentMethod) || 'transfer',
    paymentStatus: paymentStatus as ManualOrderInput['paymentStatus'],
    shippingCost,
    shippingZoneId: cleanText(payload.shippingZoneId),
    shippingZoneName: cleanText(payload.shippingZoneName),
    deliveryDate: cleanText(payload.deliveryDate),
    sourceChannel: sourceChannel as ManualOrderInput['sourceChannel'],
    adminNotes: cleanText(payload.adminNotes),
    attribution: { utm_source: sourceChannel, utm_medium: 'admin_manual' },
  };

  const db = createSupabaseServiceClient();
  const order = await createManualOrder(db, input);
  revalidatePath('/admin/pedidos');
  revalidatePath('/admin');
  return { ok: true, orderId: order.numeric_id };
}
