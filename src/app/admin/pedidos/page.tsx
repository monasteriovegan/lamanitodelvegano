import Link from 'next/link';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/supabase/require-role';
import type { OperationalStatus } from '@/types/domain';
import { OrderRepository } from '@/lib/repositories/orders-repository';

export const dynamic = 'force-dynamic';

const STATUS_LABELS: Record<OperationalStatus, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmado',
  processing: 'Procesando',
  shipped: 'Enviado',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

const CHANNEL_LABELS: Record<string, { label: string; icon: string; className: string }> = {
  instagram: { label: 'Instagram', icon: '◎', className: 'bg-fuchsia-500/10 text-fuchsia-200 border-fuchsia-500/30' },
  whatsapp: { label: 'WhatsApp', icon: '💬', className: 'bg-emerald-500/10 text-emerald-200 border-emerald-500/30' },
  web: { label: 'Web', icon: '🌐', className: 'bg-sky-500/10 text-sky-200 border-sky-500/30' },
  manual: { label: 'Manual', icon: '✎', className: 'bg-white/5 text-white/80 border-white/15' },
  conversation: { label: 'Conversación', icon: '💬', className: 'bg-white/5 text-white/80 border-white/15' },
};

function channelInfo(source: unknown) {
  const key = String(source || 'web').toLowerCase();
  return CHANNEL_LABELS[key] || { label: key || 'Web', icon: '•', className: 'bg-white/5 text-white/80 border-white/15' };
}

const STATUS_COLORS: Record<OperationalStatus, { bg: string; text: string; border: string }> = {
  pending: { bg: 'rgba(245,158,11,0.15)', text: '#f59e0b', border: 'rgba(245,158,11,0.3)' },
  confirmed: { bg: 'rgba(52,211,153,0.15)', text: '#34d399', border: 'rgba(52,211,153,0.3)' },
  processing: { bg: 'rgba(139,92,246,0.15)', text: '#a78bfa', border: 'rgba(139,92,246,0.3)' },
  shipped: { bg: 'rgba(56,189,248,0.15)', text: '#38bdf8', border: 'rgba(56,189,248,0.3)' },
  delivered: { bg: 'rgba(0,255,179,0.15)', text: '#00ffb3', border: 'rgba(0,255,179,0.3)' },
  cancelled: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444', border: 'rgba(239,68,68,0.3)' },
};

interface PageProps {
  searchParams: Promise<{ buscar?: string; status?: string }>;
}

