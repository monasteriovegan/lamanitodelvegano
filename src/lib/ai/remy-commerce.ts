import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProviderToolDefinition } from '@/lib/ai/providers';
import { calcularPedido } from '@/lib/pricing/calcular-pedido';
import { genFechas } from '@/lib/pricing/fechas';
import { parseFormatos, parseVariedades } from '@/lib/pricing/formatos';
import { CustomerRepository } from '@/lib/repositories/customers-repository';
import { OrderRepository } from '@/lib/repositories/orders-repository';
import { getSchemaCapabilities } from '@/lib/repositories/schema-capabilities';
import { createPaymentLink, type PaymentProvider } from '@/lib/payments/payment-link';
import type { CheckoutRequest, ItemCarrito } from '@/types/domain';
import { runtimeSiteUrl } from '@/lib/site-url';

export type RemyToolContext = {
  businessUnitId: string;
  customerId?: string | null;
  conversationId?: string | null;
  channel: 'whatsapp' | 'instagram' | 'web';
  externalUserId?: string | null;
  userText: string;
  previousAssistantText?: string;
};

type CartRow = {
  id: string;
  identificador: string | null;
  items: ItemCarrito[];
  subtotal: number | null;
  metadata: Record<string, unknown> | null;
  recuperado: boolean | null;
  order_id: number | null;
};

const PRODUCT_INTENT = /producto|cat[aá]logo|precio|valor|stock|disponib|sabor|ingred|alerg|gluten|barra|bomb[oó]n|alfajor|trufa|torta|box|manjar|prote[ií]n|chocolate|seit[aá]n|lomo|kostill|fiestas?\s+patrias?|(?:el\s+)?18/i;
const CART_INTENT = /carrito|agrega|agregar|a[nñ]ade|a[nñ]adir|quita|quitar|saca|sacar|llevo|quiero\s+(?:uno|una|dos|tres|comprar)|dame|ponme/i;
const CHECKOUT_INTENT = /comprar|compra|pedido|confirm|finaliz|checkout|pagar|pago|mercado\s*pago|flow|transfer|direcci[oó]n|comuna|despach|env[ií]o|fecha|entrega|tel[eé]fono|celular/i;
const STATUS_INTENT = /estado.*pedido|pedido.*estado|seguimiento|rastrear|d[oó]nde.*pedido|despachado|entregado|cu[aá]ndo.*llega/i;
const EXPLICIT_ORDER_CONFIRM = /confirmo(?:\s+el)?\s+pedido|confirmar(?:\s+el)?\s+pedido|haz(?:me)?\s+el\s+pedido|hacer\s+el\s+pedido|procesa(?:r)?\s+el\s+pedido|finaliza(?:r)?\s+el\s+pedido|quiero\s+comprar|dale\s+con\s+el\s+pedido|s[ií][,\s]+(?:confirmo|haz|procesa|finaliza)/i;
const SHORT_CONFIRM = /^(?:s[ií]|dale|ok|okay|ya|por\s*favor|confirmo|hazlo|vamos)$/i;
const PRIOR_ORDER_CONFIRM = /(?:confirm|finaliz|crear|hacer|procesar).{0,50}pedido|pedido.{0,50}(?:confirm|finaliz|crear|hacer|procesar)/i;

function hasExplicitOrderConfirmation(context: RemyToolContext) {
  return EXPLICIT_ORDER_CONFIRM.test(context.userText)
    || (
      SHORT_CONFIRM.test(context.userText.trim())
      && PRIOR_ORDER_CONFIRM.test(String(context.previousAssistantText || ''))
    );
}

