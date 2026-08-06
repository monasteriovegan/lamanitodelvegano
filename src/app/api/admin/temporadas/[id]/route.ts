import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { getCurrentAdminUser } from '@/lib/supabase/server-auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PUT(req: Request, { params }: RouteParams) {
  const admin = await getCurrentAdminUser();
  if (!admin || !['admin'].includes(admin.rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await params;
  const db = createSupabaseServiceClient();
  const body = await req.json();
  const { product_ids, ...season } = body;

  const { data, error } = await db
    .from('seasons')
    .update({ ...season, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (product_ids !== undefined) {
    // Delete existing links and insert new ones
    await db.from('season_products').delete().eq('season_id', id);
    if (product_ids.length) {
      const rows = product_ids.map((pid: string) => ({
        season_id: id,
        product_id: pid,
      }));
      const { error: prodError } = await db.from('season_products').insert(rows);
      if (prodError) return NextResponse.json({ error: prodError.message }, { status: 400 });
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

  // Delete product links first due to foreign keys, then the season itself
  await db.from('season_products').delete().eq('season_id', id);
  const { error } = await db.from('seasons').delete().eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
