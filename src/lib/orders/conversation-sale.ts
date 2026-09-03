import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { callAiProvider } from '@/lib/ai/providers';
import { getAgentRuntimeConfig } from '@/lib/ai/runtime-config';
import { recordLlmUsage } from '@/lib/observability/usage';
import { parseFormatos } from '@/lib/pricing/formatos';
import { calcularPedido } from '@/lib/pricing/calcular-pedido';
import { BusinessRepository } from '@/lib/repositories/business-repository';
import { CustomerRepository } from '@/lib/repositories/customers-repository';
import { OrderRepository, type AdminOrder } from '@/lib/repositories/orders-repository';
import { getSchemaCapabilities } from '@/lib/repositories/schema-capabilities';
import type { CheckoutRequest } from '@/types/domain';

type DraftItem = {
  productId: string | null;
  productName: string;
  quantity: number;
  format: string | null;
  variety: string | null;
  customUnitPrice: number | null;
  isCustom: boolean;
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
  explicitShippingCost: number | null;
  items: DraftItem[];
  transcriptTotal: number | null;
  calculated: { subtotal: number; shipping: number; total: number } | null;
  notes: string;
  missing: string[];
};

export type ConversationSalePrepareOptions = {
  allowExistingOrder?: boolean;
  onlyUnlinkedMessages?: boolean;
};

export type ConversationSaleConfirmOptions = {
  allowExistingOrder?: boolean;
  idempotencyKey?: string;
  linkUnassignedMessages?: boolean;
  attributionMedium?: string;
  allowMissingPhone?: boolean;
  allowTranscriptShipping?: boolean;
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

function cleanPositiveMoney(value: unknown): number | null {
  const amount = Number(value || 0);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount) : null;
}

function cleanPayment(value: unknown): ConversationSaleDraft['paymentMethod'] {
  const method = cleanString(value).toLowerCase();
  if (method === 'transfer' || method === 'mercadopago' || method === 'flow' || method === 'whatsapp') return method;
  return 'unknown';
}