export function selectRemyTools(userText: string): ProviderToolDefinition[] {
  const tools: ProviderToolDefinition[] = [];
  const add = (tool: ProviderToolDefinition) => {
    if (!tools.some((item) => item.name === tool.name)) tools.push(tool);
  };

  if (PRODUCT_INTENT.test(userText)) add(TOOL_DEFINITIONS.catalog_search);

  // En una conversación de checkout priorizamos el camino que permite realmente
  // vender: localizar producto, agregarlo, completar datos, crear pedido y pagar.
  // Las mutaciones secundarias (quitar/vaciar) se agregan después si el turno las pide.
  if (CHECKOUT_INTENT.test(userText)) {
    add(TOOL_DEFINITIONS.catalog_search);
    add(TOOL_DEFINITIONS.cart_get);
    add(TOOL_DEFINITIONS.cart_add);
    add(TOOL_DEFINITIONS.shipping_quote);
    add(TOOL_DEFINITIONS.checkout_update);
    add(TOOL_DEFINITIONS.checkout_status);
    add(TOOL_DEFINITIONS.order_create);
    add(TOOL_DEFINITIONS.payment_link);
  }
  if (CART_INTENT.test(userText)) {
    add(TOOL_DEFINITIONS.catalog_search);
    add(TOOL_DEFINITIONS.cart_get);
    add(TOOL_DEFINITIONS.cart_add);
    add(TOOL_DEFINITIONS.cart_remove);
    add(TOOL_DEFINITIONS.cart_clear);
  }
  if (STATUS_INTENT.test(userText)) add(TOOL_DEFINITIONS.order_status);
  return tools.slice(0, 8);
}

const TOOL_DEFINITIONS: Record<string, ProviderToolDefinition> = {
  catalog_search: {
    name: 'catalog_search',
    description: 'Busca productos reales de este negocio. Úsala antes de afirmar precios, stock, ingredientes, formatos, variedades o IDs de producto.',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Producto o característica buscada.' } },
      required: ['query'],
      additionalProperties: false,
    },
  },
  cart_get: {
    name: 'cart_get',
    description: 'Obtiene el carrito conversacional actual del cliente.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  cart_add: {
    name: 'cart_add',
    description: 'Agrega una variante real al carrito. Usa variantId y selections de catalog_search para promociones normalizadas; format/variety solo mantienen compatibilidad con productos antiguos.',
    inputSchema: {
      type: 'object',
      properties: {
        productId: { type: 'string', description: 'UUID obtenido de catalog_search.' },
        quantity: { type: 'integer', minimum: 1, maximum: 20 },
        variantId: { type: 'string', description: 'UUID de la variante obtenido de catalog_search.' },
        selections: {
          type: 'array',
          description: 'Mezcla exacta de sabores/opciones elegida por el cliente.',
          items: {
            type: 'object',
            properties: {
              optionValueId: { type: 'string' },
              quantity: { type: 'integer', minimum: 1, maximum: 20 },
            },
            required: ['optionValueId', 'quantity'],
            additionalProperties: false,
          },
        },
        campaignTag: { type: 'string', description: 'Etiqueta de campaña devuelta por el catálogo.' },
        format: { type: 'string', description: 'Formato/gramaje elegido por el cliente.' },
        variety: { type: 'string', description: 'Variedad/sabor elegido por el cliente.' },
      },
      required: ['productId', 'quantity'],
      additionalProperties: false,
    },
  },
  cart_remove: {
    name: 'cart_remove',
    description: 'Quita unidades de una línea del carrito. Puedes precisar formato o variedad si el mismo producto aparece en varias líneas.',
    inputSchema: {
      type: 'object',
      properties: {
        productId: { type: 'string' },
        quantity: { type: 'integer', minimum: 1, maximum: 20 },
        format: { type: 'string' },
        variety: { type: 'string' },
      },
      required: ['productId'],
      additionalProperties: false,
    },
  },
  cart_clear: {
    name: 'cart_clear',
    description: 'Vacía el carrito conversacional. Es reversible mientras el pedido no se haya creado.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  shipping_quote: {
    name: 'shipping_quote',
    description: 'Consulta zonas y costo de despacho. Si conoces la comuna, envíala para buscar coincidencias.',
    inputSchema: {
      type: 'object',
      properties: { comuna: { type: 'string' } },
      additionalProperties: false,
    },
  },
  checkout_update: {
    name: 'checkout_update',
    description: 'Guarda datos necesarios para finalizar el carrito: nombre, dirección, comuna, teléfono, email, zona, fecha de despacho y forma de pago. deliveryDate debe ser YYYY-MM-DD y será validada contra las fechas reales disponibles.',
    inputSchema: {
      type: 'object',
      properties: {
        nombre: { type: 'string' },
        direccion: { type: 'string' },
        comuna: { type: 'string' },
        phone: { type: 'string' },
        email: { type: 'string' },
        zonaId: { type: 'string' },
        deliveryDate: { type: 'string', description: 'Fecha de despacho elegida por el cliente en formato YYYY-MM-DD.' },
        paymentMethod: { type: 'string', enum: ['mercadopago', 'flow', 'whatsapp'] },
      },
      additionalProperties: false,
    },
  },
  checkout_status: {
    name: 'checkout_status',
    description: 'Revisa qué datos faltan para convertir el carrito en pedido.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  order_create: {
    name: 'order_create',
    description: 'Crea el pedido real y descuenta stock. Úsala SOLO cuando el cliente haya confirmado explícitamente que quiere finalizar/comprar.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  order_status: {
    name: 'order_status',
    description: 'Consulta los pedidos reales del cliente o un pedido concreto.',
    inputSchema: {
      type: 'object',
      properties: { orderId: { type: 'string' } },
      additionalProperties: false,
    },
  },
  payment_link: {
    name: 'payment_link',
    description: 'Genera o regenera un link de pago para un pedido ya creado del mismo cliente.',
    inputSchema: {
      type: 'object',
      properties: {
        orderId: { type: 'string' },
        provider: { type: 'string', enum: ['mercadopago', 'flow'] },
      },
      required: ['orderId'],
      additionalProperties: false,
    },
  },
};

