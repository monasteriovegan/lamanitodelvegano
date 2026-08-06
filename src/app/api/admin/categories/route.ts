import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { getCurrentAdminUser } from '@/lib/supabase/server-auth';

export async function GET() {
  const admin = await getCurrentAdminUser();
  if (!admin || !['admin', 'soporte', 'bodega'].includes(admin.rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const db = createSupabaseServiceClient();
  const { data, error } = await db.from('categorias').select('*').order('orden');
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  
  // Map back to Makangru structure so client pages can consume it
  const mapped = (data || []).map(c => ({
    id: c.id,
    name: c.nombre,
    slug: c.slug,
    description: c.descripcion,
    image_url: c.imagenUrl,
    icon: c.icono,
    is_active: c.activo !== undefined ? c.activo : true,
    sort_order: c.orden || 0,
    created_at: c.created_at,
  }));

  return NextResponse.json({ data: mapped });
}

export async function POST(req: Request) {
  const admin = await getCurrentAdminUser();
  if (!admin || !['admin'].includes(admin.rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const db = createSupabaseServiceClient();
  const body = await req.json();

  const payload = {
    nombre: body.name || body.nombre,
    slug: body.slug,
    descripcion: body.description || body.descripcion || '',
    imagenUrl: body.image_url || body.imagenUrl || '',
    icono: body.icon || body.icono || '',
    activo: body.is_active !== undefined ? body.is_active : (body.activo !== undefined ? body.activo : true),
    orden: Number(body.sort_order !== undefined ? body.sort_order : (body.orden !== undefined ? body.orden : 0)),
  };

  const { data, error } = await db.from('categorias').insert(payload).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data }, { status: 201 });
}
