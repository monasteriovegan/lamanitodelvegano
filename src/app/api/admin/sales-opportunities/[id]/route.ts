import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { getCurrentAdminUser } from '@/lib/supabase/server-auth';

interface RouteParams { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: RouteParams) {
  const admin = await getCurrentAdminUser();
  if (!admin || admin.rol !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const action = String(body?.action || '');
  const db = createSupabaseServiceClient();
  const now = new Date().toISOString();

  let patch: Record<string, unknown>;
  if (action === 'dismiss') {
    patch = { status: 'dismissed', dismissed_at: now, dismissal_reason: 'manual_admin', next_followup_at: null, claim_token: null, claim_expires_at: null };
  } else if (action === 'snooze') {
    const until = String(body?.until || '');
    if (!until || !Number.isFinite(new Date(until).getTime()) || new Date(until) <= new Date()) {
      return NextResponse.json({ error: 'Fecha de recordatorio inválida.' }, { status: 400 });
    }
    patch = { status: 'snoozed', snoozed_until: new Date(until).toISOString(), next_followup_at: new Date(until).toISOString(), claim_token: null, claim_expires_at: null };
  } else if (action === 'update_message') {
    const message = String(body?.message || '').trim();
    if (!message || message.length > 1500) return NextResponse.json({ error: 'Mensaje inválido.' }, { status: 400 });
    patch = { recommended_message: message };
  } else {
    return NextResponse.json({ error: 'Acción inválida.' }, { status: 400 });
  }

  const { data, error } = await db.from('sales_opportunities').update(patch).eq('id', id).select('*').maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Oportunidad no encontrada.' }, { status: 404 });
  return NextResponse.json({ opportunity: data });
}
