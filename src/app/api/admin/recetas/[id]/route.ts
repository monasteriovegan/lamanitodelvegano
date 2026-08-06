import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { getCurrentAdminUser } from '@/lib/supabase/server-auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_: Request, { params }: RouteParams) {
  const admin = await getCurrentAdminUser();
  if (!admin || !['admin', 'soporte', 'bodega'].includes(admin.rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await params;
  const db = createSupabaseServiceClient();
  const { data, error } = await db
    .from('recipes')
    .select('*, product:productos(nombre), recipe_ingredients(*, ingredient:ingredients(name,unit,cost_per_unit))')
    .eq('id', id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json({ data });
}

export async function PUT(req: Request, { params }: RouteParams) {
  const admin = await getCurrentAdminUser();
  if (!admin || !['admin'].includes(admin.rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await params;
  const db = createSupabaseServiceClient();
  const body = await req.json();
  const { ingredients, ...recipe } = body;

  const { data, error } = await db
    .from('recipes')
    .update({ ...recipe, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (ingredients !== undefined) {
    // Delete existing recipe ingredients and insert new ones
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
  if (!admin || !['admin'].includes(admin.rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await params;
  const db = createSupabaseServiceClient();

  // Delete relations first due to foreign keys, then the recipe
  await db.from('recipe_ingredients').delete().eq('recipe_id', id);
  const { error } = await db.from('recipes').delete().eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
