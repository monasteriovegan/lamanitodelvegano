import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { getCurrentAdminUser } from '@/lib/supabase/server-auth';

async function getBusinessId(db: any) {
  const { data: biz } = await db
    .from('businesses')
    .select('id')
    .eq('slug', 'la-manito-del-vegano')
    .maybeSingle();
  return biz?.id || null;
}

export async function GET() {
  const admin = await getCurrentAdminUser();
  if (!admin || !['admin', 'soporte', 'bodega'].includes(admin.rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const db = createSupabaseServiceClient();
  const businessId = await getBusinessId(db);
  if (!businessId) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 });

  const { data, error } = await db
    .from('blocked_delivery_dates')
    .select('*')
    .eq('business_id', businessId)
    .gte('date', new Date().toISOString().split('T')[0])
    .order('date');

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data: data || [] });
}

export async function POST(req: Request) {
  const admin = await getCurrentAdminUser();
  if (!admin || !['admin'].includes(admin.rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const db = createSupabaseServiceClient();
  const businessId = await getBusinessId(db);
  if (!businessId) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 });

  const body = await req.json();
  const payload = {
    ...body,
    business_id: businessId,
  };

  const { data, error } = await db.from('blocked_delivery_dates').insert(payload).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data }, { status: 201 });
}
