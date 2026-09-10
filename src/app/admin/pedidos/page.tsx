import Link from 'next/link';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/supabase/require-role';
import type { OperationalStatus } from '@/types/domain';
import { OrderRepository } from '@/lib/repositories/orders-repository';
import {
  compareDeliveryDates,
  formatDeliveryDateChip,
  formatDeliveryDateLong,
  summarizeDeliveryDates,
} from '@/lib/orders/delivery-date';

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

function paymentMethodLabel(method: unknown) {
  const key = String(method || '').trim().toLowerCase();
  const labels: Record<string, string> = {
    transfer: 'Transferencia',
    mercadopago: 'Mercado Pago',
    flow: 'Flow',
    cash: 'Efectivo',
    card: 'Tarjeta',
    other: 'Otro',
    whatsapp: 'Por definir (WhatsApp)',
  };
  return labels[key] || (key ? key : 'Sin registrar');
}

const STATUS_COLORS: Record<OperationalStatus, { bg: string; text: string; border: string }> = {
  pending: { bg: 'rgba(245,158,11,0.15)', text: '#f59e0b', border: 'rgba(245,158,11,0.3)' },
  confirmed: { bg: 'rgba(52,211,153,0.15)', text: '#34d399', border: 'rgba(52,211,153,0.3)' },
  processing: { bg: 'rgba(139,92,246,0.15)', text: '#a78bfa', border: 'rgba(139,92,246,0.3)' },
  shipped: { bg: 'rgba(56,189,248,0.15)', text: '#38bdf8', border: 'rgba(56,189,248,0.3)' },
  delivered: { bg: 'rgba(0,255,179,0.15)', text: '#00ffb3', border: 'rgba(0,255,179,0.3)' },
  cancelled: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444', border: 'rgba(239,68,68,0.3)' },
};

type OrderQuery = {
  buscar?: string;
  status?: string;
  entrega?: string;
  ordenar?: string;
};

interface PageProps {
  searchParams: Promise<OrderQuery>;
}

function ordersHref(query: OrderQuery) {
  const params = new URLSearchParams();
  if (query.buscar) params.set('buscar', query.buscar);
  if (query.status && query.status !== 'todos') params.set('status', query.status);
  if (query.entrega) params.set('entrega', query.entrega);
  if (query.ordenar) params.set('ordenar', query.ordenar);
  const serialized = params.toString();
  return serialized ? `/admin/pedidos?${serialized}` : '/admin/pedidos';
}

function paymentBadge(status: unknown) {
  const value = String(status || 'pending').toLowerCase();
  const paid = value === 'paid';
  const labels: Record<string, string> = {
    paid: 'Pagado',
    pending: 'Pendiente',
    partial: 'Parcial',
    refunded: 'Reembolsado',
    failed: 'Fallido',
  };
  return {
    label: labels[value] || value,
    className: paid
      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
      : 'bg-amber-500/15 text-amber-200 border-amber-500/30',
  };
}