function cartIdentifier(context: RemyToolContext) {
  return String(context.externalUserId || context.customerId || context.conversationId || '').trim();
}

async function getCart(db: SupabaseClient, context: RemyToolContext): Promise<CartRow | null> {
  if (context.conversationId) {
    const { data, error } = await db.from('carritos_abandonados')
      .select('id,identificador,items,subtotal,metadata,recuperado,order_id')
      .eq('business_unit_id', context.businessUnitId)
      .eq('conversation_id', context.conversationId)
      .eq('recuperado', false)
      .order('last_activity_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (data) return data as CartRow;
  }

  const identifier = cartIdentifier(context);
  if (!identifier) return null;
  const { data, error } = await db.from('carritos_abandonados')
    .select('id,identificador,items,subtotal,metadata,recuperado,order_id')
    .eq('business_unit_id', context.businessUnitId)
    .eq('identificador', identifier)
    .eq('recuperado', false)
    .order('last_activity_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as CartRow | null;
}

async function saveCart(
  db: SupabaseClient,
  context: RemyToolContext,
  input: { items: ItemCarrito[]; metadata?: Record<string, unknown>; existing?: CartRow | null },
): Promise<CartRow> {
  const identifier = cartIdentifier(context);
  if (!identifier) throw new Error('cart_identity_missing');
  const subtotal = input.items.reduce((sum, item) => sum + Number(item.precio || 0) * Number(item.qty || 0), 0);
  const now = new Date().toISOString();
  const payload = {
    business_unit_id: context.businessUnitId,
    conversation_id: context.conversationId || null,
    customer_id: context.customerId || null,
    source_channel: context.channel,
    identificador: identifier,
    telefono: context.channel === 'whatsapp' ? identifier : null,
    items: input.items,
    subtotal,
    metadata: input.metadata || input.existing?.metadata || {},
    recuperado: false,
    contactado: false,
    last_activity_at: now,
  };

  if (input.existing?.id) {
    const { data, error } = await db.from('carritos_abandonados').update(payload).eq('id', input.existing.id)
      .select('id,identificador,items,subtotal,metadata,recuperado,order_id').single();
    if (error) throw error;
    return data as CartRow;
  }
  const { data, error } = await db.from('carritos_abandonados').insert(payload)
    .select('id,identificador,items,subtotal,metadata,recuperado,order_id').single();
  if (error) throw error;
  return data as CartRow;
}

function cartSummary(cart: CartRow | null) {
  if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) return { empty: true, items: [], subtotal: 0 };
  return {
    empty: false,
    items: cart.items.map((item) => ({ productId: item.productoId, name: item.nombre, qty: item.qty, unitPrice: item.precio, format: item.formato || null, variety: item.variedad || null })),
    subtotal: Number(cart.subtotal || 0),
  };
}

async function searchCatalog(db: SupabaseClient, context: RemyToolContext, query: string) {
  const { searchCatalogMaster } = await import('@/lib/catalog/remy-catalog');
  return searchCatalogMaster(db, context.businessUnitId, query, context.channel);
}

async function addToCart(
  db: SupabaseClient,
  context: RemyToolContext,
  productId: string,
  quantity: number,
  format?: string,
  variety?: string,
  variantId?: string,
  selections?: Array<{ optionValueId: string; quantity: number }>,
  campaignTag?: string,
) {
  const qty = Math.max(1, Math.min(20, Math.trunc(Number(quantity || 1))));

  if (variantId) {
    const [{ CatalogRepository }, { buildRemyCartAddition }, { catalogCartItemKey }] = await Promise.all([
      import('@/lib/catalog/catalog-repository'),
      import('@/lib/catalog/remy-catalog'),
      import('@/lib/catalog/catalog-cart'),
    ]);
    const normalizedProduct = await new CatalogRepository(db).getById(context.businessUnitId, productId);
    if (!normalizedProduct) throw new Error('product_not_found');
    const addition = buildRemyCartAddition(normalizedProduct, {
      productId,
      variantId,
      quantity: qty,
      selections,
      campaignTag,
    });
    if (!addition.ok) return { ok: false, reason: addition.error };

    const cart = await getCart(db, context);
    const items = Array.isArray(cart?.items) ? [...cart.items] : [];
    const key = catalogCartItemKey(addition.item);
    const index = items.findIndex((item) => catalogCartItemKey(item) === key);
    if (index >= 0) items[index] = { ...addition.item, qty: Number(items[index].qty || 0) + qty };
    else items.push(addition.item);
    const saved = await saveCart(db, context, { items, existing: cart });
    return { ok: true, ...cartSummary(saved) };
  }

  const { data: product, error } = await db.from('productos')
    .select('id,nombre,precio,emoji,maneja_stock,stock,gramaje,variedades')
    .eq('id', productId)
    .eq('business_unit_id', context.businessUnitId)
    .eq('activo', true)
    .maybeSingle();
  if (error) throw error;
  if (!product) throw new Error('product_not_found');

  const formats = parseFormatos(product.gramaje, Number(product.precio || 0)).filter((entry) => entry.label);
  const varieties = parseVariedades(product.variedades);
  const requestedFormat = String(format || '').trim();
  const requestedVariety = String(variety || '').trim();

  if (formats.length > 1 && !requestedFormat) {
    return { ok: false, reason: 'format_selection_required', formats: formats.map((entry) => ({ name: entry.label, price: entry.precio })) };
  }
  if (varieties.length > 1 && !requestedVariety) {
    return { ok: false, reason: 'variety_selection_required', varieties };
  }

  const selectedFormat = requestedFormat
    ? formats.find((entry) => entry.label.toLowerCase() === requestedFormat.toLowerCase())
    : formats.length === 1 ? formats[0] : null;
  if (requestedFormat && !selectedFormat) {
    return { ok: false, reason: 'invalid_format', formats: formats.map((entry) => ({ name: entry.label, price: entry.precio })) };
  }
  const selectedVariety = requestedVariety
    ? varieties.find((entry) => entry.toLowerCase() === requestedVariety.toLowerCase())
    : varieties.length === 1 ? varieties[0] : null;
  if (requestedVariety && !selectedVariety) return { ok: false, reason: 'invalid_variety', varieties };

  const unitPrice = Number(selectedFormat?.precio ?? product.precio ?? 0);
  const cart = await getCart(db, context);
  const items = Array.isArray(cart?.items) ? [...cart!.items] : [];
  const index = items.findIndex((item) =>
    item.productoId === product.id
    && String(item.formato || '') === String(selectedFormat?.label || '')
    && String(item.variedad || '') === String(selectedVariety || '')
  );
  const currentQty = index >= 0 ? Number(items[index].qty || 0) : 0;
  const requestedTotal = currentQty + qty;
  const totalProductQty = items.filter((item) => item.productoId === product.id).reduce((sum, item) => sum + Number(item.qty || 0), 0) + qty;
  if (product.maneja_stock && totalProductQty > Number(product.stock || 0)) {
    return { ok: false, reason: 'insufficient_stock', available: Number(product.stock || 0), requested: totalProductQty };
  }

  if (index >= 0) items[index] = { ...items[index], qty: requestedTotal, precio: unitPrice, nombre: product.nombre };
  else items.push({
    productoId: product.id,
    nombre: product.nombre,
    precio: unitPrice,
    qty,
    emoji: product.emoji || '🌱',
    formato: selectedFormat?.label || null,
    variedad: selectedVariety || null,
  });
  const saved = await saveCart(db, context, { items, existing: cart });
  return { ok: true, ...cartSummary(saved) };
}

async function removeFromCart(
  db: SupabaseClient,
  context: RemyToolContext,
  productId: string,
  quantity?: number,
  format?: string,
  variety?: string,
) {
  const cart = await getCart(db, context);
  if (!cart) return cartSummary(null);
  const items = [...(cart.items || [])];
  const matching = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.productoId === productId)
    .filter(({ item }) => !format || String(item.formato || '').toLowerCase() === String(format).toLowerCase())
    .filter(({ item }) => !variety || String(item.variedad || '').toLowerCase() === String(variety).toLowerCase());
  if (!matching.length) return { ok: false, reason: 'product_not_in_cart', ...cartSummary(cart) };
  if (matching.length > 1 && !format && !variety) {
    return { ok: false, reason: 'cart_line_selection_required', lines: matching.map(({ item }) => ({ format: item.formato || null, variety: item.variedad || null, qty: item.qty })) };
  }
  const index = matching[0].index;
  if (!quantity || Number(quantity) >= Number(items[index].qty || 0)) items.splice(index, 1);
  else items[index] = { ...items[index], qty: Number(items[index].qty || 0) - Math.max(1, Math.trunc(Number(quantity))) };
  const saved = await saveCart(db, context, { items, existing: cart });
  return { ok: true, ...cartSummary(saved) };
}

