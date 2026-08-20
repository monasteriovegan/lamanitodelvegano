import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase/require-role';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

export async function GET() {
  await requireRole(['admin']);

  const token = process.env.META_CONVERSIONS_API_ACCESS_TOKEN?.trim();
  const db = createSupabaseServiceClient();
  const { data: config } = await db
    .from('integraciones_secretas')
    .select('meta_pixel_id')
    .eq('id', 'global')
    .maybeSingle();
  const datasetId = String(config?.meta_pixel_id || '').trim();

  if (!token || !datasetId) {
    return NextResponse.json({
      configured: Boolean(token),
      datasetId: datasetId || null,
      authorized: false,
      reason: !token ? 'token_not_configured' : 'dataset_not_configured',
    });
  }

  const version = process.env.META_GRAPH_VERSION || 'v26.0';
  try {
    // Un lote vacío no crea eventos. El código de error permite distinguir una
    // validación de payload (token aceptado) de un rechazo de autenticación.
    const response = await fetch(`https://graph.facebook.com/${version}/${datasetId}/events`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [] }),
      cache: 'no-store',
    });
    const body = await response.json().catch(() => ({})) as { error?: { code?: number; type?: string } };
    const authRejected = response.status === 401 || response.status === 403 || body.error?.code === 190;

    return NextResponse.json({
      configured: true,
      datasetId,
      authorized: !authRejected,
      metaStatus: response.status,
      metaErrorCode: body.error?.code || null,
      metaErrorType: body.error?.type || null,
      eventSent: false,
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({
      configured: true,
      datasetId,
      authorized: false,
      reason: 'meta_unreachable',
      eventSent: false,
    }, { status: 502, headers: { 'Cache-Control': 'private, no-store' } });
  }
}

export const dynamic = 'force-dynamic';
