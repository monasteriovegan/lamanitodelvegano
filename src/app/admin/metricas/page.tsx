import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/supabase/require-role';
import { PageHeader } from '../_ui/AdminUI';
import { CustomerRepository } from '@/lib/repositories/customers-repository';
import { OrderRepository } from '@/lib/repositories/orders-repository';
import { getSchemaCapabilities } from '@/lib/repositories/schema-capabilities';

export const dynamic = 'force-dynamic';

const CHILE_TIME_ZONE = 'America/Santiago';
const fmt = (n: number) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
  }).format(n);

function chileDateKey(value: string | Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CHILE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(typeof value === 'string' ? new Date(value) : value);
}

export default async function MetricasPage() {
  await requireRole(['admin']);
  const db = createSupabaseServiceClient();
  const capabilities = getSchemaCapabilities();
  const now = new Date();
  const analyticsSince = new Date(Date.now() - 30 * 86400000).toISOString();

  // Last 6 months
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return {
      start: d,
      end: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59),
      label: d.toLocaleDateString('es-CL', { month: 'short', year: '2-digit' }),
    };
  });

  // Browser activity lives in analytics_events. Checkout/Purchase use the server outbox.
  const [allOrders, customers, browserResult, serverConversionResult] = await Promise.all([
    new OrderRepository(db, capabilities).list(),
    new CustomerRepository(db, capabilities).list(),
    capabilities.supportTables
      ? db
          .from('analytics_events')
          .select('event_name,event_params,page_path,session_id,created_at')
          .gte('created_at', analyticsSince)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    capabilities.supportTables
      ? db
          .from('conversion_events')
          .select('event_name,created_at,order_id,value,currency,status,source_channel')
          .in('event_name', ['InitiateCheckout', 'Purchase'])
          .gte('created_at', analyticsSince)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);

  const orders = allOrders;
  const browserEvents = browserResult.data || [];
  const rawServerEvents = serverConversionResult.data || [];

  // Paid orders (including shipped and completed as fallback)
  const paidOrders = orders.filter(
    o =>
      o.payment_status === 'paid' ||
      ['confirmed', 'processing', 'shipped', 'delivered'].includes(o.status)
  );

  // Sales per month
  const monthlyData = months.map(m => {
    const os = paidOrders.filter(o => {
      const d = new Date(o.created_at || o.createdAt);
      return d >= m.start && d <= m.end;
    });
    return {
      label: m.label,
      revenue: os.reduce((s, o) => s + Number(o.total || 0), 0),
      orders: os.length,
    };
  });

  const maxRevenue = Math.max(...monthlyData.map(m => m.revenue), 1);

  // Global KPIs
  const totalRevenue = paidOrders.reduce((s, o) => s + Number(o.total || 0), 0);
  const avgTicket = paidOrders.length ? totalRevenue / paidOrders.length : 0;
  const cancelRate = orders.length
    ? ((orders.filter(o => o.status === 'cancelled').length / orders.length) * 100).toFixed(1)
    : '0';

  // Aggregate Top Products from paid orders items jsonb list
  const prodMap: Record<string, { name: string; qty: number; rev: number }> = {};
  paidOrders.forEach(o => {
    const items = Array.isArray(o.items) ? o.items : [];
    items.forEach((item: any) => {
      const name = item.nombre || item.name || 'Desconocido';
      const qty = Number(item.qty || item.quantity || 1);
      const price = Number(item.precio || item.price || 0);

      if (!prodMap[name]) {
        prodMap[name] = { name, qty: 0, rev: 0 };
      }
      prodMap[name].qty += qty;
      prodMap[name].rev += price * qty;
    });
  });

  const topProducts = Object.values(prodMap)
    .sort((a, b) => b.rev - a.rev)
    .slice(0, 8);
  const maxProd = Math.max(...topProducts.map(p => p.rev), 1);

  // Top Customers
  const topCustomers = customers.slice(0, 5);

  // Canonical web funnel. Never trust a historical Purchase row's label alone:
  // confirm the linked order is actually a web order.
  const webOrderIds = new Set(orders.filter(o => o.source === 'web').map(o => Number(o.id)));
  const serverEvents = rawServerEvents.filter((event: any) => {
    if (event.event_name === 'InitiateCheckout') return event.source_channel === 'web';
    if (event.event_name === 'Purchase') {
      return event.status === 'sent' && webOrderIds.has(Number(event.order_id));
    }
    return false;
  });

  const EVENT_LABELS: Record<string, { label: string; color: string; icon: string }> = {
    PageView: { label: 'Visitas a páginas', color: '#74c69d', icon: '👁' },
    ViewContent: { label: 'Vistas de producto', color: '#60a5fa', icon: '👀' },
    AddToCart: { label: 'Agregados al carrito', color: '#f59e0b', icon: '🛒' },
    InitiateCheckout: { label: 'Inicios de checkout', color: '#8b5cf6', icon: '💳' },
    Purchase: { label: 'Compras web', color: '#00ffb3', icon: '✅' },
    Contact: { label: 'Contactos', color: '#f472b6', icon: '💬' },
  };

  const eventTotals: Record<string, number> = Object.fromEntries(
    Object.keys(EVENT_LABELS).map(key => [key, 0]),
  );

  // Navigation/action events are first-party browser observations.
  browserEvents.forEach((event: any) => {
    if (event.event_name === 'InitiateCheckout') return; // server checkout is authoritative
    if (EVENT_LABELS[event.event_name]) eventTotals[event.event_name] += 1;
  });
  // Checkout and Purchase are counted from the server-authoritative outbox.
  serverEvents.forEach((event: any) => {
    eventTotals[event.event_name] = (eventTotals[event.event_name] || 0) + 1;
  });

  const metricEvents = [
    ...browserEvents
      .filter((event: any) => event.event_name !== 'InitiateCheckout' && EVENT_LABELS[event.event_name])
      .map((event: any) => ({ event_name: event.event_name, created_at: event.created_at })),
    ...serverEvents.map((event: any) => ({ event_name: event.event_name, created_at: event.created_at })),
  ];

  const mDays: { label: string; date: string; counts: Record<string, number> }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    mDays.push({
      label: d.toLocaleDateString('es-CL', { timeZone: CHILE_TIME_ZONE, weekday: 'short', day: 'numeric' }),
      date: chileDateKey(d),
      counts: {},
    });
  }

  metricEvents.forEach((event: any) => {
    const day = mDays.find(d => d.date === chileDateKey(event.created_at));
    if (day) day.counts[event.event_name] = (day.counts[event.event_name] || 0) + 1;
  });

  const conversionEvents = metricEvents.filter((event: any) => event.event_name !== 'PageView');
  const maxDayTotal = Math.max(
    ...mDays.map(d =>
      Object.entries(d.counts)
        .filter(([key]) => key !== 'PageView')
        .reduce((sum, [, value]) => sum + value, 0)
    ),
    1
  );

  const webPurchaseValue = serverEvents
    .filter((event: any) => event.event_name === 'Purchase')
    .reduce((sum: number, event: any) => sum + Number(event.value || 0), 0);
  const checkoutToPurchaseRate = eventTotals.InitiateCheckout
    ? ((eventTotals.Purchase / eventTotals.InitiateCheckout) * 100).toFixed(1)
    : '0.0';

  const kpis = [
    { label: 'Ingresos Totales', value: fmt(totalRevenue), color: 'text-white' },
    { label: 'Pedidos Pagados', value: paidOrders.length, color: 'text-neon' },
    { label: 'Ticket Promedio', value: fmt(avgTicket), color: 'text-white' },
    { label: 'Tasa Cancelación', value: `${cancelRate}%`, color: Number(cancelRate) > 10 ? 'text-rojo' : 'text-neon' },
  ];

  return (
    <div className="max-w-[1000px] text-crema space-y-6">
      <PageHeader eyebrow="✦ Analítica" title="Métricas del Negocio" />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map(k => (
          <div key={k.label} className="bg-[#050e0a] border border-white/10 rounded-2xl p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted font-medium mb-1">{k.label}</div>
            <div className={`font-display font-bold text-2xl ${k.color}`}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Monthly Sales Graph */}
      <div className="bg-[#050e0a] border border-white/10 rounded-2xl p-6">
        <h3 className="font-display font-bold text-base text-white mb-6">Ingresos Mensuales — últimos 6 meses</h3>
        <div className="flex items-end gap-4 h-36">
          {monthlyData.map(m => (
            <div key={m.label} className="flex-1 flex flex-col items-center gap-2">
              <div className="font-mono text-xs text-neon">
                {m.revenue > 0 ? fmt(m.revenue).replace('$', '').trim() : '—'}
              </div>
              <div
                className="w-full rounded-t-lg transition-all"
                style={{
                  background: m.revenue > 0 ? 'linear-gradient(0deg, #1e3f20, #00ffb3)' : 'rgba(255,255,255,0.05)',
                  height: `${Math.max((m.revenue / maxRevenue) * 100, 6)}px`,
                  border: '1px solid rgba(0,255,179,0.2)',
                }}
              />
              <div className="text-xs text-muted font-medium">{m.label}</div>
              <div className="text-[10px] text-muted/65 font-mono">{m.orders} ped.</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top products */}
        <div className="bg-[#050e0a] border border-white/10 rounded-2xl p-5">
          <h3 className="font-display font-bold text-base text-white mb-4">Top Productos por Ingresos</h3>
          <div className="space-y-4">
            {topProducts.map((p, i) => (
              <div key={p.name}>
                <div className="flex justify-between text-xs mb-1">
                  <div className="text-white/90">
                    <span className="text-neon font-bold mr-1.5">{i + 1}.</span>
                    {p.name}
                  </div>
                  <div className="font-mono text-white font-bold">{fmt(p.rev)}</div>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      background: 'linear-gradient(90deg, #1e3f20, #00ffb3)',
                      width: `${(p.rev / maxProd) * 100}%`,
                    }}
                  />
                </div>
                <div className="text-[10px] text-muted mt-1">{p.qty} unidades vendidas</div>
              </div>
            ))}
            {!topProducts.length && <p className="text-sm text-muted">Sin datos de venta aún.</p>}
          </div>
        </div>

        {/* Top customers */}
        <div className="bg-[#050e0a] border border-white/10 rounded-2xl p-5 overflow-hidden">
          <h3 className="font-display font-bold text-base text-white mb-4">Clientes más Valiosos</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02] text-muted uppercase font-bold text-[9px] tracking-wider">
                  <th className="px-3 py-2.5">#</th>
                  <th className="px-3 py-2.5">Cliente</th>
                  <th className="px-3 py-2.5 text-center">Pedidos</th>
                  <th className="px-3 py-2.5 text-right">Total Gastado</th>
                </tr>
              </thead>
              <tbody>
                {topCustomers.map((c: any, i: number) => (
                  <tr key={c.id} className="border-b border-white/5 hover:bg-white/[0.01]">
                    <td className="px-3 py-3 text-neon font-bold font-mono">{i + 1}</td>
                    <td className="px-3 py-3 text-white">
                      <div>{c.nombre || 'Sin nombre'}</div>
                      <div className="text-[10px] text-muted mt-0.5">{c.email}</div>
                    </td>
                    <td className="px-3 py-3 text-center text-white/80">{c.total_orders || 0}</td>
                    <td className="px-3 py-3 text-right text-neon font-bold font-mono">{fmt(c.total_spent || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!topCustomers.length && (
              <p className="text-sm text-muted py-4 text-center">Aún no hay clientes registrados.</p>
            )}
          </div>
        </div>
      </div>

      {/* First-party + server conversion analytics */}
      <div className="border-t border-white/10 pt-6">
        <h2 className="font-display font-bold text-lg text-white mb-1">📊 Analítica de Conversión Web</h2>
        <p className="text-xs text-muted mb-2">
          Navegación medida directamente por La Manito; checkout y compras confirmados desde registros del servidor.
        </p>
        <p className="text-[10px] text-muted/70 mb-6">
          Las visitas, vistas de producto, carrito y contactos comienzan a acumularse desde la activación de esta medición interna. Checkout y Purchase conservan el historial server disponible.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          {Object.entries(EVENT_LABELS).map(([key, info]) => (
            <div key={key} className="bg-[#050e0a] border border-white/10 rounded-2xl p-4">
              <div className="text-[10px] uppercase tracking-wider text-muted font-medium mb-1">
                {info.icon} {info.label}
              </div>
              <div className="font-display font-bold text-2xl" style={{ color: info.color }}>
                {eventTotals[key] || 0}
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-[#050e0a] border border-white/10 rounded-2xl p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted font-medium mb-1">💰 Valor compras web</div>
            <div className="font-display font-bold text-xl text-neon">{fmt(webPurchaseValue)}</div>
          </div>
          <div className="bg-[#050e0a] border border-white/10 rounded-2xl p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted font-medium mb-1">📈 Checkout → compra</div>
            <div className="font-display font-bold text-xl text-white">{checkoutToPurchaseRate}%</div>
          </div>
        </div>

        {/* conversion timeline graph */}
        <div className="bg-[#050e0a] border border-white/10 rounded-2xl p-6 mb-6">
          <h3 className="font-display font-bold text-sm text-white mb-4">Eventos de conversión — últimos 7 días</h3>
          {conversionEvents.length === 0 ? (
            <p className="text-xs text-muted">
              Todavía no hay acciones de conversión first-party/server para este período. Las nuevas acciones web aparecerán aquí automáticamente.
            </p>
          ) : (
            <div className="flex items-end gap-4 h-32">
              {mDays.map(day => {
                const dayConversions = Object.entries(day.counts).filter(([key]) => key !== 'PageView');
                const total = dayConversions.reduce((sum, [, value]) => sum + value, 0);
                return (
                  <div key={day.date} className="flex-1 flex flex-col items-center gap-1.5">
                    <div className="font-mono text-[10px] text-neon">{total || ''}</div>
                    <div className="w-full flex flex-col-reverse h-20 bg-white/5 rounded-md overflow-hidden">
                      {dayConversions.map(([key, count]) => (
                        <div
                          key={key}
                          title={`${EVENT_LABELS[key]?.label || key}: ${count}`}
                          style={{
                            backgroundColor: EVENT_LABELS[key]?.color || '#a8a8a8',
                            height: `${(count / maxDayTotal) * 100}%`,
                          }}
                        />
                      ))}
                    </div>
                    <div className="text-[10px] text-muted font-medium">{day.label}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
