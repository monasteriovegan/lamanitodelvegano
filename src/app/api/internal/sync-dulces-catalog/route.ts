import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { syncDulcesCatalog } from '@/lib/catalog/sync-dulces-catalog';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const db = createSupabaseServiceClient();
    const result = await syncDulcesCatalog(db);
    return NextResponse.json({ ok: true, result });
  } catch (err: any) {
    console.error('sync_dulces_catalog_failed:', err);
    return NextResponse.json({ error: err?.message || 'sync_failed' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return GET(req);
}