async function clearCart(db: SupabaseClient, context: RemyToolContext) {
  const cart = await getCart(db, context);
  if (!cart) return { ok: true, ...cartSummary(null) };
  const saved = await saveCart(db, context, { items: [], existing: cart });
  return { ok: true, ...cartSummary(saved) };
}

async function shippingQuote(db: SupabaseClient, comuna?: string) {
  let request = db.from('zonas').select('id,nombre,comunas,precio').order('precio');
  const clean = String(comuna || '').trim().replace(/[,%_()]/g, '');
  if (clean) request = request.or(`nombre.ilike.%${clean}%,comunas.ilike.%${clean}%`);
  const { data, error } = await request.limit(8);
  if (error) throw error;
  return { zones: (data || []).map((zone: any) => ({ id: zone.id, name: zone.nombre, comunas: zone.comunas, price: Number(zone.precio || 0) })) };
}

function parseAvailability(value: unknown) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item));
}

function ymd(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function availableDeliveryDates(db: SupabaseClient, context: RemyToolContext, cart: CartRow) {
  const productIds = Array.from(new Set((cart.items || []).map((item) => String(item.productoId || '')).filter(Boolean)));
  let products: Array<{ disponibilidad: string[] | null }> = [];
  if (productIds.length) {
    const { data, error } = await db.from('productos')
      .select('disponibilidad')
      .eq('business_unit_id', context.businessUnitId)
      .in('id', productIds);
    if (error) throw error;
    products = (data || []).map((row: any) => ({ disponibilidad: parseAvailability(row.disponibilidad) }));
  }

  const today = new Date().toISOString().slice(0, 10);
  const { data: blocked, error: blockedError } = await db.from('blocked_delivery_dates')
    .select('date')
    .eq('business_unit_id', context.businessUnitId)
    .gte('date', today)
    .order('date')
    .limit(60);
  if (blockedError) throw blockedError;
  const blockedDates = new Set((blocked || []).map((row: any) => String(row.date)));

  return genFechas(products)
    .filter((entry) => entry.ok)
    .map((entry) => ymd(entry.fecha))
    .filter((date) => !blockedDates.has(date));
}

async function updateCheckout(db: SupabaseClient, context: RemyToolContext, args: Record<string, unknown>) {
  const cart = await getCart(db, context);
  const existing = cart || await saveCart(db, context, { items: [] });
  const current = existing.metadata && typeof existing.metadata === 'object' ? existing.metadata : {};
  const allowed = ['nombre', 'direccion', 'comuna', 'phone', 'email', 'zonaId', 'deliveryDate', 'paymentMethod'];
  const incoming = Object.fromEntries(Object.entries(args).filter(([key, value]) => allowed.includes(key) && typeof value === 'string' && value.trim()));

  if (incoming.deliveryDate) {
    const requestedDate = String(incoming.deliveryDate).trim();
    const availableDates = await availableDeliveryDates(db, context, existing);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate) || !availableDates.includes(requestedDate)) {
      return { ok: false, reason: 'invalid_delivery_date', availableDates: availableDates.slice(0, 8) };
    }
  }

  const metadata = { ...current, ...incoming };
  const saved = await saveCart(db, context, { items: existing.items || [], metadata, existing });

  if (context.customerId) {
    const patch: Record<string, unknown> = {};
    if (incoming.nombre) patch.nombre = incoming.nombre;
    if (incoming.email) patch.email = String(incoming.email).trim().toLowerCase();
    if (incoming.direccion) patch.direccion = incoming.direccion;
    if (incoming.phone) patch.phone = String(incoming.phone).trim();
    if (context.channel === 'whatsapp' && context.externalUserId) patch.phone = context.externalUserId;
    if (Object.keys(patch).length) {
      await db.from('omnichannel_contacts').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', context.customerId);
    }
  }
  return checkoutStatusFromCart(saved, context);
}

