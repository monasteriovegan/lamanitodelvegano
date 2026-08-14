import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { Badge, PageHeader, SectionCard, StatCard } from '../_ui/AdminUI';

export const dynamic = 'force-dynamic';

function statusBadge(status: string) {
  if (status === 'completed') return <Badge tono="neon">✓ completado</Badge>;
  if (status === 'failed') return <Badge tono="rojo">falló</Badge>;
  if (status === 'running') return <Badge tono="am">ejecutando</Badge>;
  if (status === 'queued') return <Badge tono="am">en cola</Badge>;
  if (status === 'awaiting_approval') return <Badge tono="am">requiere aprobación</Badge>;
  return <Badge>{status}</Badge>;
}

export default async function ComputerPage() {
  const db = createSupabaseServiceClient();
  const [{ data: jobs }, { data: resources }] = await Promise.all([
    db.from('wonka_jobs').select('id,business_unit_id,job_type,title,instruction,provider,status,risk_level,worker_id,started_at,completed_at,created_at,input,output,error').order('created_at', { ascending: false }).limit(50),
    db.from('synthetiq_resources').select('id,resource_type,provider,label,mode,priority,enabled,quota_remaining,quota_unit,metadata,updated_at').order('priority'),
  ]);
  const rows = jobs || [];
  const awaiting = rows.filter((j: any) => j.status === 'awaiting_approval').length;
  const running = rows.filter((j: any) => ['queued','running','waiting_user'].includes(j.status)).length;
  const completed = rows.filter((j: any) => j.status === 'completed').length;

  return <div>
    <PageHeader eyebrow="✦ Wonka · Ejecución" title="Synthetiq Computer" action={<Badge tono="neon">modo supervisado</Badge>} />
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
      <StatCard label="Pendientes de aprobar" value={String(awaiting)} hint="Wonka no ejecuta sin permiso" accento="am" />
      <StatCard label="En cola / ejecución" value={String(running)} hint="workers conectados" accento="gold" />
      <StatCard label="Completados" value={String(completed)} hint="últimos 50 trabajos" accento="neon" />
      <StatCard label="Recursos" value={String((resources || []).filter((r: any) => r.enabled).length)} hint="web · open source · API" accento="neon" />
    </div>

    <div className="grid lg:grid-cols-[1.2fr_.8fr] gap-5">
      <SectionCard title="🎩 Trabajos de Wonka">
        <div className="space-y-2">
          {rows.map((job: any) => <div key={job.id} className="rounded-2xl border border-white/8 bg-white/[0.025] p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><div className="text-sm font-bold text-white truncate">{job.title}</div><div className="text-[10px] text-white/35 mt-1">{job.job_type} · {job.provider || 'ruta por decidir'} · riesgo {job.risk_level}</div></div>
              {statusBadge(job.status)}
            </div>
            <p className="mt-2 text-xs leading-5 text-white/55 line-clamp-3">{job.instruction}</p>
            <div className="mt-2 text-[9px] text-white/30">{new Date(job.created_at).toLocaleString('es-CL')}{job.worker_id ? ` · ${job.worker_id}` : ''}</div>
            {job.error && <div className="mt-2 rounded-xl bg-red-500/10 p-2 text-[10px] text-red-300">{job.error}</div>}
          </div>)}
          {!rows.length && <p className="py-8 text-center text-sm text-white/40">Todavía no hay trabajos. Pídele a Wonka preparar una tarea de navegador o una generación multimedia.</p>}
        </div>
      </SectionCard>

      <SectionCard title="🧰 Recursos y prioridad">
        <div className="space-y-2">{(resources || []).map((r: any) => <div key={r.id} className="rounded-2xl border border-white/8 bg-white/[0.025] p-3">
          <div className="flex justify-between gap-3"><div><div className="text-sm font-bold text-white">{r.label}</div><div className="mt-1 text-[10px] text-white/40">{r.resource_type} · {r.mode} · prioridad {r.priority}</div></div><Badge tono={r.enabled ? 'neon' : undefined}>{r.enabled ? 'activo' : 'pausado'}</Badge></div>
          <div className="mt-2 text-[10px] text-white/35">Cuota: {r.quota_remaining == null ? 'sin sincronizar' : `${r.quota_remaining} ${r.quota_unit || ''}`}</div>
        </div>)}</div>
        <p className="mt-3 text-[10px] leading-4 text-white/35">Política: cuota web → open source/local → créditos → API pagada → manual.</p>
      </SectionCard>
    </div>
  </div>;
}
