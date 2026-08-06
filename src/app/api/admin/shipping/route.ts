import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { getCurrentAdminUser } from '@/lib/supabase/server-auth';

export async function GET() {
  const admin = await getCurrentAdminUser();
  if (!admin || !['admin'].includes(admin.rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const db = createSupabaseServiceClient();
  const { data, error } = await db.from('zonas').select('*').order('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data: data || [] });
}

export async function POST(req: Request) {
  const admin = await getCurrentAdminUser();
  if (!admin || !['admin'].includes(admin.rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const db = createSupabaseServiceClient();
  const body = await req.json();

  // Map Makangru structure to La Manito's 'zonas'
  const payload = {
    nombre: body.name || body.nombre,
    comunas: Array.isArray(body.regions) ? body.regions.join(', ') : (body.comunas || ''),
    precio: Number(body.price !== undefined ? body.price : (body.precio !== undefined ? body.precio : 0)),
  };

  const { data, error } = await db.from('zonas').insert(payload).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data }, { status: 201 });
}
