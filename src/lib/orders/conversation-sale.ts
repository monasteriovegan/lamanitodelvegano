import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { callAiProvider } from '@/lib/ai/providers';
import { getAgentRuntimeConfig } from '@/lib/ai/runtime-config';
import { recordLlmUsage } from '@/lib/observability/usage';
import { parseFormatos } from '@/lib/pricing/formatos';
import { calcularPedido } from '@/lib/pricing/calcular-pedido';
import { BusinessRepository } from '@/lib/repositories/business-repository';
import { CustomerRepository } from '@/lib/repositories/customers-repository';
import { OrderRepository } from '@/lib/repositories/orders-repository';
import { getSchemaCapabilities } from '@/lib/repositories/schema-capabilities';
import type { CheckoutRequest } from '@/types/domain';

type DraftItem = {
  productId: string;
  productName: string;
  quantity: number;
  format: string | null;
  variety: string | null;
};

export type ConversationSaleDraft = {
  conversationId: string;
  saleDetected: boolean;
  customerName: string;
  phone: string;
  email: string;
  address: string;
  comuna: string;
  deliveryDate: string;
  paymentMethod: 'transfer' | 'mercadopago' | 'flow' | 'whatsapp' | 'unknown';
  paymentEvidence: boolean;
  zoneId: string | null;
  zoneName: string | null;
  items: DraftItem[];
  transcriptTotal: number | null;
  calculated: { subtotal: number; shipping: number; total: number } | null;
  notes: string;
  missing: string[];
};

function compact(value: unknown, max = 12000) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length <= max ? text : text.slice(text.length - max);
}

function chileDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanPayment(value: unknown): ConversationSaleDraft['paymentMethod'] {
  const method = cleanString(value).toLowerCase();
  if (method === 'transfer' || method === 'mercadopago' || method === 'flow' || method === 'whatsapp') return method;
  return 'unknown';
}

