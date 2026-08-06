import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { getCurrentAdminUser } from '@/lib/supabase/server-auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PUT(req: Request, { params }: RouteParams) {
  const admin = await getCurrentAdminUser();
  if (!admin || !['admin', 'soporte'].includes(admin.rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await params;
  const db = createSupabaseServiceClient();
  const body = await req.json();

  // Adapt fields
  const payload: any = {};
  if (body.type !== undefined || body.tipo !== undefined) payload.tipo = body.type || body.tipo;
  if (body.value !== undefined || body.valor !== undefined) payload.valor = String(body.value || body.valor);
  if (body.min_order_amount !== undefined || body.minMonto !== undefined) payload.minMonto = Number(body.min_order_amount || body.minMonto);
  if (body.is_active !== undefined || body.activo !== undefined) payload.activo = body.is_active !== undefined ? body.is_active : body.activo;

  const { data, error } = await db.from('cupones').update(payload).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

export async function DELETE(_: Request, { params }: RouteParams) {
  const admin = await getCurrentAdminUser();
  if (!admin || !['admin', 'soporte'].includes(admin.rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await params;
  const db = createSupabaseServiceClient();

  const { error } = await db.from('cupones').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
