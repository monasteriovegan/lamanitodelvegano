import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { getCurrentAdminUser } from '@/lib/supabase/server-auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PUT(req: Request, { params }: RouteParams) {
  const admin = await getCurrentAdminUser();
  if (!admin || !['admin'].includes(admin.rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await params;
  const db = createSupabaseServiceClient();
  const body = await req.json();

  const payload: any = {};
  if (body.name !== undefined || body.nombre !== undefined) payload.nombre = body.name || body.nombre;
  if (body.regions !== undefined || body.comunas !== undefined) {
    payload.comunas = Array.isArray(body.regions) ? body.regions.join(', ') : body.comunas;
  }
  if (body.price !== undefined || body.precio !== undefined) {
    payload.precio = Number(body.price !== undefined ? body.price : body.precio);
  }

  const { data, error } = await db.from('zonas').update(payload).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

export async function DELETE(_: Request, { params }: RouteParams) {
  const admin = await getCurrentAdminUser();
  if (!admin || !['admin'].includes(admin.rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await params;
  const db = createSupabaseServiceClient();

  const { error } = await db.from('zonas').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
