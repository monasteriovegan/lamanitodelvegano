import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { getCurrentAdminUser } from '@/lib/supabase/server-auth';

export async function GET() {
  const admin = await getCurrentAdminUser();
  if (!admin || !['admin'].includes(admin.rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const db = createSupabaseServiceClient();
  const { data, error } = await db
    .from('seasons')
    .select('*, season_products(product_id, products:productos(nombre,images,precio))')
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
  const body = await req.json();
  const { product_ids, ...season } = body;

  const { data: newSeason, error } = await db.from('seasons').insert(season).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (product_ids?.length) {
    const rows = product_ids.map((pid: string) => ({
      season_id: newSeason.id,
      product_id: pid,
    }));
    const { error: prodError } = await db.from('season_products').insert(rows);
    if (prodError) return NextResponse.json({ error: prodError.message }, { status: 400 });
  }

  return NextResponse.json({ data: newSeason }, { status: 201 });
}
