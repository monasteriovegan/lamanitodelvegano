import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { createPaymentLink } from '@/lib/payments/payment-link';

/**
 * Crea o reutiliza una preferencia usando únicamente un pedido real ya
 * validado. El monto se lee server-side desde la base canónica.
 */
export async function POST(req: NextRequest) {
  const { pedidoId } = await req.json().catch(() => ({}));
  if (!pedidoId) return NextResponse.json({ error: 'Falta pedidoId.' }, { status: 400 });

  try {
    const db = createSupabaseServiceClient();
    const result = await createPaymentLink(db, {
      pedidoId,
      provider: 'mercadopago',
      origin: req.headers.get('origin'),
    });
    return NextResponse.json({ init_point: result.url, reused: Boolean(result.reused) });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'mercadopago_link_failed';
    console.error('mercadopago_link_failed', { detail });
    if (detail === 'order_not_found') return NextResponse.json({ error: 'Pedido no encontrado.' }, { status: 404 });
    if (detail === 'payment_already_paid') return NextResponse.json({ error: 'Este pedido ya está pagado.' }, { status: 409 });
    if (detail === 'payment_method_mismatch') return NextResponse.json({ error: 'El pedido no usa Mercado Pago.' }, { status: 409 });
    if (detail === 'mercadopago_not_configured') return NextResponse.json({ error: 'Mercado Pago no está configurado.' }, { status: 503 });
    return NextResponse.json({ error: 'Error al crear la preferencia de pago.' }, { status: 502 });
  }
}
