import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { getCurrentAdminUser } from '@/lib/supabase/server-auth';
import { BusinessRepository } from '@/lib/repositories/business-repository';

async function validateProductIds(db: ReturnType<typeof createSupabaseServiceClient>, businessUnitId: string, productIds: string[]) {
  const unique = [...new Set(productIds.filter(Boolean))];
  if (!unique.length) return true;
  const { data, error } = await db.from('productos')
    .select('id')
    .eq('business_unit_id', businessUnitId)
    .in('id', unique);
  if (error) throw error;
  return (data || []).length === unique.length;
}

export async function GET() {
  const admin = await getCurrentAdminUser();
  if (!admin || !['admin'].includes(admin.rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const db = createSupabaseServiceClient();
  const business = await new BusinessRepository(db).requireDefault();
  const { data, error } = await db
    .from('seasons')
    .select('*, season_products(product_id, products:productos(nombre,images,precio,business_unit_id))')
    .eq('business_unit_id', business.id)
    .order('starts_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

export async function POST(req: Request) {
  const admin = await getCurrentAdminUser();
  if (!admin || !['admin'].includes(admin.rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const db = createSupabaseServiceClient();
  const business = await new BusinessRepository(db).requireDefault();
  const body = await req.json();
  const { product_ids, business_unit_id: _ignored, ...season } = body;
  const productIds = Array.isArray(product_ids) ? product_ids.map(String) : [];

  try {
    if (!(await validateProductIds(db, business.id, productIds))) {
      return NextResponse.json({ error: 'Uno o más productos no pertenecen al negocio actual.' }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'product_validation_failed' }, { status: 400 });
  }

  const { data: newSeason, error } = await db.from('seasons')
    .insert({ ...season, business_unit_id: business.id })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (productIds.length) {
    const rows = productIds.map((pid: string) => ({ season_id: newSeason.id, product_id: pid }));
    const { error: prodError } = await db.from('season_products').insert(rows);
    if (prodError) return NextResponse.json({ error: prodError.message }, { status: 400 });
  }

  return NextResponse.json({ data: newSeason }, { status: 201 });
}
