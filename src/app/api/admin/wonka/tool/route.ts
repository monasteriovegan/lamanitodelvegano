import { getCurrentAdminUser } from '@/lib/supabase/server-auth';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { WONKA_TOOLS, runWonkaTool } from '@/lib/wonka/tools';
import { WONKA_COMPUTER_TOOLS, isComputerTool, runComputerTool } from '@/lib/wonka/computer-tools';

const ALL_TOOLS = [...WONKA_TOOLS, ...WONKA_COMPUTER_TOOLS];

function describeAction(name: string, args: Record<string, unknown>) {
  if (name === 'set_remy_global') return `${Boolean(args.enabled) ? 'Activé' : 'Pausé'} Remy globalmente.`;
  if (name === 'set_conversation_ai') return `${Boolean(args.enabled) ? 'Activé' : 'Pausé'} Remy en la conversación indicada.`;
  if (name === 'create_calendar_event') return `Creé el evento “${String(args.summary || 'evento')}” en Google Calendar.`;
  if (name === 'prepare_browser_job') return `Preparé el trabajo de navegador “${String(args.title || 'sin título')}”.`;
  if (name === 'prepare_media_job') return `Preparé la generación “${String(args.title || 'sin título')}” y seleccioné la mejor ruta de recursos disponible.`;
  if (name === 'approve_wonka_job') return 'Aprobé el trabajo y quedó en cola para el worker.';
  if (name === 'cancel_wonka_job') return 'Cancelé el trabajo indicado.';
  return `Ejecuté ${name}.`;
}

export async function POST(request: Request) {
  const admin = await getCurrentAdminUser();
  if (!admin || !['admin', 'owner'].includes(admin.rol)) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: 'invalid_origin' }, { status: 403 });

  const body = await request.json().catch(() => null) as { name?: string; args?: Record<string, unknown>; confirm?: boolean } | null;
  const name = String(body?.name || '');
  const args = body?.args || {};
  const definition = ALL_TOOLS.find((tool) => tool.name === name);
  if (!definition || !definition.write || body?.confirm !== true) return Response.json({ error: 'explicit_confirmation_required' }, { status: 400 });

  try {
    const db = createSupabaseServiceClient();
    const result = isComputerTool(name)
      ? await runComputerTool(db, name, args, { actorId: admin.id, allowWrite: true })
      : await runWonkaTool(db, name, args, { actorType: 'admin', actorId: admin.id, allowWrite: true });

    const { data: thread } = await db.from('wonka_threads').select('id').eq('owner_user_id', admin.id).order('updated_at', { ascending: false }).limit(1).maybeSingle();
    let receipt = null;
    if (thread?.id) {
      const saved = await db.from('wonka_messages').insert({
        thread_id: thread.id,
        role: 'assistant',
        content: `${describeAction(name, args)} Acción confirmada por ti y ejecutada correctamente.`,
        metadata: { action_receipt: true, tool_name: name, tool_result: result },
      }).select('id,role,content,metadata,created_at').single();
      receipt = saved.data || null;
      await db.from('wonka_threads').update({ updated_at: new Date().toISOString() }).eq('id', thread.id);
    }
    return Response.json({ ok: true, result, receipt });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'tool_failed' }, { status: 400 });
  }
}
