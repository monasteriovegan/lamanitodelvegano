import { getCurrentAdminUser } from '@/lib/supabase/server-auth';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { WONKA_TOOLS, runWonkaTool } from '@/lib/wonka/tools';

export async function POST(request: Request) {
  const admin = await getCurrentAdminUser();
  if (!admin || !['admin', 'owner'].includes(admin.rol)) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: 'invalid_origin' }, { status: 403 });

  const body = await request.json().catch(() => null) as { name?: string; args?: Record<string, unknown>; confirm?: boolean } | null;
  const name = String(body?.name || '');
  const definition = WONKA_TOOLS.find((tool) => tool.name === name);
  if (!definition || !definition.write || body?.confirm !== true) {
    return Response.json({ error: 'explicit_confirmation_required' }, { status: 400 });
  }

  try {
    const db = createSupabaseServiceClient();
    const result = await runWonkaTool(db, name, body?.args || {}, {
      actorType: 'admin',
      actorId: admin.id,
      allowWrite: true,
    });
    return Response.json({ ok: true, result });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'tool_failed' }, { status: 400 });
  }
}
