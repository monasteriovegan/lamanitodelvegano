import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { createPaymentLink } from '@/lib/payments/payment-link';

/**
 * Crea una preferencia usando únicamente un pedido real ya validado.
 * El monto y los items se leen server-side desde la base canónica.
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
    return NextResponse.json({ init_point: result.url });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'mercadopago_link_failed';
    console.error('mercadopago_link_failed', { detail });
    if (detail === 'order_not_found') return NextResponse.json({ error: 'Pedido no encontrado.' }, { status: 404 });
    if (detail === 'mercadopago_not_configured') return NextResponse.json({ error: 'Mercado Pago no está configurado.' }, { status: 500 });
    return NextResponse.json({ error: 'Error al crear la preferencia de pago.' }, { status: 502 });
  }
}