function checkoutStatusFromCart(cart: CartRow | null, context: RemyToolContext) {
  const metadata = cart?.metadata && typeof cart.metadata === 'object' ? cart.metadata : {};
  const missing: string[] = [];
  if (!cart?.items?.length) missing.push('productos');
  if (!String(metadata.nombre || '').trim()) missing.push('nombre');
  if (!String(metadata.direccion || '').trim()) missing.push('direccion');
  if (!String(metadata.comuna || '').trim()) missing.push('comuna');
  if (context.channel !== 'whatsapp' && !String(metadata.phone || '').trim()) missing.push('phone');
  if (!String(metadata.zonaId || '').trim()) missing.push('zonaId');
  if (!String(metadata.deliveryDate || '').trim()) missing.push('deliveryDate');
  if (!String(metadata.paymentMethod || '').trim()) missing.push('paymentMethod');
  if (String(metadata.paymentMethod || '') === 'flow' && !String(metadata.email || '').trim()) missing.push('email');
  return {
    ready: missing.length === 0,
    missing,
    cart: cartSummary(cart),
    checkout: {
      nombre: metadata.nombre || null,
      direccion: metadata.direccion || null,
      comuna: metadata.comuna || null,
      phone: context.channel === 'whatsapp' ? context.externalUserId || null : metadata.phone || null,
      email: metadata.email || null,
      zonaId: metadata.zonaId || null,
      deliveryDate: metadata.deliveryDate || null,
      paymentMethod: metadata.paymentMethod || null,
    },
  };
}

