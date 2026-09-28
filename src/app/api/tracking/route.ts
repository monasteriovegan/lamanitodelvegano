import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import {
  fingerprintTrackingClient,
  parsePublicTrackingId,
  toPublicTrackingResponse,
} from '@/lib/tracking/public-tracking';

/**
 * Tracking público de un solo pedido. El tracking_number actúa como un
 * identificador opaco; los IDs internos nunca son aceptados ni devueltos.
 */
export async function GET(req: NextRequest) {
  const rawId = req.nextUrl.searchParams.get('id')?.trim();
  if (!rawId) {
    return NextResponse.json({ error: 'Ingresa el número de seguimiento de tu pedido.' }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();
  const forwardedFor = req.headers.get('x-vercel-forwarded-for')
    || req.headers.get('x-forwarded-for')
    || req.headers.get('x-real-ip');
  const rateLimitKey = fingerprintTrackingClient(
    { forwardedFor, userAgent: req.headers.get('user-agent') },
    String(process.env.SUPABASE_SERVICE_ROLE_KEY || ''),
  );
  const { data: allowed, error: rateLimitError } = await supabase.rpc('consume_public_tracking_rate_limit_v1', {
    p_key_hash: rateLimitKey,
    p_limit: 10,
    p_window_seconds: 60,
  });

  if (rateLimitError) {
    console.error('tracking_rate_limit_failed', { reason: rateLimitError.message });
    return NextResponse.json(
      { error: 'No se pudo procesar la consulta.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  if (!allowed) {
    return NextResponse.json(
      { error: 'No se pudo procesar la consulta.' },
      { status: 429, headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' } },
    );
  }

  const normalizedTracking = parsePublicTrackingId(rawId);
  const notFound = () => NextResponse.json(
    { error: 'No se encontró ningún pedido con ese número de seguimiento.' },
    { status: 404, headers: { 'Cache-Control': 'no-store' } },
  );
  if (!normalizedTracking) return notFound();

  const { data: pedido, error } = await supabase
    .from('pedidos')
    .select('tracking_number,fecha_entrega,estado')
    .eq('tracking_number', normalizedTracking)
    .maybeSingle();

  if (error) {
    console.error('tracking_lookup_failed', { reason: error.message });
    return NextResponse.json(
      { error: 'No se pudo procesar la consulta.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  if (!pedido) return notFound();

  return NextResponse.json(toPublicTrackingResponse(pedido), {
    headers: { 'Cache-Control': 'private, no-store, max-age=0' },
  });
}
