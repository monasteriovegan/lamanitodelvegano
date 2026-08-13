import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { getCurrentAdminUser } from '@/lib/supabase/server-auth';
import { OrderRepository } from '@/lib/repositories/orders-repository';
import { SchemaCapabilityError } from '@/lib/repositories/schema-capabilities';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PUT(req: Request, { params }: RouteParams) {
  const admin = await getCurrentAdminUser();
  if (!admin || !['admin', 'soporte', 'bodega'].includes(admin.rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await params;
  const db = createSupabaseServiceClient();
  const body = await req.json();

  try {
    const updatedOrder = await new OrderRepository(db).update(id, body, admin.id);
    return NextResponse.json({ ok: true, data: updatedOrder });
  } catch (error) {
    const status = error instanceof SchemaCapabilityError ? 503 : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'order_update_failed' }, { status });
  }
}
