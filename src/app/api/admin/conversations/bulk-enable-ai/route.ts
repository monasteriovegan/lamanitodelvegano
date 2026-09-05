import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { getCurrentAdminUser } from '@/lib/supabase/server-auth';

// Turns Remy back on for every non-personal WhatsApp/Instagram conversation
// that currently has its individual switch off. Mirrors the same rules the
// single-conversation PATCH endpoint already enforces (never touches
// "personal" contacts, never touches humanTakeover) — this just does it for
// every conversation at once, since the admin panel previously required
// opening each chat individually to flip it back on.
export async function POST(request: Request) {
  const admin = await getCurrentAdminUser();
  if (!admin || !['admin', 'owner', 'supervisor', 'soporte'].includes(admin.rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: 'invalid_origin' }, { status: 403 });
  }

  const db = createSupabaseServiceClient();
  const { data: candidates, error } = await db
    .from('conversations')
    .select('id,labels,metadata,human_takeover')
    .in('channel', ['whatsapp', 'instagram'])
    .eq('ai_enabled', false);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const targetIds = (candidates || [])
    .filter((row: any) => {
      const labels = Array.isArray(row.labels) ? row.labels : [];
      const personal = Boolean(row.metadata?.personal) || labels.includes('personal');
      return !personal && !row.human_takeover;
    })
    .map((row: any) => row.id);

  if (targetIds.length === 0) return NextResponse.json({ ok: true, updated: 0 });

  const now = new Date().toISOString();
  const { error: updateError } = await db
    .from('conversations')
    .update({ ai_enabled: true, updated_at: now })
    .in('id', targetIds);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

  return NextResponse.json({ ok: true, updated: targetIds.length });
}