export async function prepareConversationSaleDraft(db: SupabaseClient, conversationId: string): Promise<ConversationSaleDraft> {
  const { data: conversation, error: conversationError } = await db
    .from('conversations')
    .select('id,business_unit_id,channel,customer_id,contact_id,order_id,external_conversation_id')
    .eq('id', conversationId)
    .maybeSingle();
  if (conversationError) throw conversationError;
  if (!conversation) throw new Error('conversation_not_found');
  if (conversation.order_id) throw new Error(`conversation_already_has_order:${conversation.order_id}`);

  const customerId = conversation.customer_id || conversation.contact_id || null;
  const [{ data: contact, error: contactError }, { data: rawMessages, error: messagesError }] = await Promise.all([
    customerId
      ? db.from('omnichannel_contacts').select('id,nombre,display_name,phone,email,direccion,external_id').eq('id', customerId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    db.from('omnichannel_messages')
      .select('direction,body,message_type,created_at,sent_at,payload')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(100),
  ]);
  if (contactError) throw contactError;
  if (messagesError) throw messagesError;

  const business = conversation.business_unit_id
    ? { id: String(conversation.business_unit_id) }
    : await new BusinessRepository(db).requireDefault();

  const [{ data: products, error: productsError }, { data: zones, error: zonesError }] = await Promise.all([
    db.from('productos')
      .select('id,nombre,precio,gramaje,variedades,maneja_stock,stock')
      .eq('business_unit_id', business.id)
      .eq('activo', true)
      .order('nombre'),
    db.from('zonas').select('id,nombre,precio').order('precio'),
  ]);
  if (productsError) throw productsError;
  if (zonesError) throw zonesError;

  const messages = [...(rawMessages || [])].reverse()
    .filter((message: any) => cleanString(message.body))
    .map((message: any) => {
      const actor = message.direction === 'inbound' ? 'CLIENTE' : 'NEGOCIO';
      return `${actor}: ${compact(message.body, 800)}`;
    });
  const transcript = compact(messages.join('\n'), 14000);
  if (!transcript) throw new Error('conversation_has_no_text');

  const catalog = (products || []).map((product: any) => ({
    id: String(product.id),
    nombre: String(product.nombre),
    precio: Number(product.precio || 0),
    formatos: parseFormatos(product.gramaje, Number(product.precio || 0)).map((entry) => entry.label),
    variedades: product.variedades || null,
    stock: product.maneja_stock ? Number(product.stock || 0) : null,
  }));
  const shippingZones = (zones || []).map((zone: any) => ({
    id: String(zone.id), nombre: String(zone.nombre), precio: Number(zone.precio || 0),
  }));

  const runtime = await getAgentRuntimeConfig(db, 'remy', {
    provider: 'groq', model: 'openai/gpt-oss-20b', executionMode: 'api',
  });
  if (!runtime.enabled || runtime.executionMode !== 'api') throw new Error('remy_runtime_unavailable');

  const tool = {
    name: 'extract_sale',
    description: 'Extrae una venta ya acordada desde una conversación comercial. No inventa datos.',
    inputSchema: {
      type: 'object',
      properties: {
        saleDetected: { type: 'boolean' },
        customerName: { type: 'string' },
        address: { type: 'string' },
        comuna: { type: 'string' },
        deliveryDate: { type: 'string', description: 'YYYY-MM-DD o vacío' },
        paymentMethod: { type: 'string', enum: ['transfer', 'mercadopago', 'flow', 'whatsapp', 'unknown'] },
        paymentEvidence: { type: 'boolean', description: 'Hay comprobante, confirmación de transferencia o evidencia textual de pago.' },
        zoneId: { type: 'string', description: 'ID exacto de una zona entregada en contexto, o vacío.' },
        transcriptTotal: { type: 'number', minimum: 0 },
        notes: { type: 'string' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              productId: { type: 'string' },
              quantity: { type: 'number', minimum: 1 },
              format: { type: 'string' },
              variety: { type: 'string' },
            },
            required: ['productId', 'quantity'],
          },
        },
      },
      required: ['saleDetected', 'customerName', 'address', 'comuna', 'deliveryDate', 'paymentMethod', 'paymentEvidence', 'zoneId', 'transcriptTotal', 'notes', 'items'],
    },
  };

  const systemPrompt = `Analizas una conversación de ventas de La Manito del Vegano para preparar un BORRADOR administrativo. Fecha local Chile: ${chileDate()}.
Reglas estrictas:
- No respondas al cliente y no crees pedidos.
- Usa solamente datos explícitos de la conversación, del contacto, catálogo y zonas entregadas.
- Si la conversación no muestra una venta acordada, saleDetected=false.
- productId debe ser exactamente uno de los IDs del catálogo. Si el producto no se puede asociar con seguridad, omítelo.
- quantity debe ser la cantidad comprada, no una cantidad mencionada como opción.
- format y variety sólo si están explícitos y corresponden al producto; si no, usa vacío.
- zoneId sólo si la conversación identifica claramente la zona (por nombre/dentro-fuera de Vespucio) o un costo de despacho que coincide inequívocamente con una zona. No infieras geografía por tu cuenta.
- paymentMethod=transfer sólo si hablan explícitamente de transferencia/comprobante/datos bancarios.
- paymentEvidence=true no significa que el sistema deba marcar pagado; un humano lo confirmará.
- transcriptTotal es el total final explícito de la venta si aparece; si no, 0.
- deliveryDate debe ser YYYY-MM-DD sólo si puede resolverse sin ambigüedad desde lo dicho en el chat.
Debes llamar a extract_sale una sola vez.`;

  const response = await callAiProvider(db, {
    provider: runtime.provider,
    model: runtime.model,
    systemPrompt,
    messages: [{ role: 'user', content: `CONTACTO:\n${JSON.stringify({
      nombre: contact?.nombre || contact?.display_name || '',
      phone: contact?.phone || (conversation.channel === 'whatsapp' ? contact?.external_id || conversation.external_conversation_id : ''),
      email: contact?.email || '',
      direccion: contact?.direccion || '',
      canal: conversation.channel,
    })}\n\nCATÁLOGO:\n${JSON.stringify(catalog)}\n\nZONAS:\n${JSON.stringify(shippingZones)}\n\nCONVERSACIÓN:\n${transcript}` }],
    tools: [tool],
    maxOutputTokens: 420,
    temperature: 0,
  });

  await recordLlmUsage(db, {
    businessUnitId: business.id,
    conversationId,
    agent: 'remy',
    provider: runtime.provider,
    model: runtime.model,
    usage: response.usage,
    latencyMs: response.latencyMs,
    metadata: { purpose: 'admin_conversation_sale_draft', automatic: false },
  });

  const args = response.toolCalls.find((call) => call.name === 'extract_sale')?.args;
  if (!args) throw new Error('sale_extraction_failed');

  const productMap = new Map(catalog.map((product) => [product.id, product]));
  const zoneMap = new Map(shippingZones.map((zone) => [zone.id, zone]));
  const items: DraftItem[] = Array.isArray(args.items)
    ? args.items.flatMap((raw: any) => {
      const productId = cleanString(raw?.productId);
      const product = productMap.get(productId);
      const quantity = Math.max(0, Math.floor(Number(raw?.quantity || 0)));
      if (!product || quantity < 1) return [];
      const format = cleanString(raw?.format) || null;
      const validFormat = format && product.formatos.includes(format) ? format : null;
      return [{
        productId,
        productName: product.nombre,
        quantity,
        format: validFormat,
        variety: cleanString(raw?.variety) || null,
      }];
    })
    : [];

  const zoneId = cleanString(args.zoneId);
  const zone = zoneMap.get(zoneId) || null;
  const phone = cleanString(contact?.phone || (conversation.channel === 'whatsapp' ? contact?.external_id || conversation.external_conversation_id : ''));
  const customerName = cleanString(args.customerName) || cleanString(contact?.nombre || contact?.display_name);
  const address = cleanString(args.address) || cleanString(contact?.direccion);
  const paymentMethod = cleanPayment(args.paymentMethod);
  const transcriptTotal = Number(args.transcriptTotal || 0) > 0 ? Math.round(Number(args.transcriptTotal)) : null;

  let calculated: ConversationSaleDraft['calculated'] = null;
  if (items.length && zone) {
    const request: CheckoutRequest = {
      cliente: { nombre: customerName || 'Cliente', direccion: address, telefono: phone, email: cleanString(contact?.email) },
      items: items.map((item) => ({ productoId: item.productId, qty: item.quantity, formato: item.format, variedad: item.variety })),
      zonaId: zone.id,
      cuponCode: null,
      metodoPago: paymentMethod === 'unknown' ? 'transfer' : paymentMethod,
      attribution: { utm_source: conversation.channel, utm_medium: 'manual_conversation' },
    };
    const calculation = await calcularPedido(request, business.id);
    if (calculation.ok) {
      calculated = {
        subtotal: Number(calculation.subtotal || 0),
        shipping: Number(calculation.costoEnvio || 0),
        total: Number(calculation.total || 0),
      };
    }
  }

  const saleDetected = Boolean(args.saleDetected);
  const missing: string[] = [];
  if (!saleDetected) missing.push('venta_no_detectada');
  if (!customerName) missing.push('nombre');
  if (!phone) missing.push('telefono');
  if (!items.length) missing.push('productos');
  if (!address) missing.push('direccion');
  if (!cleanString(args.comuna)) missing.push('comuna');
  if (!cleanString(args.deliveryDate)) missing.push('fecha_entrega');
  if (!zone) missing.push('zona_despacho');
  if (paymentMethod === 'unknown') missing.push('medio_pago');
  if (!calculated && items.length && zone) missing.push('validacion_pedido');
  if (calculated && transcriptTotal && Math.abs(calculated.total - transcriptTotal) > 100) missing.push('total_no_coincide');

  return {
    conversationId,
    saleDetected,
    customerName,
    phone,
    email: cleanString(contact?.email),
    address,
    comuna: cleanString(args.comuna),
    deliveryDate: cleanString(args.deliveryDate),
    paymentMethod,
    paymentEvidence: Boolean(args.paymentEvidence),
    zoneId: zone?.id || null,
    zoneName: zone?.nombre || null,
    items,
    transcriptTotal,
    calculated,
    notes: cleanString(args.notes),
    missing,
  };
}

