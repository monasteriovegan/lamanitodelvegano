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
    .from('delivery_settings')
    .select('*')
    .eq('business_id', businessId)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}

export async function PUT(req: Request) {
  const admin = await getCurrentAdminUser();
  if (!admin || !['admin'].includes(admin.rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const db = createSupabaseServiceClient();
  const businessId = await getBusinessId(db);
  if (!businessId) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 });

  const body = await req.json();
  const { data: ex } = await db
    .from('delivery_settings')
    .select('id')
    .eq('business_id', businessId)
    .maybeSingle();

  const payload = {
    ...body,
    business_id: businessId,
    updated_at: new Date().toISOString(),
  };

  const result = ex
    ? await db.from('delivery_settings').update(payload).eq('id', ex.id).select().single()
    : await db.from('delivery_settings').insert(payload).select().single();

  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 });
  return NextResponse.json({ data: result.data });
}
