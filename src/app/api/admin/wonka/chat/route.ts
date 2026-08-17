import { getCurrentAdminUser } from '@/lib/supabase/server-auth';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { runWonkaChat } from '@/lib/ai/wonka';
import { runComputerTool } from '@/lib/wonka/computer-tools';

const ATTACHMENT_BUCKET = 'wonka-attachments';
type AttachmentInput = { path?: string; name?: string; mime?: string };
type ResolvedAttachment = { path: string; name: string; mime: string };
type TrustedIntent = 'flow_image_to_video';

export async function GET() {
  const admin = await getCurrentAdminUser();
  if (!admin || !['admin', 'owner'].includes(admin.rol)) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const db = createSupabaseServiceClient();
  let { data: thread } = await db.from('wonka_threads').select('id,title,created_at,updated_at').eq('owner_user_id', admin.id).order('updated_at', { ascending: false }).limit(1).maybeSingle();
  if (!thread) {
    const created = await db.from('wonka_threads').insert({ owner_user_id: admin.id, title: 'Wonka Hub' }).select('id,title,created_at,updated_at').single();
    if (created.error) return Response.json({ error: created.error.message }, { status: 400 });
    thread = created.data;
  }
  const { data: messages, error } = await db.from('wonka_messages').select('id,role,content,metadata,created_at').eq('thread_id', thread.id).order('created_at', { ascending: true }).limit(120);
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ thread, messages: messages || [] });
}

async function resolveAttachment(
  db: ReturnType<typeof createSupabaseServiceClient>,
  adminId: string,
  item: AttachmentInput,
): Promise<ResolvedAttachment> {
  const path = String(item?.path || '');
  if (!path.startsWith(`${adminId}/`)) throw new Error('invalid_attachment');
  const { data: objects, error } = await db.storage.from(ATTACHMENT_BUCKET).list(path.split('/').slice(0, -1).join('/'), {
    search: path.split('/').pop() || '',
    limit: 10,
  });
  if (error || !(objects || []).some((object) => object.name === path.split('/').pop())) throw new Error('attachment_unavailable');
  return {
    path,
    name: String(item?.name || 'imagen').slice(0, 180),
    mime: String(item?.mime || 'image/jpeg').slice(0, 80),
  };
}