export default async function AdminPedidosPage({ searchParams }: PageProps) {
  const admin = await requireRole(['admin', 'soporte', 'bodega']);
  const { buscar = '', status, entrega = '', ordenar = '' } = await searchParams;

  const supabase = createSupabaseServiceClient();
  const orderRepository = new OrderRepository(supabase);
  const [rawOrders, allOrders] = await Promise.all([
    orderRepository.list({ status }),
    orderRepository.list(),
  ]);
  const counts: Record<string, number> = {};
  let totalCount = 0;

  allOrders.forEach((row: { status: string }) => {
    if (row.status) {
      counts[row.status] = (counts[row.status] || 0) + 1;
      totalCount++;
    }
  });

  const deliverySummary = summarizeDeliveryDates(allOrders);
  const buscarLower = buscar.toLowerCase().trim();
  const filteredOrders = rawOrders.filter((o: any) => {
    const dateMatches = !entrega
      || (entrega === 'sin-fecha' ? !o.delivery_date : o.delivery_date === entrega);
    if (!dateMatches) return false;
    if (!buscarLower) return true;
    const numMatch = (o.order_number || o.id || '').toLowerCase().includes(buscarLower);
    const nameMatch = (o.customer_name || '').toLowerCase().includes(buscarLower);
    const emailMatch = (o.customer_email || '').toLowerCase().includes(buscarLower);
    const phoneMatch = (o.customer_phone || '').toLowerCase().includes(buscarLower);
    const zoneMatch = (o.shipping_zone_name || '').toLowerCase().includes(buscarLower);
    const channelMatch = String(o.source || '').toLowerCase().includes(buscarLower)
      || channelInfo(o.source).label.toLowerCase().includes(buscarLower);
    const paymentMatch = String(o.payment_method || '').toLowerCase().includes(buscarLower)
      || paymentMethodLabel(o.payment_method).toLowerCase().includes(buscarLower);
    return numMatch || nameMatch || emailMatch || phoneMatch || zoneMatch || channelMatch || paymentMatch;
  });
  const orders = ordenar === 'entrega-asc'
    ? [...filteredOrders].sort(compareDeliveryDates)
    : filteredOrders;

  const fmtCLP = (val: number) => `$${val.toLocaleString('es-CL')}`;
  const hasFilters = Boolean(buscar || (status && status !== 'todos') || entrega || ordenar);

  return (
    <div className="max-w-[1200px] w-full">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <p className="text-[11px] tracking-[4px] text-neon uppercase font-display mb-1">✦ Gestión Comercial & Logística</p>
          <h1 className="font-display font-bold text-3xl text-white">Pedidos</h1>
        </div>
        {(admin.rol === 'admin' || admin.rol === 'soporte') && (
          <Link href="/admin/pedidos/nuevo" className="bg-neon hover:bg-white text-[#020705] px-5 py-2.5 rounded-lg text-sm font-bold transition-all shadow-[0_0_12px_rgba(0,255,179,0.25)]">
            + Nuevo pedido
          </Link>
        )}
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-4">
        <Link href={ordersHref({ buscar, entrega, ordenar })} className={`px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap border transition-all ${!status || status === 'todos' ? 'bg-[rgba(0,255,179,0.15)] border-neon text-neon' : 'bg-white/5 border-white/10 text-muted hover:text-white'}`}>Todos ({totalCount})</Link>
        {(Object.keys(STATUS_LABELS) as OperationalStatus[]).map((key) => {
          const count = counts[key] || 0;
          const isActive = status === key;
          const style = STATUS_COLORS[key];
          return (
            <Link key={key} href={ordersHref({ buscar, status: key, entrega, ordenar })} className="px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap border transition-all" style={{ backgroundColor: isActive ? style.bg : 'rgba(255,255,255,0.03)', borderColor: isActive ? style.border : 'rgba(255,255,255,0.08)', color: isActive ? style.text : '#888888' }}>
              {STATUS_LABELS[key]} ({count})
            </Link>
          );
        })}
      </div>

      <div className="mb-6 rounded-xl border border-white/10 bg-white/[0.02] p-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-[10px] font-display font-bold uppercase tracking-[2px] text-white/50">Jornadas de entrega</p>
          <Link href={ordersHref({ buscar, status, ordenar })} className={`text-[10px] font-bold ${!entrega ? 'text-neon' : 'text-white/45 hover:text-white'}`}>Todas</Link>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {deliverySummary.map(({ date, count }) => {
            const key = date || 'sin-fecha';
            const isActive = entrega === key;
            return (
              <Link
                key={key}
                href={ordersHref({ buscar, status, entrega: key, ordenar })}
                className={`whitespace-nowrap rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${isActive ? 'border-neon bg-neon/15 text-neon' : date ? 'border-white/10 bg-white/5 text-white/75 hover:border-white/25' : 'border-amber-400/25 bg-amber-400/10 text-amber-200 hover:border-amber-400/45'}`}
              >
                {date ? `📅 ${formatDeliveryDateChip(date)} · ${count}` : `⚠️ Sin fecha · ${count}`}
              </Link>
            );
          })}
        </div>
      </div>

      <form method="GET" action="/admin/pedidos" className="flex flex-wrap gap-2.5 mb-6">
        <input name="buscar" defaultValue={buscar} placeholder="Buscar por cliente, N° pedido, teléfono, canal o medio de pago..." className="flex-1 min-w-[260px] bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-neon" />
        <select name="ordenar" defaultValue={ordenar} className="bg-[#07100d] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-neon">
          <option value="">Más recientes</option>
          <option value="entrega-asc">Entrega más próxima</option>
        </select>
        {status && <input type="hidden" name="status" value={status} />}
        {entrega && <input type="hidden" name="entrega" value={entrega} />}
        <button type="submit" className="bg-neon hover:bg-white text-[#020705] px-6 py-2 rounded-lg text-sm font-bold transition-all shadow-[0_0_10px_rgba(0,255,179,0.2)]">Aplicar</button>
        {hasFilters && <Link href="/admin/pedidos" className="border border-white/10 hover:border-white/20 text-muted px-4 py-2 rounded-lg text-sm flex items-center hover:text-white transition-colors">Limpiar filtros</Link>}
      </form>

      <div className="hidden md:block bg-white/[0.02] border border-[rgba(0,255,179,0.12)] rounded-xl overflow-x-auto mb-6">
        <table className="w-full min-w-[1100px] text-left border-collapse">
          <thead>
            <tr className="border-b border-[rgba(0,255,179,0.12)] bg-white/[0.02]">
              <th className="px-3 py-3 text-[10px] tracking-wider text-neon uppercase font-display">Número</th>
              <th className="px-3 py-3 text-[10px] tracking-wider text-neon uppercase font-display">Cliente</th>
              <th className="px-3 py-3 text-[10px] tracking-wider text-neon uppercase font-display">Pago / medio</th>
              <th className="px-3 py-3 text-[10px] tracking-wider text-neon uppercase font-display">Canal</th>
              <th className="px-3 py-3 text-[10px] tracking-wider text-neon uppercase font-display">Entrega</th>
              <th className="px-3 py-3 text-[10px] tracking-wider text-neon uppercase font-display">Total</th>
              <th className="px-3 py-3 text-[10px] tracking-wider text-neon uppercase font-display">Estado</th>
              <th className="px-3 py-3 text-[10px] tracking-wider text-neon uppercase font-display">Creado</th>
              <th className="px-3 py-3 text-[10px] tracking-wider text-neon uppercase font-display text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {orders.map((o: any) => {
              const opStatus = (o.status || 'pending') as OperationalStatus;
              const colorStyle = STATUS_COLORS[opStatus] || STATUS_COLORS.pending;
              const isTransferPending = o.payment_method === 'transfer' && o.payment_status !== 'paid';
              const channel = channelInfo(o.source);
              const payment = paymentBadge(o.payment_status);
              return (
                <tr key={o.id} className="hover:bg-white/[0.03] transition-colors">
                  <td className="px-3 py-3 font-mono text-xs text-neon font-semibold">{o.order_number || `MAN-${o.id.substring(0, 8)}`}</td>
                  <td className="px-3 py-3"><div className="font-semibold text-white text-sm">{o.customer_name || 'Sin nombre'}</div><div className="text-xs text-muted">{o.customer_email || o.customer_phone || ''}</div></td>
                  <td className="px-3 py-3"><div className="flex flex-col items-start gap-1"><span className={`inline-flex text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border ${payment.className}`}>Pago: {payment.label}</span><span className="text-[10px] font-semibold text-white/70">Medio: {paymentMethodLabel(o.payment_method)}</span></div></td>
                  <td className="px-3 py-3"><span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border ${channel.className}`}><span aria-hidden="true">{channel.icon}</span>{channel.label}</span></td>
                  <td className="px-3 py-3 text-xs">
                    {o.delivery_date
                      ? <span className="font-semibold text-white">📅 {formatDeliveryDateLong(o.delivery_date)}</span>
                      : <span className="font-semibold text-amber-300">⚠️ Fecha pendiente</span>}
                  </td>
                  <td className="px-3 py-3 font-bold text-white text-sm font-display">{fmtCLP(o.total || 0)}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full font-semibold border" style={{ backgroundColor: colorStyle.bg, color: colorStyle.text, borderColor: colorStyle.border }}>{STATUS_LABELS[opStatus] || opStatus}</span>
                      {isTransferPending && <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">🏦 Confirmar pago</span>}
                      {o.print_count > 0 && <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold" title={o.last_printed_at ? `Última impresión: ${new Date(o.last_printed_at).toLocaleString('es-CL')}` : 'Impreso'}>✓ {o.print_count > 1 ? `Reimpreso (${o.print_count})` : 'Impreso'}</span>}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-xs text-muted font-mono">{new Date(o.created_at).toLocaleDateString('es-CL')}</td>
                  <td className="px-3 py-3 text-right"><Link href={`/admin/pedidos/${o.id}`} className="text-neon hover:text-white text-xs font-semibold transition-colors inline-flex items-center gap-1">Ver →</Link></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {orders.length === 0 && <div className="py-16 text-center text-muted text-sm"><span className="text-3xl block mb-2">📦</span>No hay pedidos que coincidan con la búsqueda o filtro seleccionado.</div>}
      </div>

      <div className="block md:hidden flex flex-col gap-3">
        {orders.map((o: any) => {
          const opStatus = (o.status || 'pending') as OperationalStatus;
          const colorStyle = STATUS_COLORS[opStatus] || STATUS_COLORS.pending;
          const isTransferPending = o.payment_method === 'transfer' && o.payment_status !== 'paid';
          const channel = channelInfo(o.source);
          const payment = paymentBadge(o.payment_status);
          return (
            <div key={o.id} className="bg-white/[0.02] border border-[rgba(0,255,179,0.1)] rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap"><span className="font-mono font-bold text-neon text-sm">{o.order_number || `MAN-${o.id.substring(0, 8)}`}</span><span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${channel.className}`}><span aria-hidden="true">{channel.icon}</span>{channel.label}</span></div>
                <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full font-semibold border" style={{ backgroundColor: colorStyle.bg, color: colorStyle.text, borderColor: colorStyle.border }}>{STATUS_LABELS[opStatus] || opStatus}</span>
              </div>
              <div><div className="font-semibold text-white text-sm">{o.customer_name || 'Sin nombre'}</div><div className="text-xs text-muted">{[o.customer_email, o.customer_phone].filter(Boolean).join(' · ')}</div></div>
              <div className={`rounded-lg border px-3 py-2 text-xs font-bold ${o.delivery_date ? 'border-neon/20 bg-neon/[0.06] text-white' : 'border-amber-400/25 bg-amber-400/10 text-amber-200'}`}>
                {o.delivery_date ? `📅 Entrega: ${formatDeliveryDateLong(o.delivery_date)}` : '⚠️ Fecha de entrega pendiente'}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex flex-col items-start gap-1"><span className={`inline-flex text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border ${payment.className}`}>Pago: {payment.label}</span><span className="text-[10px] font-semibold text-white/70">Medio: {paymentMethodLabel(o.payment_method)}</span></div>{o.print_count > 0 && <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold">✓ {o.print_count > 1 ? `Reimpreso (${o.print_count})` : 'Impreso'}</span>}</div>
              <div className="flex items-center justify-between pt-2 border-t border-white/5"><span className="font-bold text-white text-base font-display">{fmtCLP(o.total || 0)}</span><Link href={`/admin/pedidos/${o.id}`} className="bg-white/5 hover:bg-neon hover:text-[#020705] border border-white/10 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white transition-all">Gestionar →</Link></div>
              {isTransferPending && <div className="text-[11px] bg-purple-500/10 text-purple-300 border border-purple-500/20 px-3 py-1.5 rounded-lg">🏦 Pago por transferencia pendiente de verificación</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
