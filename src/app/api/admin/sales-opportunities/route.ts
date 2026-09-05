import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { getCurrentAdminUser } from '@/lib/supabase/server-auth';
import { listSalesOpportunities } from '@/lib/opportunities/service';

export async function GET(req: Request) {
  const admin = await getCurrentAdminUser();
  if (!admin || admin.rol !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const url = new URL(req.url);
  try {
    const opportunities = await listSalesOpportunities(createSupabaseServiceClient(), {
      status: url.searchParams.get('status') || undefined,
      priority: url.searchParams.get('priority') || undefined,
      channel: url.searchParams.get('channel') || undefined,
    });
    return NextResponse.json({ opportunities });
  } catch (error) {
    console.error('admin_sales_opportunities_list_failed', { reason: error instanceof Error ? error.message : 'unknown' });
    return NextResponse.json({ error: 'No se pudieron cargar las oportunidades.' }, { status: 500 });
  }
}
