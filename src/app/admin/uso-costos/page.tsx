import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { PageHeader, StatCard, SectionCard, Badge } from '../_ui/AdminUI';

export const dynamic = 'force-dynamic';

function usd(value: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'USD', minimumFractionDigits: value < 0.01 ? 4 : 2, maximumFractionDigits: 6 }).format(value || 0);
}
function tokens(value: number) { return new Intl.NumberFormat('es-CL').format(value || 0); }

export default async function UsageCostsPage() {
  const db = createSupabaseServiceClient();
  const now = new Date();
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const month = new Date(now.getFullYear(), now.getMonth(), 1);
  const minute = new Date(now.getTime() - 60_000);

  const [{ data: events }, { data: units }, { data: quotas }] = await Promise.all([
    db.from('usage_events').select('id,business_unit_id,conversation_id,agent,service,provider,model,operation,input_tokens,output_tokens,thinking_tokens,cached_input_tokens,total_tokens,total_cost_usd,billing_status,latency_ms,status,occurred_at,metadata').gte('occurred_at', month.toISOString()).order('occurred_at', { ascending: false }).limit(3000),
    db.from('business_units').select('id,name'),
    db.from('provider_quota_configs').select('provider,model,rpm_limit,tpm_limit,rpd_limit,source,updated_at'),
  ]);

  const all = events || [];
  const todayEvents = all.filter((e: any) => new Date(e.occurred_at) >= today);
  const minuteEvents = all.filter((e: any) => new Date(e.occurred_at) >= minute);
  const aiToday = todayEvents.filter((e: any) => e.service === 'llm');
  const waToday = todayEvents.filter((e: any) => e.service === 'messaging' && e.provider === 'meta');
  const totalToday = todayEvents.reduce((s: number, e: any) => s + Number(e.total_cost_usd || 0), 0);
  const totalMonth = all.reduce((s: number, e: any) => s + Number(e.total_cost_usd || 0), 0);
  const tokensToday = aiToday.reduce((s: number, e: any) => s + Number(e.total_tokens || 0), 0);
  const avgLatency = aiToday.length ? Math.round(aiToday.reduce((s: number, e: any) => s + Number(e.latency_ms || 0), 0) / aiToday.length) : 0;

  const byAgent = Object.values(todayEvents.reduce((acc: Record<string, any>, e: any) => {
    const key = e.agent || 'system';
    acc[key] ||= { agent: key, requests: 0, tokens: 0, cost: 0, messaging: 0 };
    acc[key].requests += Number(e.request_count || 1);
    acc[key].tokens += Number(e.total_tokens || 0);
    acc[key].cost += Number(e.total_cost_usd || 0);
    if (e.service === 'messaging') acc[key].messaging += 1;
    return acc;
  }, {})).sort((a: any, b: any) => b.cost - a.cost || b.tokens - a.tokens) as any[];

  const conversationIds = [...new Set(todayEvents.map((e: any) => e.conversation_id).filter(Boolean))].slice(0, 100) as string[];
  let conversations: any[] = [];
  if (conversationIds.length) {
    const { data } = await db.from('conversations').select('id,customer_id,channel').in('id', conversationIds);
    const customerIds = [...new Set((data || []).map((c: any) => c.customer_id).filter(Boolean))] as string[];
    let contacts: any[] = [];
    if (customerIds.length) {
      const contactResult = await db.from('omnichannel_contacts').select('id,nombre,display_name,phone,email').in('id', customerIds);
      contacts = contactResult.data || [];
    }
    const names = Object.fromEntries(contacts.map((c: any) => [c.id, c.nombre || c.display_name || c.phone || c.email || 'Cliente']));
    conversations = (data || []).map((c: any) => ({ ...c, name: names[c.customer_id] || 'Conversación' }));
  }
  const convoMap = Object.fromEntries(conversations.map((c: any) => [c.id, c]));
  const byConversation = Object.values(todayEvents.filter((e: any) => e.conversation_id).reduce((acc: Record<string, any>, e: any) => {
    const id = e.conversation_id;
    acc[id] ||= { id, name: convoMap[id]?.name || 'Conversación', channel: convoMap[id]?.channel || '', tokens: 0, cost: 0, calls: 0, messaging: 0 };
    acc[id].tokens += Number(e.total_tokens || 0); acc[id].cost += Number(e.total_cost_usd || 0); acc[id].calls += e.service === 'llm' ? 1 : 0; acc[id].messaging += e.service === 'messaging' ? 1 : 0;
    return acc;
  }, {})).sort((a: any, b: any) => b.cost - a.cost || b.tokens - a.tokens).slice(0, 20) as any[];

  const unitNames = Object.fromEntries((units || []).map((u: any) => [u.id, u.name]));
  const geminiQuota = (quotas || []).find((q: any) => q.provider === 'gemini' && q.model === 'gemini-2.5-flash');
  const rpmObserved = minuteEvents.filter((e: any) => e.provider === 'gemini').reduce((s: number, e: any) => s + Number(e.request_count || 1), 0);
  const tpmObserved = minuteEvents.filter((e: any) => e.provider === 'gemini').reduce((s: number, e: any) => s + Number(e.input_tokens || 0), 0);
  const rpdObserved = todayEvents.filter((e: any) => e.provider === 'gemini').reduce((s: number, e: any) => s + Number(e.request_count || 1), 0);

  return <div>
    <PageHeader eyebrow="✦ Observabilidad Synthetiq" title="Uso & Costos" action={<Badge tono="neon">● medición activa</Badge>} />
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
      <StatCard label="Costo estimado hoy" value={usd(totalToday)} hint={`${aiToday.length} llamadas IA`} accento="neon" />
      <StatCard label="Tokens hoy" value={tokens(tokensToday)} hint={`latencia media ${avgLatency} ms`} accento="gold" />
      <StatCard label="WhatsApp hoy" value={String(waToday.length)} hint="envíos Cloud API observados" accento="am" />
      <StatCard label="Costo estimado mes" value={usd(totalMonth)} hint="ledger acumulado" accento="neon" />
    </div>

    <div className="grid lg:grid-cols-2 gap-5 mb-5">
      <SectionCard title="🤖 Por agente · hoy">
        <div className="space-y-2">{byAgent.length ? byAgent.map((a: any) => <div key={a.agent} className="rounded-xl border border-white/8 bg-white/[0.025] p-3 flex items-center justify-between gap-3">
          <div><div className="text-sm font-bold text-white capitalize">{a.agent}</div><div className="text-[10px] text-white/40 mt-1">{a.requests} eventos · {tokens(a.tokens)} tokens · {a.messaging} mensajes</div></div>
          <div className="font-display font-black text-neon">{usd(a.cost)}</div>
        </div>) : <p className="text-sm text-white/40">Todavía no hay eventos medidos hoy.</p>}</div>
      </SectionCard>

      <SectionCard title="⚡ Gemini · cuota observada">
        <div className="grid grid-cols-3 gap-2 text-center">
          {[['RPM', rpmObserved, geminiQuota?.rpm_limit], ['TPM', tpmObserved, geminiQuota?.tpm_limit], ['RPD', rpdObserved, geminiQuota?.rpd_limit]].map(([label, used, limit]: any) => <div key={label} className="rounded-xl border border-white/8 bg-white/[0.025] p-3">
            <div className="text-[10px] text-white/40">{label}</div><div className="mt-1 text-lg font-black text-white">{tokens(Number(used))}</div><div className="text-[9px] text-white/30">{limit ? `de ${tokens(Number(limit))}` : 'límite no configurado'}</div>
          </div>)}
        </div>
        <p className="mt-3 text-[10px] leading-4 text-white/35">El consumo se mide directamente desde cada respuesta de Gemini. El denominador oficial de cuota se muestra solo cuando está configurado/verificado; no inventamos límites.</p>
      </SectionCard>
    </div>

    <SectionCard title="💬 Costo por conversación · hoy">
      <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-xs">
        <thead className="text-white/35"><tr><th className="py-2">Cliente</th><th>Canal</th><th>Llamadas IA</th><th>Tokens</th><th>WA</th><th className="text-right">Costo estimado</th></tr></thead>
        <tbody>{byConversation.map((c: any) => <tr key={c.id} className="border-t border-white/6"><td className="py-3 font-semibold text-white">{c.name}</td><td className="text-white/50">{c.channel}</td><td>{c.calls}</td><td>{tokens(c.tokens)}</td><td>{c.messaging}</td><td className="text-right font-bold text-neon">{usd(c.cost)}</td></tr>)}</tbody>
      </table>{!byConversation.length && <p className="py-8 text-center text-white/40">Las próximas conversaciones de Remy comenzarán a aparecer aquí automáticamente.</p>}</div>
    </SectionCard>

    <div className="mt-5"><SectionCard title="🧾 Eventos recientes">
      <div className="space-y-2">{all.slice(0, 15).map((e: any) => <div key={e.id} className="rounded-xl border border-white/6 px-3 py-2.5 flex items-center justify-between gap-3 text-xs">
        <div className="min-w-0"><div className="font-semibold text-white">{e.agent} · {e.provider}{e.model ? ` · ${e.model}` : ''}</div><div className="text-[9px] text-white/35 mt-1">{unitNames[e.business_unit_id] || 'Synthetiq'} · {new Date(e.occurred_at).toLocaleString('es-CL')} · {e.billing_status}</div></div>
        <div className="text-right shrink-0"><div className="text-neon font-bold">{usd(Number(e.total_cost_usd || 0))}</div><div className="text-[9px] text-white/35">{tokens(Number(e.total_tokens || 0))} tok</div></div>
      </div>)}</div>
    </SectionCard></div>
  </div>;
}
