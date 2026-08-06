import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { getCurrentAdminUser } from '@/lib/supabase/server-auth';

export async function GET() {
  const admin = await getCurrentAdminUser();
  if (!admin || !['admin', 'soporte'].includes(admin.rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const db = createSupabaseServiceClient();
  const { data, error } = await db.from('cupones').select('*').order('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data: data || [] });
}

export async function POST(req: Request) {
  const admin = await getCurrentAdminUser();
  if (!admin || !['admin', 'soporte'].includes(admin.rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const db = createSupabaseServiceClient();
  const body = await req.json();
  
  // Adapt field names from Makangru (snake_case) to La Manito (camelCase/spanish)
  const payload = {
    id: body.code?.toUpperCase().trim(),
    code: body.code?.toUpperCase().trim(),
    tipo: body.type || body.tipo || 'percentage',
    valor: String(body.value || body.valor || 0),
    minMonto: Number(body.min_order_amount || body.minMonto || 0),
    activo: body.is_active !== undefined ? body.is_active : (body.activo !== undefined ? body.activo : true),
  };

  const { data, error } = await db.from('cupones').insert(payload).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data }, { status: 201 });
}
