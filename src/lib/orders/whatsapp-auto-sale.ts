import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { confirmConversationSale, prepareConversationSaleDraft, type ConversationSaleDraft } from '@/lib/orders/conversation-sale';
import { calcularPedido } from '@/lib/pricing/calcular-pedido';
import { OrderRepository } from '@/lib/repositories/orders-repository';
import {
  hasBusinessPaymentConfirmation,
  hasCustomerNewOrderSignal,
  hasCustomerPickupSignal,
  shouldAttemptWhatsappAutoSale,
  type WhatsappMessageRow as MessageRow,
} from '@/lib/orders/whatsapp-auto-sale-signals';

export { shouldAttemptWhatsappAutoSale };

type WhatsappConversationRow = {
  id: string;
  channel: string;
  order_id: number | null;
  labels?: string[] | null;
  business_unit_id: string | null;
  customer_id: string | null;
  contact_id: string | null;
};

export type WhatsappAutoSaleResult = {
  status: 'ignored' | 'pending' | 'already_linked' | 'synced' | 'flagged_for_review';
  orderId?: number;
  missing?: string[];
  paymentStatus?: string | null;
};

async function linkMessagesToOrder(db: SupabaseClient, conversationId: string, orderId: number) {
  const { error } = await db.from('omnichannel_messages')
    .update({ order_id: orderId })
    .eq('conversation_id', conversationId)
    .is('order_id', null);
  if (error) throw error;
}

async function linkConversationToOrder(
  db: SupabaseClient,
  conversation: WhatsappConversationRow,
  orderId: number,
  paymentConfirmed: boolean,
) {
  const labels = Array.from(new Set([
    ...(Array.isArray(conversation.labels) ? conversation.labels.map(String).filter((label) => label !== 'personal') : []),
    'pedido',
    ...(paymentConfirmed ? ['pagado'] : []),
  ]));
  const { error: conversationError } = await db.from('conversations').update({
    order_id: orderId,
    labels,
    updated_at: new Date().toISOString(),
  }).eq('id', conversation.id);
  if (conversationError) throw conversationError;

  const { error: linkError } = await db.from('conversation_orders').upsert({
    conversation_id: conversation.id,
    pedido_id: orderId,
  }, { onConflict: 'conversation_id,pedido_id', ignoreDuplicates: true });
  if (linkError) throw linkError;
  await linkMessagesToOrder(db, conversation.id, orderId);
}

async function flagPossiblePaymentForAdminReview(
  db: SupabaseClient,
  conversation: WhatsappConversationRow,
  messages: MessageRow[],
): Promise<WhatsappAutoSaleResult | null> {
  const orderId = Number(conversation.order_id || 0);
  if (!orderId || !hasBusinessPaymentConfirmation(messages)) return null;
  if (hasCustomerNewOrderSignal(messages)) return null;

  const repo = new OrderRepository(db);
  const before = await repo.getById(orderId);
  if (!before) return null;
  const transfer = String(before.payment_method || '').toLowerCase().includes('transfer');
  if (!transfer) return null;

  if (before.payment_status === 'paid') {
    await linkMessagesToOrder(db, conversation.id, orderId);
    return { status: 'already_linked', orderId, paymentStatus: 'paid' };
  }

  // IMPORTANT: this never sets payment_status to 'paid'. Detecting
  // confirmation-like language in the chat is only a suggestion for the
  // admin to review — the definitive "paid" state requires an explicit
  // admin action (adminConfirmedPayment in conversation-sale.ts, set only
  // from a real click in the admin panel's "Confirmar pedido y
  // transferencia" button).
  const alreadyFlagged = String(before.admin_notes || '').includes('[Posible pago por transferencia detectado');
  if (!alreadyFlagged) {
    const note = [
      before.admin_notes,
      '[Posible pago por transferencia detectado en la conversación de WhatsApp — verificar y confirmar manualmente en el panel.]',
    ].filter(Boolean).join(' ');
    await repo.update(orderId, { admin_notes: note });
  }

  await linkMessagesToOrder(db, conversation.id, orderId);
  const labels = Array.from(new Set([
    ...(Array.isArray(conversation.labels) ? conversation.labels.map(String).filter((label) => label !== 'personal') : []),
    'pedido',
    'pago_por_verificar',
  ]));
  const { error: conversationError } = await db.from('conversations').update({
    labels,
    updated_at: new Date().toISOString(),
  }).eq('id', conversation.id);
  if (conversationError) throw conversationError;

  return {
    status: 'flagged_for_review',
    orderId,
    paymentStatus: before.payment_status || null,
  };
}