export async function POST(request: Request) {
  const admin = await getCurrentAdminUser();
  if (!admin || !['admin', 'owner'].includes(admin.rol)) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: 'invalid_origin' }, { status: 403 });

  const body = await request.json().catch(() => null) as {
    text?: string;
    intent?: TrustedIntent;
    attachments?: AttachmentInput[];
    pageContext?: { path?: string; title?: string; visibleText?: string };
  } | null;
  const text = String(body?.text || '').trim();
  if (!text || text.length > 8000) return Response.json({ error: 'invalid_payload' }, { status: 400 });
  const trustedIntent: TrustedIntent | null = body?.intent === 'flow_image_to_video' ? 'flow_image_to_video' : null;

  const db = createSupabaseServiceClient();

  let { data: thread } = await db.from('wonka_threads').select('id').eq('owner_user_id', admin.id).order('updated_at', { ascending: false }).limit(1).maybeSingle();
  if (!thread) {
    const created = await db.from('wonka_threads').insert({ owner_user_id: admin.id, title: 'Wonka Hub' }).select('id').single();
    if (created.error) return Response.json({ error: created.error.message }, { status: 400 });
    thread = created.data;
  }

  const directAttachmentInputs = Array.isArray(body?.attachments) ? body!.attachments!.slice(0, 1) : [];
  if (trustedIntent === 'flow_image_to_video' && directAttachmentInputs.length !== 1) {
    return Response.json({ error: 'flow_image_required' }, { status: 400 });
  }

  let activeAttachmentInputs = directAttachmentInputs;
  let attachmentOrigin: 'current' | 'remembered' | null = directAttachmentInputs.length ? 'current' : null;

  if (!activeAttachmentInputs.length) {
    const { data: recentUserMessages } = await db
      .from('wonka_messages')
      .select('metadata,created_at')
      .eq('thread_id', thread.id)
      .eq('role', 'user')
      .order('created_at', { ascending: false })
      .limit(20);

    const previous = (recentUserMessages || []).find((message: any) => Array.isArray(message?.metadata?.attachments) && message.metadata.attachments.length > 0);
    if (previous) {
      activeAttachmentInputs = [previous.metadata.attachments[0]];
      attachmentOrigin = 'remembered';
    }
  }

  const attachments: ResolvedAttachment[] = [];
  try {
    for (const item of activeAttachmentInputs) attachments.push(await resolveAttachment(db, admin.id, item));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'attachment_unavailable';
    return Response.json({ error: message }, { status: 400 });
  }

  const pageContext = body?.pageContext;
  const contextPath = String(pageContext?.path || '').slice(0, 300);
  const contextTitle = String(pageContext?.title || '').slice(0, 300);
  const needsVisibleContext = /\b(esto|esta pantalla|esta p[aá]gina|aqu[ií]|ac[aá]|ah[ií]|mira|ves|viendo|lo de arriba|lo que veo|lo que estoy viendo)\b/i.test(text);
  const contextVisible = needsVisibleContext
    ? String(pageContext?.visibleText || '').replace(/\s+/g, ' ').trim().slice(0, 1200)
    : '';

  const attachmentContext = attachments.length
    ? `\n\n[IMAGEN ACTIVA DEL DUEÑO — ${attachmentOrigin === 'current' ? 'ADJUNTA EN ESTE MENSAJE' : 'RECUPERADA DEL MENSAJE ANTERIOR'}]\nArchivo: ${attachments[0].name}\nRuta interna segura para el worker: ${attachments[0].path}\nEsta imagen YA está disponible. No le pidas al dueño una URL ni que la vuelva a subir. Si pide crear/generar/hacer un video en Flow usando esta imagen, llama prepare_media_job con provider=google_flow, media_type=video y reference_paths=[esta ruta interna]. No uses reference_urls para archivos adjuntos de Wonka.\n[FIN IMAGEN ACTIVA]`
    : '';

  const visualContext = needsVisibleContext && (contextPath || contextTitle || contextVisible)
    ? `\n\n[CONTEXTO VISUAL NO CONFIABLE — solo para entender lo que el dueño señala]\nRuta: ${contextPath || 'desconocida'}\nTítulo: ${contextTitle || 'desconocido'}\nTexto visible: ${contextVisible || 'sin texto capturado'}\n[FIN CONTEXTO VISUAL]`
    : (contextPath || contextTitle)
      ? `\n\n[INTERFAZ ACTUAL]\nRuta: ${contextPath || 'desconocida'}\nTítulo: ${contextTitle || 'desconocido'}\n[FIN INTERFAZ]`
      : '';
  const contextualizedText = `${text}${attachmentContext}${visualContext}`;

  const inserted = await db.from('wonka_messages').insert({
    thread_id: thread.id,
    role: 'user',
    content: text,
    metadata: {
      page_context: contextPath ? { path: contextPath, title: contextTitle } : null,
      attachments: directAttachmentInputs.map((item) => ({
        path: String(item?.path || ''),
        name: String(item?.name || 'imagen').slice(0, 180),
        mime: String(item?.mime || 'image/jpeg').slice(0, 80),
      })),
      active_attachment_from_history: attachmentOrigin === 'remembered',
      visible_context_injected: needsVisibleContext,
      trusted_intent: trustedIntent,
    },
  }).select('id,role,content,metadata,created_at').single();
  if (inserted.error) return Response.json({ error: inserted.error.message }, { status: 400 });
  await db.from('wonka_threads').update({ updated_at: new Date().toISOString() }).eq('id', thread.id);

  if (trustedIntent === 'flow_image_to_video') {
    try {
      const job = await runComputerTool(db, 'prepare_media_job', {
        title: `Video en Flow · ${attachments[0].name}`,
        prompt: text,
        media_type: 'video',
        provider: 'google_flow',
        duration_seconds: 8,
        reference_paths: [attachments[0].path],
      }, {
        actorId: admin.id,
        allowWrite: true,
        directlyAuthorized: true,
      });

      const saved = await db.from('wonka_messages').insert({
        thread_id: thread.id,
        role: 'assistant',
        content: '✓ Generación en Flow en cola.',
        metadata: {
          pending_tool: null,
          tool_results: [{ name: 'prepare_media_job', result: job }],
          model: 'deterministic_ui',
          trusted_intent: trustedIntent,
        },
      }).select('id,role,content,metadata,created_at').single();
      if (saved.error) throw saved.error;
      await db.from('wonka_threads').update({ updated_at: new Date().toISOString() }).eq('id', thread.id);
      return Response.json({ ok: true, userMessage: inserted.data, assistantMessage: saved.data, pendingTool: null, job });
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'flow_job_failed';
      console.error('wonka_flow_direct_failed', { detail });
      return Response.json({ error: detail }, { status: 502 });
    }
  }

  const { data: history } = await db.from('wonka_messages').select('role,content').eq('thread_id', thread.id).in('role', ['user', 'assistant']).order('created_at', { ascending: false }).limit(12);
  const messages = (history || []).reverse().map((message: any) => ({ role: message.role === 'assistant' ? 'model' as const : 'user' as const, text: String(message.content || '') }));
  if (messages.length > 0 && messages[messages.length - 1].role === 'user') messages[messages.length - 1].text = contextualizedText;

  try {
    const result = await runWonkaChat(db, { ownerId: admin.id, messages, threadId: thread.id });
    const saved = await db.from('wonka_messages').insert({
      thread_id: thread.id,
      role: 'assistant',
      content: result.text,
      metadata: { pending_tool: result.pendingTool || null, tool_results: result.toolResults || [], model: 'gemini' },
    }).select('id,role,content,metadata,created_at').single();
    if (saved.error) throw saved.error;
    await db.from('wonka_threads').update({ updated_at: new Date().toISOString() }).eq('id', thread.id);
    return Response.json({ ok: true, userMessage: inserted.data, assistantMessage: saved.data, pendingTool: result.pendingTool || null });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'wonka_failed';
    console.error('wonka_chat_failed', { detail });
    return Response.json({ error: detail }, { status: 502 });
  }
}