export default async function AdminPedidosPage({ searchParams }: PageProps) {
  await requireRole(['admin', 'soporte', 'bodega']);
  const { buscar = '', status } = await searchParams;

  const supabase = createSupabaseServiceClient();
  const orderRepository = new OrderRepository(supabase);
  const [rawOrders, statusCountsRaw] = await Promise.all([
    orderRepository.list({ status }),
    orderRepository.list(),
  ]);
  const counts: Record<string, number> = {};
  let totalCount = 0;

  statusCountsRaw.forEach((row: { status: string }) => {
    if (row.status) {
      counts[row.status] = (counts[row.status] || 0) + 1;
      totalCount++;
    }
  });

  const buscarLower = buscar.toLowerCase().trim();
  const orders = rawOrders.filter((o: any) => {
    if (!buscarLower) return true;
    const numMatch = (o.order_number || o.id || '').toLowerCase().includes(buscarLower);
    const nameMatch = (o.customer_name || '').toLowerCase().includes(buscarLower);
    const emailMatch = (o.customer_email || '').toLowerCase().includes(buscarLower);
    const phoneMatch = (o.customer_phone || '').toLowerCase().includes(buscarLower);
    const zoneMatch = (o.shipping_zone_name || '').toLowerCase().includes(buscarLower);
    const channelMatch = String(o.source || '').toLowerCase().includes(buscarLower)
      || channelInfo(o.source).label.toLowerCase().includes(buscarLower);
    return numMatch || nameMatch || emailMatch || phoneMatch || zoneMatch || channelMatch;
  });

  const fmtCLP = (val: number) => `$${val.toLocaleString('es-CL')}`;

  return (
    <div className="max-w-[1200px] w-full">
      <div className="mb-6">
        <p className="text-[11px] tracking-[4px] text-neon uppercase font-display mb-1">
          ✦ Gestión Comercial & Logística
        </p>
        <h1 className="font-display font-bold text-3xl text-white">Pedidos</h1>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-6">
        <Link
          href="/admin/pedidos"
          className={`px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap border transition-all ${
            !status || status === 'todos'
              ? 'bg-[rgba(0,255,179,0.15)] border-neon text-neon'
              : 'bg-white/5 border-white/10 text-muted hover:text-white'
          }`}
        >
          Todos ({totalCount})
        </Link>

        {(Object.keys(STATUS_LABELS) as OperationalStatus[]).map((key) => {
          const count = counts[key] || 0;
          const isActive = status === key;
          const style = STATUS_COLORS[key];
          return (
            <Link
              key={key}
              href={`/admin/pedidos?status=${key}`}
              className="px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap border transition-all"
              style={{
                backgroundColor: isActive ? style.bg : 'rgba(255,255,255,0.03)',
                borderColor: isActive ? style.border : 'rgba(255,255,255,0.08)',
                color: isActive ? style.text : '#888888',
              }}
            >
              {STATUS_LABELS[key]} ({count})
            </Link>
          );
        })}
      </div>

      <form method="GET" action="/admin/pedidos" className="flex flex-wrap gap-2.5 mb-6">
        <input
          name="buscar"
          defaultValue={buscar}
          placeholder="Buscar por cliente, N° pedido, teléfono o canal..."
          className="flex-1 min-w-[280px] bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-neon"
        />
        {status && <input type="hidden" name="status" value={status} />}
        <button
          type="submit"
          className="bg-neon hover:bg-white text-[#020705] px-6 py-2 rounded-lg text-sm font-bold transition-all shadow-[0_0_10px_rgba(0,255,179,0.2)]"
        >
          Buscar
        </button>
        {(buscar || (status && status !== 'todos')) && (
          <Link
            href="/admin/pedidos"
            className="border border-white/10 hover:border-white/20 text-muted px-4 py-2 rounded-lg text-sm flex items-center hover:text-white transition-colors"
          >
            Limpiar filtros
          </Link>
        )}
      </form>

      <div className="hidden md:block bg-white/[0.02] border border-[rgba(0,255,179,0.12)] rounded-xl overflow-hidden mb-6">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[rgba(0,255,179,0.12)] bg-white/[0.02]">
              <th className="px-4 py-3 text-[10px] tracking-wider text-neon uppercase font-display">Número</th>
              <th className="px-4 py-3 text-[10px] tracking-wider text-neon uppercase font-display">Canal</th>
              <th className="px-4 py-3 text-[10px] tracking-wider text-neon uppercase font-display">Cliente</th>
              <th className="px-4 py-3 text-[10px] tracking-wider text-neon uppercase font-display">Total</th>
              <th className="px-4 py-3 text-[10px] tracking-wider text-neon uppercase font-display">Estado</th>
              <th className="px-4 py-3 text-[10px] tracking-wider text-neon uppercase font-display">Entrega</th>
              <th className="px-4 py-3 text-[10px] tracking-wider text-neon uppercase font-display">Fecha</th>
              <th className="px-4 py-3 text-[10px] tracking-wider text-neon uppercase font-display text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {orders.map((o: any) => {
              const opStatus = (o.status || 'pending') as OperationalStatus;
              const colorStyle = STATUS_COLORS[opStatus] || STATUS_COLORS.pending;
              const isTransferPending = o.payment_method === 'transfer' && o.payment_status !== 'paid';
              const channel = channelInfo(o.source);

              return (
                <tr key={o.id} className="hover:bg-white/[0.03] transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-neon font-semibold">
                    {o.order_number || `MAN-${o.id.substring(0, 8)}`}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border ${channel.className}`}>
                      <span aria-hidden="true">{channel.icon}</span>
                      {channel.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-white text-sm">{o.customer_name || 'Sin nombre'}</div>
                    <div className="text-xs text-muted">{o.customer_email || o.customer_phone || ''}</div>
                  </td>
                  <td className="px-4 py-3 font-bold text-white text-sm font-display">
                    {fmtCLP(o.total || 0)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className="text-[10px] font-mono px-2.5 py-0.5 rounded-full font-semibold border"
                        style={{
                          backgroundColor: colorStyle.bg,
                          color: colorStyle.text,
                          borderColor: colorStyle.border,
                        }}
                      >
                        {STATUS_LABELS[opStatus] || opStatus}
                      </span>
                      {isTransferPending && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          🏦 Confirmar pago
                        </span>
                      )}
                      {o.print_count > 0 && (
                        <span
                          className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold"
                          title={o.last_printed_at ? `Última impresión: ${new Date(o.last_printed_at).toLocaleString('es-CL')}` : 'Impreso'}
                        >
                          ✓ {o.print_count > 1 ? `Reimpreso (${o.print_count})` : 'Impreso'}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">
                    {o.delivery_date
                      ? new Date(o.delivery_date + 'T12:00:00').toLocaleDateString('es-CL')
                      : o.shipping_zone_name || '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted font-mono">
                    {new Date(o.created_at).toLocaleDateString('es-CL')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/pedidos/${o.id}`}
                      className="text-neon hover:text-white text-xs font-semibold transition-colors inline-flex items-center gap-1"
                    >
                      Ver →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {orders.length === 0 && (
          <div className="py-16 text-center text-muted text-sm">
            <span className="text-3xl block mb-2">📦</span>
            No hay pedidos que coincidan con la búsqueda o filtro seleccionado.
          </div>
        )}
      </div>

      <div className="block md:hidden flex flex-col gap-3">
        {orders.map((o: any) => {
          const opStatus = (o.status || 'pending') as OperationalStatus;
          const colorStyle = STATUS_COLORS[opStatus] || STATUS_COLORS.pending;
          const isTransferPending = o.payment_method === 'transfer' && o.payment_status !== 'paid';
          const channel = channelInfo(o.source);

          return (
            <div
              key={o.id}
              className="bg-white/[0.02] border border-[rgba(0,255,179,0.1)] rounded-xl p-4 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-bold text-neon text-sm">
                    {o.order_number || `MAN-${o.id.substring(0, 8)}`}
                  </span>
                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${channel.className}`}>
                    <span aria-hidden="true">{channel.icon}</span>
                    {channel.label}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  {o.print_count > 0 && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold">
                      ✓ {o.print_count > 1 ? `Reimpreso (${o.print_count})` : 'Impreso'}
                    </span>
                  )}
                  <span
                    className="text-[10px] font-mono px-2.5 py-0.5 rounded-full font-semibold border"
                    style={{
                      backgroundColor: colorStyle.bg,
                      color: colorStyle.text,
                      borderColor: colorStyle.border,
                    }}
                  >
                    {STATUS_LABELS[opStatus] || opStatus}
                  </span>
                </div>
              </div>

              <div>
                <div className="font-semibold text-white text-sm">{o.customer_name || 'Sin nombre'}</div>
                <div className="text-xs text-muted">{[o.customer_email, o.customer_phone].filter(Boolean).join(' · ')}</div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <span className="font-bold text-white text-base font-display">{fmtCLP(o.total || 0)}</span>
                <Link
                  href={`/admin/pedidos/${o.id}`}
                  className="bg-white/5 hover:bg-neon hover:text-[#020705] border border-white/10 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white transition-all"
                >
                  Gestionar →
                </Link>
              </div>

              {isTransferPending && (
                <div className="text-[11px] bg-purple-500/10 text-purple-300 border border-purple-500/20 px-3 py-1.5 rounded-lg">
                  🏦 Pago por transferencia pendiente de verificación
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