export async function prepareConversationSaleDraft(
  db: SupabaseClient,
  conversationId: string,
  options: ConversationSalePrepareOptions = {},
): Promise<ConversationSaleDraft> {
  const { data: conversation, error: conversationError } = await db
    .from('conversations')
    .select('id,business_unit_id,channel,customer_id,contact_id,order_id,external_conversation_id')
    .eq('id', conversationId)
    .maybeSingle();
  if (conversationError) throw conversationError;
  if (!conversation) throw new Error('conversation_not_found');
  if (conversation.order_id && !options.allowExistingOrder) {
    throw new Error(`conversation_already_has_order:${conversation.order_id}`);
  }

  const customerId = conversation.customer_id || conversation.contact_id || null;
  let messagesQuery = db.from('omnichannel_messages')
    .select('direction,body,message_type,created_at,sent_at,payload,order_id')
    .eq('conversation_id', conversationId);
  if (options.onlyUnlinkedMessages) messagesQuery = messagesQuery.is('order_id', null);
  messagesQuery = messagesQuery.order('created_at', { ascending: false }).limit(100);

  const [{ data: contact, error: contactError }, { data: rawMessages, error: messagesError }] = await Promise.all([
    customerId
      ? db.from('omnichannel_contacts').select('id,nombre,display_name,phone,email,direccion,external_id,metadata').eq('id', customerId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    messagesQuery,
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
    .flatMap((message: any) => {
      const actor = message.direction === 'inbound' ? 'CLIENTE' : 'NEGOCIO';
      const body = cleanString(message.body);
      if (body) return [`${actor}: ${compact(body, 800)}`];
      if (message.direction === 'inbound' && ['image', 'document'].includes(String(message.message_type || ''))) {
        return [`${actor}: [COMPROBANTE O ARCHIVO ADJUNTO]`];
      }
      return [];
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
  // La extracción administrativa de pedidos es independiente de si Remy está
  // habilitado para responder al cliente. Apagar respuestas nunca debe apagar CRM/pedidos.
  if (runtime.executionMode !== 'api') throw new Error('order_extraction_runtime_unavailable');

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
        explicitShippingCost: { type: 'number', minimum: 0, description: 'Costo de despacho explícitamente acordado en el chat; 0 si no aparece.' },
        transcriptTotal: { type: 'number', minimum: 0 },
        notes: { type: 'string' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              productId: { type: 'string', description: 'ID exacto del catálogo o vacío si es un producto personalizado fuera de catálogo.' },
              productName: { type: 'string', description: 'Nombre explícito del producto vendido.' },
              quantity: { type: 'number', minimum: 1 },
              format: { type: 'string' },
              variety: { type: 'string' },
              customUnitPrice: { type: 'number', minimum: 0, description: 'Precio unitario explícito sólo para producto fuera de catálogo; 0 para catálogo.' },
            },
            required: ['productId', 'productName', 'quantity', 'format', 'variety', 'customUnitPrice'],
          },
        },
      },
      required: ['saleDetected', 'customerName', 'address', 'comuna', 'deliveryDate', 'paymentMethod', 'paymentEvidence', 'zoneId', 'explicitShippingCost', 'transcriptTotal', 'notes', 'items'],
    },
  };

  const systemPrompt = `Analizas una conversación de ventas de La Manito del Vegano para preparar un BORRADOR administrativo. Fecha local Chile: ${chileDate()}.
Reglas estrictas:
- No respondas al cliente y no crees pedidos.
- Usa solamente datos explícitos de la conversación, del contacto, catálogo y zonas entregadas.
- Si la conversación no muestra una venta acordada, saleDetected=false.
- Para un producto del CATÁLOGO, productId debe ser exactamente su ID y customUnitPrice=0.
- Si se vendió claramente un producto personalizado que NO está en catálogo, puedes incluirlo sólo cuando nombre y precio unitario estén explícitos en el chat: productId='', productName textual y customUnitPrice con ese precio. Nunca inventes ni estimes un precio.
- quantity debe ser la cantidad comprada, no una cantidad mencionada como opción.
- format y variety sólo si están explícitos y corresponden; si no, usa vacío.
- zoneId sólo si el chat identifica inequívocamente una zona entregada. No infieras geografía por tu cuenta.
- explicitShippingCost es el costo de despacho sólo cuando aparece explícitamente acordado en el chat; si no aparece, 0.
- paymentMethod=transfer sólo si hablan explícitamente de transferencia/comprobante/datos bancarios.
- paymentEvidence=true describe evidencia del chat; el sistema valida aparte si una respuesta humana confirmó el pago.
- transcriptTotal es el total FINAL explícito si aparece; no sumes subtotales para inventarlo. Si no aparece, 0.
- deliveryDate debe ser YYYY-MM-DD sólo si puede resolverse sin ambigüedad desde lo dicho en el chat. Frases como “un día antes del 18/09” sí pueden resolverse usando el año actual.
Debes llamar a extract_sale una sola vez.`;

  const contactMetadata = contact?.metadata && typeof contact.metadata === 'object' ? contact.metadata : {};
  const response = await callAiProvider(db, {
    provider: runtime.provider,
    model: runtime.model,
    systemPrompt,
    messages: [{ role: 'user', content: `CONTACTO:\n${JSON.stringify({
      nombre: contact?.nombre || contact?.display_name || '',
      phone: contact?.phone || (conversation.channel === 'whatsapp' ? contact?.external_id || conversation.external_conversation_id : ''),
      email: contact?.email || '',
      direccion: contact?.direccion || '',
      comuna: contactMetadata.comuna || '',
      canal: conversation.channel,
    })}\n\nCATÁLOGO:\n${JSON.stringify(catalog)}\n\nZONAS:\n${JSON.stringify(shippingZones)}\n\nCONVERSACIÓN:\n${transcript}` }],
    tools: [tool],
    maxOutputTokens: 560,
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
    metadata: { purpose: 'admin_conversation_sale_draft', automatic: Boolean(options.allowExistingOrder || options.onlyUnlinkedMessages) },
  });

  const args = response.toolCalls.find((call) => call.name === 'extract_sale')?.args;
  if (!args) throw new Error('sale_extraction_failed');

  const productMap = new Map(catalog.map((product) => [product.id, product]));
  const zoneMap = new Map(shippingZones.map((zone) => [zone.id, zone]));
  const items: DraftItem[] = Array.isArray(args.items)
    ? args.items.flatMap((raw: any) => {
      const productId = cleanString(raw?.productId);
      const quantity = Math.max(0, Math.floor(Number(raw?.quantity || 0)));
      if (quantity < 1) return [];

      if (productId) {
        const product = productMap.get(productId);
        if (!product) return [];
        const format = cleanString(raw?.format) || null;
        const validFormat = format && product.formatos.includes(format) ? format : null;
        return [{
          productId,
          productName: product.nombre,
          quantity,
          format: validFormat,
          variety: cleanString(raw?.variety) || null,
          customUnitPrice: null,
          isCustom: false,
        }];
      }

      const productName = cleanString(raw?.productName);
      const customUnitPrice = cleanPositiveMoney(raw?.customUnitPrice);
      if (!productName || customUnitPrice == null) return [];
      return [{
        productId: null,
        productName,
        quantity,
        format: cleanString(raw?.format) || null,
        variety: cleanString(raw?.variety) || null,
        customUnitPrice,
        isCustom: true,
      }];
    })
    : [];

  const zoneId = cleanString(args.zoneId);
  const zone = zoneMap.get(zoneId) || null;
  const explicitShippingCost = cleanPositiveMoney(args.explicitShippingCost);
  const phone = cleanString(contact?.phone || (conversation.channel === 'whatsapp' ? contact?.external_id || conversation.external_conversation_id : ''));
  const customerName = cleanString(args.customerName) || cleanString(contact?.nombre || contact?.display_name);
  const address = cleanString(args.address) || cleanString(contact?.direccion);
  const comuna = cleanString(args.comuna) || cleanString(contactMetadata.comuna);
  const paymentMethod = cleanPayment(args.paymentMethod);
  const transcriptTotal = cleanPositiveMoney(args.transcriptTotal);

  const catalogItems = items.filter((item) => !item.isCustom && item.productId);
  const customSubtotal = items
    .filter((item) => item.isCustom && item.customUnitPrice != null)
    .reduce((sum, item) => sum + Number(item.customUnitPrice) * item.quantity, 0);

  let catalogCalculation: any = null;
  if (catalogItems.length) {
    const request: CheckoutRequest = {
      cliente: { nombre: customerName || 'Cliente', direccion: address, telefono: phone, email: cleanString(contact?.email) },
      items: catalogItems.map((item) => ({ productoId: String(item.productId), qty: item.quantity, formato: item.format, variedad: item.variety })),
      zonaId: zone?.id || null,
      cuponCode: null,
      metodoPago: paymentMethod === 'unknown' ? 'transfer' : paymentMethod,
      attribution: { utm_source: conversation.channel, utm_medium: 'manual_conversation' },
    };
    const calculation = await calcularPedido(request, business.id);
    if (calculation.ok) catalogCalculation = calculation;
  }

  let calculated: ConversationSaleDraft['calculated'] = null;
  if (items.length && (!catalogItems.length || catalogCalculation)) {
    const subtotal = Number(catalogCalculation?.subtotal || 0) + customSubtotal;
    const shipping = explicitShippingCost
      ?? Number(catalogCalculation?.costoEnvio ?? zone?.precio ?? 0);
    calculated = { subtotal, shipping, total: subtotal + shipping };
  }

  const saleDetected = Boolean(args.saleDetected);
  const missing: string[] = [];
  if (!saleDetected) missing.push('venta_no_detectada');
  if (!customerName) missing.push('nombre');
  if (!phone) missing.push('telefono');
  if (!items.length) missing.push('productos');
  if (!address) missing.push('direccion');
  if (!comuna) missing.push('comuna');
  if (!cleanString(args.deliveryDate)) missing.push('fecha_entrega');
  if (!zone && explicitShippingCost == null) missing.push('zona_despacho');
  if (paymentMethod === 'unknown') missing.push('medio_pago');
  if (!calculated && items.length) missing.push('validacion_pedido');
  if (calculated && transcriptTotal && Math.abs(calculated.total - transcriptTotal) > 100) missing.push('total_no_coincide');

  return {
    conversationId,
    saleDetected,
    customerName,
    phone,
    email: cleanString(contact?.email),
    address,
    comuna,
    deliveryDate: cleanString(args.deliveryDate),
    paymentMethod,
    paymentEvidence: Boolean(args.paymentEvidence),
    zoneId: zone?.id || null,
    zoneName: zone?.nombre || null,
    explicitShippingCost,
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
  options: ConversationSaleConfirmOptions = {},
) {
  const canUseTranscriptShipping = Boolean(
    options.allowTranscriptShipping
    && !draft.zoneId
    && draft.transcriptTotal
    && draft.calculated
    && draft.transcriptTotal >= draft.calculated.subtotal,
  );
  const canUseExplicitShipping = draft.explicitShippingCost != null;
  const allowedMissing = new Set<string>();
  if (options.allowMissingPhone) allowedMissing.add('telefono');
  if (canUseTranscriptShipping || canUseExplicitShipping) {
    allowedMissing.add('zona_despacho');
    allowedMissing.add('total_no_coincide');
  }
  const blockingMissing = (draft.missing || []).filter((item) => !allowedMissing.has(item));
  if (!draft?.conversationId || !draft.saleDetected || blockingMissing.length) throw new Error('sale_draft_incomplete');
  if (!draft.items?.length || draft.paymentMethod === 'unknown') throw new Error('sale_draft_incomplete');
  if (!draft.zoneId && !canUseTranscriptShipping && !canUseExplicitShipping) throw new Error('sale_draft_incomplete');

  const { data: conversation, error: conversationError } = await db
    .from('conversations')
    .select('id,business_unit_id,channel,customer_id,contact_id,order_id,labels')
    .eq('id', draft.conversationId)
    .maybeSingle();
  if (conversationError) throw conversationError;
  if (!conversation) throw new Error('conversation_not_found');
  if (conversation.order_id && !options.allowExistingOrder) {
    return { ok: true, duplicate: true, orderId: Number(conversation.order_id) };
  }

  const business = conversation.business_unit_id
    ? { id: String(conversation.business_unit_id) }
    : await new BusinessRepository(db).requireDefault();
  const idempotencyKey = options.idempotencyKey || `conversation:${conversation.id}`;
  const catalogItems = draft.items.filter((item) => !item.isCustom && item.productId);
  const customItems = draft.items.filter((item) => item.isCustom && item.customUnitPrice != null);

  const request: CheckoutRequest = {
    idempotencyKey,
    cliente: {
      nombre: draft.customerName,
      direccion: draft.address,
      telefono: draft.phone,
      email: draft.email || '',
    },
    items: catalogItems.map((item) => ({ productoId: String(item.productId), qty: item.quantity, formato: item.format, variedad: item.variety })),
    zonaId: draft.zoneId,
    cuponCode: null,
    metodoPago: draft.paymentMethod,
    attribution: {
      utm_source: conversation.channel,
      utm_medium: options.attributionMedium || 'manual_conversation_confirmed',
    },
  };

  let calculation: any = null;
  if (catalogItems.length) {
    calculation = await calcularPedido(request, business.id);
    if (!calculation.ok) throw new Error(`checkout_validation_failed:${calculation.error || 'unknown'}`);
  }

  const resolvedCatalogItems = calculation?.itemsResueltos || [];
  const customOrderItems = customItems.map((item) => ({
    productoId: null,
    nombre: item.productName,
    qty: item.quantity,
    precio: Number(item.customUnitPrice),
    subtotal: Number(item.customUnitPrice) * item.quantity,
    formato: item.format,
    variedad: item.variety,
    custom: true,
  }));
  const subtotal = Number(calculation?.subtotal || 0)
    + customOrderItems.reduce((sum: number, item: any) => sum + Number(item.subtotal || 0), 0);

  let shippingCost = draft.explicitShippingCost
    ?? Number(calculation?.costoEnvio ?? draft.calculated?.shipping ?? 0);
  let shippingZoneName = draft.explicitShippingCost != null
    ? 'Despacho acordado por conversación'
    : calculation?.zonaNombre || draft.zoneName;
  let total = subtotal + shippingCost;

  if (canUseTranscriptShipping && draft.transcriptTotal && draft.explicitShippingCost == null) {
    shippingCost = draft.transcriptTotal - subtotal;
    shippingZoneName = 'Despacho acordado por conversación';
    total = draft.transcriptTotal;
  } else if (draft.transcriptTotal && Math.abs(total - draft.transcriptTotal) > 100) {
    throw new Error('total_mismatch');
  }

  const capabilities = getSchemaCapabilities();
  const orderRepository = new OrderRepository(db, capabilities);
  const transferPaid = draft.paymentMethod === 'transfer' && draft.paymentEvidence;
  const adminNotes = `Pedido confirmado desde conversación ${conversation.channel}. ${draft.notes || ''}`.trim();
  const useConversationOrder = Boolean(
    options.allowMissingPhone
    || options.allowTranscriptShipping
    || customItems.length
    || draft.explicitShippingCost != null,
  );
  let customerId: string;
  let order: AdminOrder;
  let updated: AdminOrder;

  if (useConversationOrder) {
    customerId = String(conversation.customer_id || conversation.contact_id || '');
    if (!customerId) throw new Error('conversation_customer_not_found');
    order = await orderRepository.createConversationOrder({
      idempotencyKey,
      businessUnitId: business.id,
      customerId,
      conversationId: String(conversation.id),
      customerEmail: draft.email || null,
      customerName: draft.customerName,
      customerPhone: draft.phone || null,
      address: draft.address || null,
      comuna: draft.comuna || null,
      items: [...resolvedCatalogItems, ...customOrderItems],
      stockItems: resolvedCatalogItems,
      total,
      paymentMethod: draft.paymentMethod,
      paymentConfirmed: transferPaid,
      shippingCost,
      shippingZoneId: draft.zoneId,
      shippingZoneName,
      deliveryDate: draft.deliveryDate || null,
      sourceChannel: conversation.channel,
      adminNotes,
      attribution: request.attribution || {},
    });
    updated = order;
  } else {
    if (!calculation) throw new Error('checkout_validation_failed:missing_calculation');
    const customerRepository = new CustomerRepository(db, capabilities);
    const customer = await customerRepository.upsertCheckoutContact(business.id, {
      email: draft.email || null,
      phone: draft.phone,
      nombre: draft.customerName,
      direccion: draft.address,
      comuna: draft.comuna,
    }, conversation.customer_id || conversation.contact_id || null);
    customerId = customer.id;
    order = await orderRepository.createTransactionalCheckout({
      idempotencyKey,
      businessUnitId: business.id,
      customerId: customer.id,
      customerEmail: customer.email || null,
      customerName: draft.customerName,
      customerPhone: draft.phone,
      address: draft.address,
      comuna: draft.comuna,
      items: resolvedCatalogItems,
      total,
      paymentMethod: draft.paymentMethod,
      shippingCost,
      shippingZoneId: draft.zoneId,
      shippingZoneName,
      loyaltyDiscount: 0,
      loyaltyPointsRedeemed: 0,
      discountTotal: Number(calculation.descuentoCupon || 0),
      stockItems: resolvedCatalogItems,
      attribution: request.attribution || {},
    });
    updated = await orderRepository.update(order.numeric_id, {
      status: transferPaid ? 'confirmed' : 'pending',
      payment_status: transferPaid ? 'paid' : 'pending',
      admin_notes: adminNotes,
    }, changedBy);
  }

  await db.from('pedidos').update({
    source_channel: conversation.channel,
    fecha_entrega: draft.deliveryDate,
    comuna: draft.comuna,
  }).eq('id', order.numeric_id);

  if (options.linkUnassignedMessages) {
    const { error: messageLinkError } = await db.from('omnichannel_messages')
      .update({ order_id: order.numeric_id })
      .eq('conversation_id', conversation.id)
      .is('order_id', null);
    if (messageLinkError) throw messageLinkError;
  }

  const labels = Array.from(new Set([
    ...(Array.isArray(conversation.labels) ? conversation.labels.map(String).filter((label) => label !== 'personal') : []),
    'pedido',
    ...(transferPaid ? ['pagado'] : []),
  ]));
  const { error: conversationUpdateError } = await db.from('conversations').update({
    order_id: order.numeric_id,
    customer_id: customerId,
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
