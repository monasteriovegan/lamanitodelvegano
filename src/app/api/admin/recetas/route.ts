import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { getCurrentAdminUser } from '@/lib/supabase/server-auth';
import { BusinessRepository } from '@/lib/repositories/business-repository';

async function belongsToBusiness(db: ReturnType<typeof createSupabaseServiceClient>, table: 'productos' | 'ingredients', businessUnitId: string, ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return true;
  const { data, error } = await db.from(table).select('id').eq('business_unit_id', businessUnitId).in('id', unique);
  if (error) throw error;
  return (data || []).length === unique.length;
}

export async function GET() {
  const admin = await getCurrentAdminUser();
  if (!admin || !['admin', 'soporte', 'bodega'].includes(admin.rol)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const db = createSupabaseServiceClient();
  const business = await new BusinessRepository(db).requireDefault();
  const { data, error } = await db.from('recipes')
    .select('*, product:productos(nombre,business_unit_id), recipe_ingredients(*, ingredient:ingredients(name,unit,cost_per_unit,business_unit_id))')
    .eq('business_unit_id', business.id)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

export async function POST(req: Request) {
  const admin = await getCurrentAdminUser();
  if (!admin || !['admin'].includes(admin.rol)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const db = createSupabaseServiceClient();
  const business = await new BusinessRepository(db).requireDefault();
  const body = await req.json();
  const { ingredients, business_unit_id: _ignored, ...recipe } = body;
  const productId = recipe.product_id ? String(recipe.product_id) : null;
  const ingredientIds = Array.isArray(ingredients) ? ingredients.map((item: any) => String(item?.ingredient_id || '')).filter(Boolean) : [];

  try {
    if (productId && !(await belongsToBusiness(db, 'productos', business.id, [productId]))) {
      return NextResponse.json({ error: 'El producto no pertenece al negocio actual.' }, { status: 400 });
    }
    if (!(await belongsToBusiness(db, 'ingredients', business.id, ingredientIds))) {
      return NextResponse.json({ error: 'Uno o más ingredientes no pertenecen al negocio actual.' }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'scope_validation_failed' }, { status: 400 });
  }

  const { data: rec, error } = await db.from('recipes')
    .insert({ ...recipe, business_unit_id: business.id })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (ingredients?.length) {
    const rows = ingredients.map((i: any) => ({ ...i, recipe_id: rec.id }));
    const { error: ingError } = await db.from('recipe_ingredients').insert(rows);
    if (ingError) return NextResponse.json({ error: ingError.message }, { status: 400 });
  }

  return NextResponse.json({ data: rec }, { status: 201 });
}
