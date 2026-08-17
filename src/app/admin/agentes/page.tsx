import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/supabase/require-role';
import { getProviderConnectionStatus } from '@/lib/ai/providers';
import { Badge, PageHeader, SectionCard } from '../_ui/AdminUI';
import { saveAgentRuntime } from './actions';

export const dynamic = 'force-dynamic';

const DETAILS: Record<string, { icon: string; title: string; description: string }> = {
  wonka: { icon: '🎩', title: 'Wonka', description: 'Director general y super asistente. Su modelo se mantiene fijo hasta que tú lo cambies.' },
  remy: { icon: '🤖', title: 'Remy', description: 'Ventas y atención automática. Web y WhatsApp comparten este mismo runtime.' },
};

export default async function AgentesPage() {
  await requireRole(['admin']);
  const db = createSupabaseServiceClient();
  const [{ data }, providers] = await Promise.all([
    db.from('agent_runtime_configs')
      .select('agent,provider,model,execution_mode,enabled,allow_external_web_tools,updated_at')
      .in('agent', ['wonka', 'remy']),
    getProviderConnectionStatus(db),
  ]);
  const byAgent = Object.fromEntries((data || []).map((row: any) => [row.agent, row]));

  return <div className="max-w-4xl">
    <PageHeader eyebrow="✦ Synthetiq Core" title="Agentes & modelos" action={<Badge tono="neon">selección manual</Badge>} />
    <p className="mb-5 text-xs leading-5 text-white/45">
      Cada agente conserva su propio provider y modelo. Cambiarlo aquí no altera su memoria, reglas, herramientas ni presupuesto de contexto. Las versiones web de otros LLM siguen siendo herramientas externas, no cambios automáticos de cerebro.
    </p>

    <div className="grid gap-4 lg:grid-cols-2">
      {['wonka', 'remy'].map((agent) => {
        const row = byAgent[agent] || { provider: 'gemini', model: 'gemini-2.5-flash', execution_mode: 'api', enabled: true, allow_external_web_tools: true };
        const detail = DETAILS[agent];
        return <SectionCard key={agent} title={`${detail.icon} ${detail.title}`}>
          <p className="mb-4 text-xs leading-5 text-white/45">{detail.description}</p>
          <form action={saveAgentRuntime} className="space-y-4">
            <input type="hidden" name="agent" value={agent} />
            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-white/40">Proveedor del cerebro</label>
              <select name="provider" defaultValue={row.provider || 'gemini'} className="w-full rounded-xl border border-white/10 bg-[#07130e] px-3 py-2.5 text-sm text-white">
                <option value="gemini" disabled={!providers.gemini}>Gemini API · {providers.gemini ? 'conectado' : 'falta API key'}</option>
                <option value="groq" disabled={!providers.groq}>Groq API · {providers.groq ? 'conectado' : 'conéctalo en Integraciones'}</option>
              </select>
              <p className="mt-1 text-[10px] text-white/30">El servidor rechazará guardar un provider que no tenga credencial activa.</p>
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-white/40">Modelo</label>
              <input name="model" list={`models-${agent}`} defaultValue={row.model || 'gemini-2.5-flash'} className="w-full rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2.5 text-sm text-white" />
              <datalist id={`models-${agent}`}>
                <option value="gemini-2.5-flash" />
                <option value="gemini-2.5-flash-lite" />
                <option value="openai/gpt-oss-20b" />
                <option value="openai/gpt-oss-120b" />
                <option value="qwen/qwen3.6-27b" />
              </datalist>
              <p className="mt-1 text-[10px] leading-4 text-white/30">Los modelos Groq solo funcionan si el provider seleccionado es Groq. Qwen vía Groq usa reasoning desactivado para ahorrar tokens; el Qwen local será un modo de ejecución separado.</p>
            </div>
            <input type="hidden" name="execution_mode" value="api" />
            <label className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.025] p-3 text-sm text-white/70">
              <input type="checkbox" name="enabled" defaultChecked={row.enabled !== false} />
              Agente habilitado
            </label>
            <label className="flex items-start gap-3 rounded-xl border border-white/8 bg-white/[0.025] p-3 text-sm text-white/70">
              <input type="checkbox" name="allow_external_web_tools" defaultChecked={row.allow_external_web_tools !== false} className="mt-1" />
              <span><span className="block font-semibold text-white/80">Permitir herramientas web externas</span><span className="mt-0.5 block text-[10px] leading-4 text-white/35">No cambia el LLM del agente. Permite usar ChatGPT web, Gemini web, Claude web, Flow o Higgsfield únicamente cuando corresponda a tu orden.</span></span>
            </label>
            <button className="rounded-full bg-neon px-5 py-2.5 text-xs font-black text-[#02100a]">Guardar {detail.title}</button>
          </form>
        </SectionCard>;
      })}
    </div>
  </div>;
}
