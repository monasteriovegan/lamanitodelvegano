import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { getCurrentAdminUser } from '@/lib/supabase/server-auth';
import { CustomerRepository } from '@/lib/repositories/customers-repository';
import { SchemaCapabilityError } from '@/lib/repositories/schema-capabilities';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PUT(req: Request, { params }: RouteParams) {
  const admin = await getCurrentAdminUser();
  if (!admin || !['admin', 'soporte'].includes(admin.rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await params;
  const db = createSupabaseServiceClient();
  const body = await req.json();

  try {
    const data = await new CustomerRepository(db).update(id, body);
    return NextResponse.json({ data });
  } catch (error) {
    const status = error instanceof SchemaCapabilityError ? 503 : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'customer_update_failed' }, { status });
  }
}