async function createOrder(db: SupabaseClient, context: RemyToolContext) {
  if (!hasExplicitOrderConfirmation(context)) throw new Error('explicit_order_confirmation_required');
  const cart = await getCart(db, context);
  const status = checkoutStatusFromCart(cart, context);
  if (!status.ready || !cart) return { ok: false, reason: 'checkout_incomplete', ...status };

  const metadata = cart.metadata || {};
  const phone = context.channel === 'whatsapp'
    ? cartIdentifier(context)
    : String(metadata.phone || '').trim();
  if (!phone) return { ok: false, reason: 'phone_missing' };

  // Revalidamos la fecha al crear el pedido por si cambió una restricción desde que
  // el cliente la eligió. Nunca se crea un pedido con una fecha ya inválida.
  const deliveryDate = String(metadata.deliveryDate || '').trim();
  const availableDates = await availableDeliveryDates(db, context, cart);
  if (!availableDates.includes(deliveryDate)) {
    return { ok: false, reason: 'delivery_date_no_longer_available', availableDates: availableDates.slice(0, 8) };
  }

  const request: CheckoutRequest = {
    idempotencyKey: `remy:${cart.id}`,
    cliente: {
      nombre: String(metadata.nombre || '').trim(),
      direccion: String(metadata.direccion || '').trim(),
      telefono: phone,
      email: String(metadata.email || '').trim(),
    },
    items: (cart.items || []).map((item) => ({
      productoId: item.productoId,
      variantId: item.variantId,
      qty: item.qty,
      formato: item.formato || null,
      variedad: item.variedad || null,
      selections: item.selections?.map(({ optionValueId, quantity }) => ({ optionValueId, quantity })),
      campaignTag: item.campaignTag,
      notas: item.notas || null,
    })),
    zonaId: String(metadata.zonaId || '') || null,
    cuponCode: null,
    metodoPago: String(metadata.paymentMethod || 'whatsapp') as CheckoutRequest['metodoPago'],
    attribution: { utm_source: context.channel, utm_medium: 'remy_conversation' },
  };

  const calculation = await calcularPedido(request, context.businessUnitId);
  if (!calculation.ok) return { ok: false, reason: 'checkout_validation_failed', detail: calculation.error };

  const capabilities = getSchemaCapabilities();
  const customerRepository = new CustomerRepository(db, capabilities);
  const customer = await customerRepository.upsertCheckoutContact(context.businessUnitId, {
    email: request.cliente.email,
    phone: request.cliente.telefono,
    nombre: request.cliente.nombre,
    direccion: request.cliente.direccion,
  });
  const total = Math.max(0, Number(calculation.subtotal || 0) + Number(calculation.costoEnvio || 0) - Number(calculation.descuentoCupon || 0));
  const order = await new OrderRepository(db, capabilities).createTransactionalCheckout({
    idempotencyKey: `remy:${cart.id}`,
    businessUnitId: context.businessUnitId,
    customerId: customer.id,
    customerEmail: request.cliente.email || null,
    customerName: request.cliente.nombre,
    customerPhone: request.cliente.telefono,
    address: request.cliente.direccion,
    comuna: String(metadata.comuna || '') || null,
    items: calculation.itemsResueltos || [],
    total,
    paymentMethod: request.metodoPago,
    shippingCost: Number(calculation.costoEnvio || 0),
    shippingZoneId: request.zonaId,
    shippingZoneName: calculation.zonaNombre || null,
    loyaltyDiscount: 0,
    loyaltyPointsRedeemed: 0,
    discountTotal: Number(calculation.descuentoCupon || 0),
    stockItems: calculation.itemsResueltos || [],
    attribution: request.attribution || {},
  });

  await Promise.all([
    db.from('pedidos').update({ source_channel: context.channel, fecha_entrega: deliveryDate }).eq('id', order.numeric_id),
    db.from('conversion_events').update({ source_channel: context.channel }).eq('order_id', order.numeric_id),
    db.from('carritos_abandonados').update({ recuperado: true, order_id: order.numeric_id }).eq('id', cart.id),
    context.conversationId ? db.from('conversations').update({ order_id: order.numeric_id, updated_at: new Date().toISOString() }).eq('id', context.conversationId) : Promise.resolve(),
  ]);

  let paymentUrl: string | null = null;
  let paymentError: string | null = null;
  if (request.metodoPago === 'mercadopago' || request.metodoPago === 'flow') {
    try {
      const link = await createPaymentLink(db, { pedidoId: order.numeric_id, provider: request.metodoPago as PaymentProvider });
      paymentUrl = link.url;
    } catch (error) {
      paymentError = error instanceof Error ? error.message : 'payment_link_failed';
    }
  }

  return {
    ok: true,
    orderId: String(order.numeric_id),
    total,
    paymentMethod: request.metodoPago,
    deliveryDate,
    paymentUrl,
    paymentError,
    trackingUrl: `${runtimeSiteUrl()}/pedido/${order.numeric_id}`,
  };
}