async function loadConversationMessages(
  db: SupabaseClient,
  conversationId: string,
  onlyUnlinkedMessages = false,
) {
  let query = db
    .from('omnichannel_messages')
    .select('id,direction,body,message_type,payload,created_at,order_id')
    .eq('conversation_id', conversationId);
  if (onlyUnlinkedMessages) query = query.is('order_id', null);
  const { data, error } = await query
    .order('created_at', { ascending: true })
    .limit(100);
  if (error) throw error;
  return (data || []) as MessageRow[];
}

async function confirmWhatsappPickupSale(
  db: SupabaseClient,
  conversation: WhatsappConversationRow,
  draft: ConversationSaleDraft,
  messages: MessageRow[],
  idempotencyKey: string,
): Promise<WhatsappAutoSaleResult> {
  const allowedPickupMissing = new Set(['direccion', 'comuna', 'zona_despacho']);
  const blockingMissing = (draft.missing || []).filter((item) => !allowedPickupMissing.has(item));
  if (blockingMissing.length) return { status: 'pending', missing: blockingMissing };
  if (!conversation.business_unit_id || !draft.items.length || draft.paymentMethod === 'unknown') {
    return { status: 'pending', missing: ['validacion_pedido'] };
  }
  const customerId = String(conversation.customer_id || conversation.contact_id || '');
  if (!customerId) return { status: 'pending', missing: ['cliente'] };

  const catalogItems = draft.items.filter((item) => !item.isCustom && item.productId);
  if (catalogItems.length !== draft.items.length) {
    return { status: 'pending', missing: ['producto_personalizado_requiere_revision'] };
  }

  const calculation = await calcularPedido({
    cliente: {
      nombre: draft.customerName || 'Cliente',
      direccion: '',
      telefono: draft.phone,
      email: draft.email || '',
    },
    items: catalogItems.map((item) => ({
      productoId: String(item.productId),
      qty: item.quantity,
      formato: item.format,
      variedad: item.variety,
    })),
    zonaId: null,
    cuponCode: null,
    metodoPago: draft.paymentMethod,
    attribution: { utm_source: 'whatsapp', utm_medium: 'whatsapp_conversation_auto' },
  }, conversation.business_unit_id);
  if (!calculation.ok || !calculation.itemsResueltos?.length) {
    return { status: 'pending', missing: ['validacion_pedido'] };
  }

  const total = Number(calculation.total || 0);
  if (draft.transcriptTotal && Math.abs(total - draft.transcriptTotal) > 100) {
    return { status: 'pending', missing: ['total_no_coincide'] };
  }

  // IMPORTANT: never auto-confirm payment from regex detection — same rule
  // as everywhere else in the system. Evidence found here only becomes a
  // note for the admin to review; the definitive "paid" state requires an
  // explicit click on "Confirmar pedido y transferencia" in the panel.
  const possiblePaymentEvidence = draft.paymentMethod === 'transfer'
    && hasBusinessPaymentConfirmation(messages);
  const paymentConfirmed = false;
  const repo = new OrderRepository(db);
  const order = await repo.createConversationOrder({
    idempotencyKey,
    businessUnitId: conversation.business_unit_id,
    customerId,
    conversationId: conversation.id,
    customerEmail: draft.email || null,
    customerName: draft.customerName,
    customerPhone: draft.phone || null,
    address: null,
    comuna: null,
    items: calculation.itemsResueltos,
    stockItems: calculation.itemsResueltos,
    total,
    paymentMethod: draft.paymentMethod,
    paymentConfirmed,
    shippingCost: 0,
    shippingZoneId: null,
    shippingZoneName: 'Retiro acordado por conversación',
    deliveryDate: draft.deliveryDate || null,
    sourceChannel: 'whatsapp',
    adminNotes: `Pedido confirmado desde conversación WhatsApp. Retiro acordado. ${draft.notes || ''}${possiblePaymentEvidence ? ' [Posible pago por transferencia detectado — verificar y confirmar manualmente en el panel.]' : ''}`.trim(),
    attribution: { utm_source: 'whatsapp', utm_medium: 'whatsapp_conversation_auto' },
  });

  await linkConversationToOrder(db, conversation, order.numeric_id, paymentConfirmed);
  return {
    status: 'synced',
    orderId: order.numeric_id,
    paymentStatus: order.payment_status || null,
  };
}

