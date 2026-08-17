import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { getCurrentAdminUser } from '@/lib/supabase/server-auth';
import { BusinessRepository } from '@/lib/repositories/business-repository';

interface RouteParams { params: Promise<{ id: string }> }

async function belongsToBusiness(db: ReturnType<typeof createSupabaseServiceClient>, table: 'productos' | 'ingredients', businessUnitId: string, ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return true;
  const { data, error } = await db.from(table).select('id').eq('business_unit_id', businessUnitId).in('id', unique);
  if (error) throw error;
  return (data || []).length === unique.length;
}

export async function GET(_: Request, { params }: RouteParams) {
  const admin = await getCurrentAdminUser();
  if (!admin || !['admin', 'soporte', 'bodega'].includes(admin.rol)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  const db = createSupabaseServiceClient();
  const business = await new BusinessRepository(db).requireDefault();
  const { data, error } = await db.from('recipes')
    .select('*, product:productos(nombre,business_unit_id), recipe_ingredients(*, ingredient:ingredients(name,unit,cost_per_unit,business_unit_id))')
    .eq('id', id)
    .eq('business_unit_id', business.id)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json({ data });
}

export async function PUT(req: Request, { params }: RouteParams) {
  const admin = await getCurrentAdminUser();
  if (!admin || !['admin'].includes(admin.rol)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  const db = createSupabaseServiceClient();
  const business = await new BusinessRepository(db).requireDefault();
  const body = await req.json();
  const { ingredients, business_unit_id: _ignored, ...recipe } = body;

  const { data: ownedRecipe } = await db.from('recipes').select('id').eq('id', id).eq('business_unit_id', business.id).maybeSingle();
  if (!ownedRecipe) return NextResponse.json({ error: 'Receta no encontrada.' }, { status: 404 });

  const productId = recipe.product_id ? String(recipe.product_id) : null;
  const ingredientIds = Array.isArray(ingredients) ? ingredients.map((item: any) => String(item?.ingredient_id || '')).filter(Boolean) : [];
  try {
    if (productId && !(await belongsToBusiness(db, 'productos', business.id, [productId]))) {
      return NextResponse.json({ error: 'El producto no pertenece al negocio actual.' }, { status: 400 });
    }
    if (ingredients !== undefined && !(await belongsToBusiness(db, 'ingredients', business.id, ingredientIds))) {
      return NextResponse.json({ error: 'Uno o más ingredientes no pertenecen al negocio actual.' }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'scope_validation_failed' }, { status: 400 });
  }

  const { data, error } = await db.from('recipes')
    .update({ ...recipe, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('business_unit_id', business.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (ingredients !== undefined) {
    await db.from('recipe_ingredients').delete().eq('recipe_id', id);
    if (ingredients.length) {
      const rows = ingredients.map((i: any) => ({ ...i, recipe_id: id }));
      const { error: ingError } = await db.from('recipe_ingredients').insert(rows);
      if (ingError) return NextResponse.json({ error: ingError.message }, { status: 400 });
    }
  }

  return NextResponse.json({ data });
}

export async function DELETE(_: Request, { params }: RouteParams) {
  const admin = await getCurrentAdminUser();
  if (!admin || !['admin'].includes(admin.rol)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  const db = createSupabaseServiceClient();
  const business = await new BusinessRepository(db).requireDefault();
  const { data: ownedRecipe } = await db.from('recipes').select('id').eq('id', id).eq('business_unit_id', business.id).maybeSingle();
  if (!ownedRecipe) return NextResponse.json({ error: 'Receta no encontrada.' }, { status: 404 });

  await db.from('recipe_ingredients').delete().eq('recipe_id', id);
  const { error } = await db.from('recipes').delete().eq('id', id).eq('business_unit_id', business.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
