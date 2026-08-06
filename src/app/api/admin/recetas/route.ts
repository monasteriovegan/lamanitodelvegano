import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { getCurrentAdminUser } from '@/lib/supabase/server-auth';

export async function GET() {
  const admin = await getCurrentAdminUser();
  if (!admin || !['admin', 'soporte', 'bodega'].includes(admin.rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const db = createSupabaseServiceClient();
  const { data, error } = await db
    .from('recipes')
    .select('*, product:productos(nombre), recipe_ingredients(*, ingredient:ingredients(name,unit,cost_per_unit))')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

export async function POST(req: Request) {
  const admin = await getCurrentAdminUser();
  if (!admin || !['admin'].includes(admin.rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const db = createSupabaseServiceClient();
  const body = await req.json();
  const { ingredients, ...recipe } = body;

  const { data: rec, error } = await db.from('recipes').insert(recipe).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (ingredients?.length) {
    const rows = ingredients.map((i: any) => ({ ...i, recipe_id: rec.id }));
    const { error: ingError } = await db.from('recipe_ingredients').insert(rows);
    if (ingError) return NextResponse.json({ error: ingError.message }, { status: 400 });
  }

  return NextResponse.json({ data: rec }, { status: 201 });
}