export async function confirmConversationSale(
  db: SupabaseClient,
  draft: ConversationSaleDraft,
  changedBy?: string,
) {
  if (!draft?.conversationId || !draft.saleDetected || draft.missing?.length) throw new Error('sale_draft_incomplete');
  if (!draft.zoneId || !draft.items?.length || draft.paymentMethod === 'unknown') throw new Error('sale_draft_incomplete');

  const { data: conversation, error: conversationError } = await db
    .from('conversations')
    .select('id,business_unit_id,channel,customer_id,contact_id,order_id,labels')
    .eq('id', draft.conversationId)
    .maybeSingle();
  if (conversationError) throw conversationError;
  if (!conversation) throw new Error('conversation_not_found');
  if (conversation.order_id) return { ok: true, duplicate: true, orderId: Number(conversation.order_id) };

  const business = conversation.business_unit_id
    ? { id: String(conversation.business_unit_id) }
    : await new BusinessRepository(db).requireDefault();

  const request: CheckoutRequest = {
    idempotencyKey: `conversation:${conversation.id}`,
    cliente: {
      nombre: draft.customerName,
      direccion: draft.address,
      telefono: draft.phone,
      email: draft.email || '',
    },
    items: draft.items.map((item) => ({ productoId: item.productId, qty: item.quantity, formato: item.format, variedad: item.variety })),
    zonaId: draft.zoneId,
    cuponCode: null,
    metodoPago: draft.paymentMethod,
    attribution: { utm_source: conversation.channel, utm_medium: 'manual_conversation_confirmed' },
  };

  const calculation = await calcularPedido(request, business.id);
  if (!calculation.ok) throw new Error(`checkout_validation_failed:${calculation.error || 'unknown'}`);
  const total = Number(calculation.total || 0);
  if (draft.transcriptTotal && Math.abs(total - draft.transcriptTotal) > 100) throw new Error('total_mismatch');

  const capabilities = getSchemaCapabilities();
  const customerRepository = new CustomerRepository(db, capabilities);
  const customer = await customerRepository.upsertCheckoutContact(business.id, {
    email: draft.email || null,
    phone: draft.phone,
    nombre: draft.customerName,
    direccion: draft.address,
  });
  const orderRepository = new OrderRepository(db, capabilities);
  const order = await orderRepository.createTransactionalCheckout({
    idempotencyKey: `conversation:${conversation.id}`,
    businessUnitId: business.id,
    customerId: customer.id,
    customerEmail: customer.email || null,
    customerName: draft.customerName,
    customerPhone: draft.phone,
    address: draft.address,
    comuna: draft.comuna,
    items: calculation.itemsResueltos || [],
    total,
    paymentMethod: draft.paymentMethod,
    shippingCost: Number(calculation.costoEnvio || 0),
    shippingZoneId: draft.zoneId,
    shippingZoneName: calculation.zonaNombre || draft.zoneName,
    loyaltyDiscount: 0,
    loyaltyPointsRedeemed: 0,
    discountTotal: Number(calculation.descuentoCupon || 0),
    stockItems: calculation.itemsResueltos || [],
    attribution: request.attribution || {},
  });

  const transferPaid = draft.paymentMethod === 'transfer' && draft.paymentEvidence;
  const updated = await orderRepository.update(order.numeric_id, {
    status: transferPaid ? 'confirmed' : 'pending',
    payment_status: transferPaid ? 'paid' : 'pending',
    admin_notes: `Pedido confirmado desde conversación ${conversation.channel}. ${draft.notes || ''}`.trim(),
  }, changedBy);

  await db.from('pedidos').update({
    source_channel: conversation.channel,
    fecha_entrega: draft.deliveryDate,
    comuna: draft.comuna,
  }).eq('id', order.numeric_id);

  const labels = Array.from(new Set([
    ...(Array.isArray(conversation.labels) ? conversation.labels.map(String) : []),
    'pedido',
    ...(transferPaid ? ['pagado'] : []),
  ]));
  const { error: conversationUpdateError } = await db.from('conversations').update({
    order_id: order.numeric_id,
    customer_id: customer.id,
    labels,
    updated_at: new Date().toISOString(),
  }).eq('id', conversation.id);
  if (conversationUpdateError) throw conversationUpdateError;

  return {
    ok: true,
    duplicate: false,
    orderId: order.numeric_id,
    trackingNumber: updated.tracking_number,
    total,
    paymentStatus: updated.payment_status,
    status: updated.status,
  };
}
