import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { getCurrentAdminUser } from '@/lib/supabase/server-auth';
import { BusinessRepository } from '@/lib/repositories/business-repository';

interface RouteParams { params: Promise<{ id: string }> }

export async function PUT(req: Request, { params }: RouteParams) {
  const admin = await getCurrentAdminUser();
  if (!admin || !['admin'].includes(admin.rol)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  const db = createSupabaseServiceClient();
  const business = await new BusinessRepository(db).requireDefault();
  const body = await req.json();
  const { business_unit_id: _ignored, ...ingredient } = body;
  const { data, error } = await db.from('ingredients')
    .update(ingredient)
    .eq('id', id)
    .eq('business_unit_id', business.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

export async function DELETE(_: Request, { params }: RouteParams) {
  const admin = await getCurrentAdminUser();
  if (!admin || !['admin'].includes(admin.rol)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  const db = createSupabaseServiceClient();
  const business = await new BusinessRepository(db).requireDefault();
  const { error } = await db.from('ingredients')
    .delete()
    .eq('id', id)
    .eq('business_unit_id', business.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
