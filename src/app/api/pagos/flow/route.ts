import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { createPaymentLink } from '@/lib/payments/payment-link';

export async function POST(req: NextRequest) {
  const { pedidoId } = await req.json().catch(() => ({}));
  if (!pedidoId) return NextResponse.json({ error: 'Falta pedidoId.' }, { status: 400 });

  try {
    const db = createSupabaseServiceClient();
    const result = await createPaymentLink(db, {
      pedidoId,
      provider: 'flow',
      origin: req.headers.get('origin'),
    });
    return NextResponse.json({ url: result.url });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'flow_link_failed';
    console.error('flow_link_failed', { detail });
    if (detail === 'order_not_found') return NextResponse.json({ error: 'Pedido no encontrado.' }, { status: 404 });
    if (detail === 'flow_not_configured') return NextResponse.json({ error: 'Flow no está configurado o activado.' }, { status: 500 });
    return NextResponse.json({ error: 'Error al crear el pago con Flow.' }, { status: 502 });
  }
}