async function orderStatus(db: SupabaseClient, context: RemyToolContext, orderId?: string) {
  if (!context.customerId) return { found: false, orders: [] };
  const repo = new OrderRepository(db, getSchemaCapabilities());
  if (orderId) {
    const order = await repo.getById(orderId);
    if (!order || !order.customer_id || order.customer_id !== context.customerId) return { found: false };
    return { found: true, orders: [{ id: order.id, status: order.status, paymentStatus: order.payment_status, total: order.total, trackingNumber: order.tracking_number, deliveryDate: order.delivery_date }] };
  }
  const orders = await repo.list({ customerId: context.customerId, limit: 5 });
  return { found: orders.length > 0, orders: orders.map((order) => ({ id: order.id, status: order.status, paymentStatus: order.payment_status, total: order.total, trackingNumber: order.tracking_number, deliveryDate: order.delivery_date })) };
}

async function paymentLinkForCustomer(
  db: SupabaseClient,
  context: RemyToolContext,
  orderId: string,
  provider: PaymentProvider,
) {
  if (!context.customerId) return { ok: false, reason: 'customer_identity_required' };
  const order = await new OrderRepository(db, getSchemaCapabilities()).getById(orderId);
  if (!order || !order.customer_id || order.customer_id !== context.customerId) return { ok: false, reason: 'order_not_found' };
  const link = await createPaymentLink(db, { pedidoId: orderId, provider });
  return { ok: true, provider, paymentUrl: link.url };
}

