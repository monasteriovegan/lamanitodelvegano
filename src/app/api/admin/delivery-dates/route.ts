import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { getCurrentAdminUser } from '@/lib/supabase/server-auth';
import { DeliveryRepository } from '@/lib/repositories/delivery-repository';
import { SchemaCapabilityError } from '@/lib/repositories/schema-capabilities';

export async function GET() {
  const admin = await getCurrentAdminUser();
  if (!admin || !['admin', 'soporte', 'bodega'].includes(admin.rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const db = createSupabaseServiceClient();
  const data = await new DeliveryRepository(db).getSettings();
  return NextResponse.json({ data });
}

export async function PUT(req: Request) {
  const admin = await getCurrentAdminUser();
  if (!admin || !['admin'].includes(admin.rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const db = createSupabaseServiceClient();
  const body = await req.json();
  try {
    const data = await new DeliveryRepository(db).saveSettings(body);
    return NextResponse.json({ data });
  } catch (error) {
    const status = error instanceof SchemaCapabilityError ? 503 : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'delivery_update_failed' }, { status });
  }
}
