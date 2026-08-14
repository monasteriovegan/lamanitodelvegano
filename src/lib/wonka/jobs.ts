import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export type WonkaJobType = 'browser' | 'media' | 'workflow' | 'computer';

export async function listResources(db: SupabaseClient, input: { resourceType?: string; businessUnitId?: string | null } = {}) {
  let query = db.from('synthetiq_resources')
    .select('id,business_unit_id,resource_type,provider,label,mode,priority,enabled,quota_total,quota_remaining,quota_unit,estimated_unit_cost_usd,endpoint_url,metadata,updated_at')
    .eq('enabled', true)
    .order('priority', { ascending: true });
  if (input.resourceType) query = query.eq('resource_type', input.resourceType);
  if (input.businessUnitId) query = query.or(`business_unit_id.is.null,business_unit_id.eq.${input.businessUnitId}`);
  const { data, error } = await query.limit(100);
  if (error) throw error;
  return data || [];
}

export async function chooseResource(db: SupabaseClient, input: { resourceType: string; businessUnitId?: string | null }) {
  const resources = await listResources(db, input);
  return resources
    .filter((r: any) => r.quota_remaining == null || Number(r.quota_remaining) > 0)
    .filter((r: any) => !Boolean(r.metadata?.manual_provider_choice))
    .sort((a: any, b: any) => {
      const modeRank: Record<string, number> = { quota_web: 1, local_open_source: 2, credit: 3, api: 4, manual: 5 };
      const ar = modeRank[String(a.mode)] ?? 99;
      const br = modeRank[String(b.mode)] ?? 99;
      return ar - br || Number(a.priority || 100) - Number(b.priority || 100);
    })[0] || null;
}

export async function createWonkaJob(db: SupabaseClient, input: {
  ownerUserId?: string | null;
  businessUnitId?: string | null;
  jobType: WonkaJobType;
  title: string;
  instruction: string;
  provider?: string | null;
  resourceId?: string | null;
  riskLevel?: 'low' | 'medium' | 'high';
  input?: Record<string, unknown>;
  directlyAuthorized?: boolean;
}) {
  const now = new Date().toISOString();
  const directlyAuthorized = Boolean(input.directlyAuthorized);
  const status = directlyAuthorized ? 'queued' : 'awaiting_approval';
  const { data, error } = await db.from('wonka_jobs').insert({
    owner_user_id: input.ownerUserId || null,
    business_unit_id: input.businessUnitId || null,
    job_type: input.jobType,
    title: input.title.slice(0, 180),
    instruction: input.instruction.slice(0, 12000),
    provider: input.provider || null,
    resource_id: input.resourceId || null,
    status,
    approval_required: !directlyAuthorized,
    approved_at: directlyAuthorized ? now : null,
    approved_by: directlyAuthorized ? (input.ownerUserId || null) : null,
    risk_level: input.riskLevel || 'medium',
    input: input.input || {},
  }).select('id,business_unit_id,job_type,title,instruction,provider,resource_id,status,approval_required,risk_level,input,approved_at,created_at').single();
  if (error) throw error;
  await db.from('wonka_job_events').insert({
    job_id: data.id,
    event_type: directlyAuthorized ? 'created_authorized' : 'created',
    status,
    message: directlyAuthorized
      ? 'Trabajo creado y autorizado por la orden directa del dueño.'
      : 'Trabajo preparado por Wonka y pendiente de aprobación.',
  });
  return data;
}

export async function approveWonkaJob(db: SupabaseClient, input: { jobId: string; approvedBy?: string | null }) {
  const { data: current, error: currentError } = await db.from('wonka_jobs').select('id,status').eq('id', input.jobId).maybeSingle();
  if (currentError) throw currentError;
  if (!current) throw new Error('job_not_found');
  if (!['awaiting_approval', 'draft', 'waiting_user'].includes(String(current.status))) throw new Error('job_not_approvable');
  const now = new Date().toISOString();
  const { data, error } = await db.from('wonka_jobs').update({ status: 'queued', approved_at: now, approved_by: input.approvedBy || null, updated_at: now }).eq('id', input.jobId).select('id,status,approved_at').single();
  if (error) throw error;
  await db.from('wonka_job_events').insert({ job_id: input.jobId, event_type: 'approved', status: 'queued', message: 'Trabajo aprobado y listo para un worker.' });
  return data;
}

export async function cancelWonkaJob(db: SupabaseClient, jobId: string) {
  const now = new Date().toISOString();
  const { data, error } = await db.from('wonka_jobs').update({ status: 'cancelled', updated_at: now, completed_at: now }).eq('id', jobId).in('status', ['draft','awaiting_approval','queued','waiting_user']).select('id,status').maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('job_not_cancellable');
  await db.from('wonka_job_events').insert({ job_id: jobId, event_type: 'cancelled', status: 'cancelled', message: 'Trabajo cancelado.' });
  return data;
}

export async function recentWonkaJobs(db: SupabaseClient, limit = 20) {
  const { data, error } = await db.from('wonka_jobs')
    .select('id,business_unit_id,job_type,title,provider,status,risk_level,worker_id,started_at,completed_at,created_at,updated_at')
    .order('created_at', { ascending: false }).limit(Math.max(1, Math.min(50, limit)));
  if (error) throw error;
  return data || [];
}