export async function autoRegisterWhatsappConversationSale(
  db: SupabaseClient,
  conversationId: string,
): Promise<WhatsappAutoSaleResult> {
  const { data: conversation, error } = await db
    .from('conversations')
    .select('id,channel,order_id,labels,business_unit_id,customer_id,contact_id')
    .eq('id', conversationId)
    .maybeSingle();
  if (error) throw error;
  if (!conversation || conversation.channel !== 'whatsapp') return { status: 'ignored' };

  const typedConversation = conversation as WhatsappConversationRow;
  const repeatOrder = Boolean(conversation.order_id);
  const onlyUnlinkedMessages = repeatOrder;
  const messages = await loadConversationMessages(db, conversationId, onlyUnlinkedMessages);
  if (repeatOrder && messages.length === 0) {
    return { status: 'already_linked', orderId: Number(conversation.order_id) };
  }

  if (repeatOrder) {
    const paymentFlag = await flagPossiblePaymentForAdminReview(
      db,
      typedConversation,
      messages,
    );
    if (paymentFlag) return paymentFlag;
  }

  const draft = await prepareConversationSaleDraft(db, conversationId, {
    allowExistingOrder: repeatOrder,
    onlyUnlinkedMessages,
  });
  if (!draft.saleDetected) return { status: 'pending', missing: draft.missing };

  const firstCycleMessageId = messages[0]?.id;
  if (repeatOrder && !firstCycleMessageId) {
    return { status: 'already_linked', orderId: Number(conversation.order_id) };
  }
  const idempotencyKey = repeatOrder
    ? `conversation:${conversation.id}:cycle:${firstCycleMessageId}`
    : `conversation:${conversation.id}`;

  if (hasCustomerPickupSignal(messages)) {
    return confirmWhatsappPickupSale(db, typedConversation, draft, messages, idempotencyKey);
  }

  const explicitTranscriptShipping = Boolean(
    draft.transcriptTotal
    && draft.calculated
    && draft.transcriptTotal >= draft.calculated.subtotal,
  );
  const toleratedMissing = new Set<string>();
  if (explicitTranscriptShipping || draft.explicitShippingCost != null) {
    toleratedMissing.add('zona_despacho');
    toleratedMissing.add('total_no_coincide');
  }
  const missing = (draft.missing || []).filter((item) => !toleratedMissing.has(item));
  if (missing.length) {
    return { status: 'pending', missing };
  }

  const businessPaymentConfirmed = draft.paymentMethod === 'transfer'
    && hasBusinessPaymentConfirmation(messages);

  const result = await confirmConversationSale(db, {
    ...draft,
    missing,
    paymentEvidence: businessPaymentConfirmed,
  }, undefined, {
    allowExistingOrder: repeatOrder,
    allowTranscriptShipping: true,
    idempotencyKey,
    linkUnassignedMessages: true,
    attributionMedium: 'whatsapp_conversation_auto',
  });

  if (result.duplicate) {
    return { status: 'already_linked', orderId: Number(result.orderId) };
  }
  return {
    status: 'synced',
    orderId: Number(result.orderId),
    paymentStatus: result.paymentStatus || null,
  };
}
