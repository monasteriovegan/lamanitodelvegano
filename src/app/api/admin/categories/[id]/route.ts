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
  if (body.slug !== undefined) payload.slug = body.slug;
  if (body.description !== undefined || body.descripcion !== undefined) payload.descripcion = body.description || body.descripcion;
  if (body.image_url !== undefined || body.imagenUrl !== undefined) payload.imagenUrl = body.image_url || body.imagenUrl;
  if (body.icon !== undefined || body.icono !== undefined) payload.icono = body.icon || body.icono;
  if (body.is_active !== undefined || body.activo !== undefined) payload.activo = body.is_active !== undefined ? body.is_active : body.activo;
  if (body.sort_order !== undefined || body.orden !== undefined) payload.orden = Number(body.sort_order !== undefined ? body.sort_order : body.orden);

  const { data, error } = await db.from('categorias').update(payload).eq('id', id).select().single();
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

  const { error } = await db.from('categorias').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
