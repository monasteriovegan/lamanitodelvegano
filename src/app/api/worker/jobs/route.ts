import { createSupabaseServiceClient } from '@/lib/supabase/server';

function authorized(request: Request) {
  const expected = process.env.SYNTHETIQ_WORKER_TOKEN;
  if (!expected) return false;
  const auth = request.headers.get('authorization') || '';
  return auth === `Bearer ${expected}`;
}

export async function POST(request: Request) {
  if (!authorized(request)) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => null) as { action?: string; job_id?: string; worker_id?: string; status?: string; output?: unknown; error?: string; screenshot_url?: string; external_job_id?: string } | null;
  const action = String(body?.action || '');
  const db = createSupabaseServiceClient();

  if (action === 'claim') {
    const workerId = String(body?.worker_id || 'worker');
    const { data: job, error } = await db.from('wonka_jobs')
      .select('id,business_unit_id,job_type,title,instruction,provider,resource_id,input,risk_level')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) return Response.json({ error: error.message }, { status: 400 });
    if (!job) return Response.json({ job: null });
    const now = new Date().toISOString();
    const claimed = await db.from('wonka_jobs')
      .update({ status: 'running', worker_id: workerId, started_at: now, updated_at: now })
      .eq('id', job.id).eq('status', 'queued')
      .select('id,business_unit_id,job_type,title,instruction,provider,resource_id,input,risk_level,worker_id,started_at')
      .maybeSingle();
    if (claimed.error) return Response.json({ error: claimed.error.message }, { status: 400 });
    if (!claimed.data) return Response.json({ job: null });
    await db.from('wonka_job_events').insert({ job_id: job.id, event_type: 'claimed', status: 'running', message: `Tomado por ${workerId}.`, payload: { worker_id: workerId } });
    return Response.json({ job: claimed.data });
  }

  if (action === 'update') {
    const jobId = String(body?.job_id || '');
    const status = String(body?.status || '');
    if (!jobId || !['running','waiting_user','completed','failed','cancelled'].includes(status)) return Response.json({ error: 'invalid_payload' }, { status: 400 });
    const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (body?.output !== undefined) patch.output = body.output;
    if (body?.error !== undefined) patch.error = String(body.error).slice(0, 4000);
    if (body?.external_job_id) patch.external_job_id = String(body.external_job_id).slice(0, 500);
    if (['completed','failed','cancelled'].includes(status)) patch.completed_at = new Date().toISOString();
    const { data, error } = await db.from('wonka_jobs').update(patch).eq('id', jobId).select('id,status,output,error,completed_at').maybeSingle();
    if (error) return Response.json({ error: error.message }, { status: 400 });
    if (!data) return Response.json({ error: 'job_not_found' }, { status: 404 });
    await db.from('wonka_job_events').insert({ job_id: jobId, event_type: 'worker_update', status, message: body?.error ? String(body.error).slice(0, 1000) : null, screenshot_url: body?.screenshot_url || null, payload: { output: body?.output ?? null } });
    return Response.json({ ok: true, job: data });
  }

  return Response.json({ error: 'unsupported_action' }, { status: 400 });
}