export async function executeRemyTool(
  db: SupabaseClient,
  context: RemyToolContext,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  if (name === 'catalog_search') return searchCatalog(db, context, String(args.query || context.userText));
  if (name === 'cart_get') return cartSummary(await getCart(db, context));
  if (name === 'cart_add') return addToCart(
    db,
    context,
    String(args.productId || ''),
    Number(args.quantity || 1),
    args.format ? String(args.format) : undefined,
    args.variety ? String(args.variety) : undefined,
    args.variantId ? String(args.variantId) : undefined,
    Array.isArray(args.selections) ? args.selections.map((selection: any) => ({
      optionValueId: String(selection.optionValueId || ''),
      quantity: Number(selection.quantity || 0),
    })) : undefined,
    args.campaignTag ? String(args.campaignTag) : undefined,
  );
  if (name === 'cart_remove') return removeFromCart(
    db,
    context,
    String(args.productId || ''),
    args.quantity === undefined ? undefined : Number(args.quantity),
    args.format ? String(args.format) : undefined,
    args.variety ? String(args.variety) : undefined,
  );
  if (name === 'cart_clear') return clearCart(db, context);
  if (name === 'shipping_quote') return shippingQuote(db, args.comuna ? String(args.comuna) : undefined);
  if (name === 'checkout_update') return updateCheckout(db, context, args);
  if (name === 'checkout_status') return checkoutStatusFromCart(await getCart(db, context), context);
  if (name === 'order_create') return createOrder(db, context);
  if (name === 'order_status') return orderStatus(db, context, args.orderId ? String(args.orderId) : undefined);
  if (name === 'payment_link') {
    const provider: PaymentProvider = args.provider === 'flow' ? 'flow' : 'mercadopago';
    return paymentLinkForCustomer(db, context, String(args.orderId || ''), provider);
  }
  throw new Error(`unknown_remy_tool:${name}`);
}
