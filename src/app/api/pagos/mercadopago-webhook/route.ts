import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { OrderRepository } from '@/lib/repositories/orders-repository';
import { notifyOrderTransitions } from '@/lib/orders/order-notifications';
import {
  getMercadoPagoPayment,
  mapMercadoPagoPaymentStatus,
  mercadoPagoWebhookSecret,
  resolveMercadoPagoAccessToken,
  validateMercadoPagoWebhookSignature,
} from '@/lib/payments/mercadopago';
import { sendPaidPurchaseToMeta } from '@/lib/meta/conversions-api';

function eventDataId(req: NextRequest, body: any) {
  return String(
    req.nextUrl.searchParams.get('data.id')
    || req.nextUrl.searchParams.get('id')
    || body?.data?.id
    || body?.id
    || '',
  ).trim();
}

function eventType(req: NextRequest, body: any) {
  return String(req.nextUrl.searchParams.get('type') || req.nextUrl.searchParams.get('topic') || body?.type || '').toLowerCase();
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const paymentId = eventDataId(req, body);
  const type = eventType(req, body);

  if (!paymentId || (type && type !== 'payment')) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const secret = mercadoPagoWebhookSecret();
  if (secret && !validateMercadoPagoWebhookSignature({
    signature: req.headers.get('x-signature'),
    requestId: req.headers.get('x-request-id'),
    dataId: paymentId,
    secret,
  })) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }

  const db = createSupabaseServiceClient();
  const token = await resolveMercadoPagoAccessToken(db);
  if (!token) return NextResponse.json({ error: 'mercadopago_not_configured' }, { status: 503 });

  try {
    // La API de Mercado Pago es la fuente de verdad: nunca confiamos en monto/status del webhook.
    const payment = await getMercadoPagoPayment(token, paymentId);
    const pedidoId = Number(payment?.external_reference);
    if (!Number.isInteger(pedidoId) || pedidoId <= 0) return NextResponse.json({ ok: true, ignored: true });

    const { data: pedido, error: orderError } = await db.from('pedidos')
      .select('id,total,currency,metodopago,payment_status,estado')
      .eq('id', pedidoId)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!pedido || String(pedido.metodopago || '').toLowerCase() !== 'mercadopago') {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const expectedAmount = Number(pedido.total || 0);
    const paidAmount = Number(payment?.transaction_amount || 0);
    const expectedCurrency = String(pedido.currency || 'CLP').toUpperCase();
    const paidCurrency = String(payment?.currency_id || '').toUpperCase();
    if (!Number.isFinite(paidAmount) || Math.abs(expectedAmount - paidAmount) > 0.01 || paidCurrency !== expectedCurrency) {
      console.error('mercadopago_payment_mismatch', { pedidoId, paymentId });
      return NextResponse.json({ error: 'payment_mismatch' }, { status: 409 });
    }

    const nextPaymentStatus = mapMercadoPagoPaymentStatus(payment?.status);
    const currentPaymentStatus = String(pedido.payment_status || 'pending');
    // Un intento fallido/pending nunca puede degradar un pedido ya pagado. Un reembolso sí.
    const effectiveStatus = currentPaymentStatus === 'paid' && (nextPaymentStatus === 'pending' || nextPaymentStatus === 'failed')
      ? 'paid'
      : nextPaymentStatus;

    if (effectiveStatus !== currentPaymentStatus) {
      const repo = new OrderRepository(db);
      const beforeOrder = await repo.getById(pedidoId);
      const update: Record<string, any> = {
        payment_status: effectiveStatus,
        updated_at: new Date().toISOString(),
      };
      if (effectiveStatus === 'paid') update.estado = 'Pagado';
      const { error: updateError } = await db.from('pedidos').update(update).eq('id', pedidoId);
      if (updateError) throw updateError;

      await db.from('order_status_history').insert({
        pedido_id: pedidoId,
        old_status: String(pedido.estado || 'Pendiente'),
        new_status: effectiveStatus === 'paid' ? 'Pagado' : String(pedido.estado || 'Pendiente'),
        payment_status: effectiveStatus,
        notes: `Mercado Pago ${String(payment?.status || 'unknown')} · payment ${paymentId}`,
      });

      // El aviso al cliente es best-effort: nunca hacemos fallar el webhook de pago
      // por un problema temporal de WhatsApp o email.
      if (beforeOrder) {
        try {
          const afterOrder = await repo.getById(pedidoId);
          if (afterOrder) await notifyOrderTransitions(db, beforeOrder, afterOrder);
        } catch (notificationError) {
          console.error('mercadopago_customer_notification_failed', {
            pedidoId,
            reason: notificationError instanceof Error ? notificationError.message : 'unknown',
          });
        }
      }

      if (effectiveStatus === 'paid') await sendPaidPurchaseToMeta(db, pedidoId);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('mercadopago_webhook_failed', {
      paymentId,
      detail: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json({ error: 'verification_failed' }, { status: 502 });
  }
}
