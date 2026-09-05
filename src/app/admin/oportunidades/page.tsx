import Link from 'next/link';
import { requireRole } from '@/lib/supabase/require-role';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { OpportunityActions } from './OpportunityActions';

function priorityMeta(priority: string) {
  if (priority === 'high') return { label: '🔥 Alta', cls: 'border-red-400/30 bg-red-400/10 text-red-200' };
  if (priority === 'medium') return { label: '🟡 Media', cls: 'border-amber-400/30 bg-amber-400/10 text-amber-200' };
  return { label: '⚪ Baja', cls: 'border-white/15 bg-white/5 text-white/60' };
}

function channelLabel(channel: string) {
  return channel === 'instagram' ? '🟣 Instagram' : channel === 'whatsapp' ? '🟢 WhatsApp' : '🌐 Web';
}

function when(value: string | null) {
  if (!value) return 'Sin hora recomendada';
  return new Date(value).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
}

export default async function SalesOpportunitiesPage() {
  await requireRole(['admin']);
  const db = createSupabaseServiceClient();
  const { data: opportunities, error } = await db.from('sales_opportunities')
    .select('*')
    .in('status', ['open', 'snoozed'])
    .order('score', { ascending: false })
    .order('last_activity_at', { ascending: false })
    .limit(200);
  if (error) throw error;

  const customerIds = Array.from(new Set((opportunities || []).map((row: any) => row.customer_id).filter(Boolean)));
  const [{ data: contacts }, { data: conversations }] = await Promise.all([
    customerIds.length ? db.from('omnichannel_contacts').select('id,nombre,display_name').in('id', customerIds) : Promise.resolve({ data: [] } as any),
    (opportunities || []).length ? db.from('conversations').select('id,external_conversation_id').in('id', (opportunities || []).map((row: any) => row.conversation_id)) : Promise.resolve({ data: [] } as any),
  ]);
  const contactById = new Map((contacts || []).map((row: any) => [String(row.id), row]));
  const conversationById = new Map((conversations || []).map((row: any) => [String(row.id), row]));
  const rows = opportunities || [];
  const high = rows.filter((row: any) => row.priority === 'high').length;
  const medium = rows.filter((row: any) => row.priority === 'medium').length;

  return (
    <div className="max-w-[980px] pb-12">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neon/70">Remy · modo copiloto</p>
          <h1 className="mt-1 font-display text-2xl font-bold text-white">🎯 Oportunidades de venta</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/55">Conversaciones que vale la pena retomar. Mientras la automatización proactiva esté apagada, Remy solo recomienda: tú decides qué enviar.</p>
        </div>
        <Link href="/admin/conversaciones" className="rounded-lg border border-white/15 px-3 py-2 text-xs text-white/75 hover:border-neon/40">Ver todas las conversaciones</Link>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3"><p className="text-xs text-white/45">Abiertas</p><p className="mt-1 text-xl font-bold text-white">{rows.length}</p></div>
        <div className="rounded-xl border border-red-400/15 bg-red-400/[0.04] p-3"><p className="text-xs text-white/45">Prioridad alta</p><p className="mt-1 text-xl font-bold text-red-200">{high}</p></div>
        <div className="rounded-xl border border-amber-400/15 bg-amber-400/[0.04] p-3"><p className="text-xs text-white/45">Prioridad media</p><p className="mt-1 text-xl font-bold text-amber-200">{medium}</p></div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-white/55">No hay oportunidades abiertas por ahora.</div>
      ) : (
        <div className="space-y-3">
          {rows.map((row: any) => {
            const priority = priorityMeta(row.priority);
            const contact = contactById.get(String(row.customer_id || '')) as any;
            const conversation = conversationById.get(String(row.conversation_id)) as any;
            const name = contact?.nombre || contact?.display_name || conversation?.external_conversation_id || 'Cliente';
            const context = row.product_context && typeof row.product_context === 'object' ? row.product_context : {};
            const productName = context.productName || context.cartItems?.[0]?.name || null;
            const linkedOrderId = context.linkedOrderId || null;
            return (
              <article key={row.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2 py-1 text-[11px] font-bold ${priority.cls}`}>{priority.label}</span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/70">{channelLabel(row.channel)}</span>
                      {row.source_type === 'ad' && <span className="rounded-full border border-fuchsia-400/25 bg-fuchsia-400/10 px-2 py-1 text-[11px] text-fuchsia-200">📣 Viene de anuncio</span>}
                    </div>
                    <h2 className="mt-2 text-base font-bold text-white">{name}</h2>
                    <p className="mt-1 text-sm text-white/60">{row.reason_summary}</p>
                  </div>
                  <div className="text-right text-xs text-white/45">
                    <p>Score {row.score}</p>
                    <p>{row.status === 'snoozed' ? 'Pospuesta' : 'Abierta'}</p>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 text-xs text-white/55 sm:grid-cols-2 lg:grid-cols-4">
                  <p><span className="text-white/35">Interés:</span> {productName || 'General'}</p>
                  <p><span className="text-white/35">Próxima acción:</span> {when(row.next_followup_at)}</p>
                  <p><span className="text-white/35">Seguimientos auto:</span> {row.followup_count}/2</p>
                  <p><span className="text-white/35">Origen:</span> {row.source_type === 'ad' ? (row.source_ad ? `Anuncio ${row.source_ad}` : 'Anuncio Meta') : row.source_type === 'organic' ? 'Orgánico' : 'No identificado'}</p>
                </div>

                <OpportunityActions id={row.id} initialMessage={row.recommended_message || 'Hola 🌱 Si todavía quieres comprar, te ayudo a continuar por aquí.'} />

                <div className="mt-3 flex flex-wrap gap-3 text-xs">
                  <Link href={`/admin/conversaciones?conversationId=${encodeURIComponent(row.conversation_id)}`} className="font-semibold text-neon hover:underline">Abrir conversación</Link>
                  {linkedOrderId && <Link href={`/admin/pedidos/${linkedOrderId}`} className="text-white/60 hover:text-white hover:underline">Ver pedido #{linkedOrderId}</Link>}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
