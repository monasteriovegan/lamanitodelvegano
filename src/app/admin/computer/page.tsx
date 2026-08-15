import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { Badge, PageHeader, SectionCard, StatCard } from '../_ui/AdminUI';
import LocalComputerPairing from './LocalComputerPairing';

export const dynamic = 'force-dynamic';

function statusBadge(status: string) {
  if (status === 'completed') return <Badge tono="neon">✓ completado</Badge>;
  if (status === 'failed') return <Badge tono="rojo">falló</Badge>;
  if (status === 'running') return <Badge tono="am">ejecutando</Badge>;
  if (status === 'queued') return <Badge tono="am">en cola</Badge>;
  if (status === 'awaiting_approval') return <Badge tono="am">requiere aprobación</Badge>;
  if (status === 'waiting_user') return <Badge tono="am">esperando intervención</Badge>;
  return <Badge>{status}</Badge>;
}

export default async function ComputerPage() {
  const db = createSupabaseServiceClient();
  const [{ data: jobs }, { data: resources }] = await Promise.all([
    db.from('wonka_jobs').select('id,business_unit_id,job_type,title,instruction,provider,status,risk_level,worker_id,started_at,completed_at,created_at,input,output,error').order('created_at', { ascending: false }).limit(50),
    db.from('synthetiq_resources').select('id,resource_type,provider,label,mode,priority,enabled,quota_remaining,quota_unit,metadata,updated_at').order('priority'),
  ]);
  const rows = jobs || [];
  const resourceRows = resources || [];
  const supervisor = resourceRows.find((r: any) => r.provider === 'synthetiq_browser');
  const supervisorUrl = String(supervisor?.metadata?.supervisor_url || '');
  const vncPassword = String(supervisor?.metadata?.vnc_password || '');
  const awaiting = rows.filter((j: any) => j.status === 'awaiting_approval').length;
  const running = rows.filter((j: any) => ['queued','running','waiting_user'].includes(j.status)).length;
  const completed = rows.filter((j: any) => j.status === 'completed').length;

  return <div>
    <PageHeader eyebrow="✦ Wonka · Ejecución" title="Synthetiq Computer" action={<Badge tono="neon">modo supervisado</Badge>} />

    <SectionCard title="💻 Synthetiq Local Computer">
      <div className="grid gap-4 lg:grid-cols-[1fr_.9fr]">
        <div>
          <div className="flex flex-wrap items-center gap-2"><div className="text-sm font-bold text-white">Chrome Wonka en tu Windows</div><Badge tono="am">configuración inicial</Badge></div>
          <p className="mt-2 max-w-3xl text-xs leading-5 text-white/55">Este modo usa un perfil Chrome separado en tu propio PC para Flow, ChatGPT web, Gemini, Claude e Higgsfield. Tu Chrome personal queda fuera del alcance del worker. El PC debe estar encendido cuando quieras usar las cuotas web.</p>
          <div className="mt-3 rounded-xl border border-white/8 bg-black/10 p-3 text-[10px] leading-4 text-white/40">Primer objetivo: iniciar sesión una vez con la cuenta de Makangru en Chrome Wonka → comprobar Flow → crear el primer adaptador de generación.</div>
        </div>
        <LocalComputerPairing />
      </div>
    </SectionCard>

    <SectionCard title="🖥️ Sesión supervisada Railway">
      <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-bold text-white">Escritorio remoto 24/7 de Wonka</div>
            <Badge tono={supervisorUrl ? 'neon' : 'am'}>{supervisorUrl ? 'configurado' : 'pendiente'}</Badge>
          </div>
          <p className="mt-2 max-w-3xl text-xs leading-5 text-white/55">Este computador queda para navegación general y tareas 24/7. Para servicios que bloquean el login automatizado, como Google, usaremos preferentemente el Local Computer.</p>
          {vncPassword && <details className="mt-3 w-fit rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2 text-xs text-white/60"><summary className="cursor-pointer font-semibold text-white/70">Ver clave del escritorio</summary><code className="mt-2 block select-all text-neon">{vncPassword}</code></details>}
        </div>
        {supervisorUrl ? <a href={supervisorUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center justify-center rounded-full bg-neon px-5 text-sm font-black text-[#020705] shadow-[0_0_18px_rgba(0,255,179,0.22)]">Abrir escritorio ↗</a> : <div className="text-xs text-white/35">Aún sin URL</div>}
      </div>
    </SectionCard>

    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 my-5">
      <StatCard label="Pendientes de aprobar" value={String(awaiting)} hint="solo acciones sensibles" accento="am" />
      <StatCard label="En cola / ejecución" value={String(running)} hint="workers conectados" accento="gold" />
      <StatCard label="Completados" value={String(completed)} hint="últimos 50 trabajos" accento="neon" />
      <StatCard label="Recursos" value={String(resourceRows.filter((r: any) => r.enabled).length)} hint="web · open source · API" accento="neon" />
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
        <div className="space-y-2">{resourceRows.map((r: any) => <div key={r.id} className="rounded-2xl border border-white/8 bg-white/[0.025] p-3">
          <div className="flex justify-between gap-3"><div><div className="text-sm font-bold text-white">{r.label}</div><div className="mt-1 text-[10px] text-white/40">{r.resource_type} · {r.mode} · prioridad {r.priority}</div></div><Badge tono={r.enabled ? 'neon' : undefined}>{r.enabled ? 'activo' : 'pausado'}</Badge></div>
          <div className="mt-2 text-[10px] text-white/35">Cuota: {r.quota_remaining == null ? 'sin sincronizar' : `${r.quota_remaining} ${r.quota_unit || ''}`}</div>
        </div>)}</div>
        <p className="mt-3 text-[10px] leading-4 text-white/35">Ejecución: webs con sesión personal → Local Computer · tareas 24/7 → Railway · integraciones críticas → API.</p>
      </SectionCard>
    </div>
  </div>;
}
