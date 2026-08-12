import Link from 'next/link';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { PageHeader, StatCard, SectionCard, EmptyState, Badge } from './_ui/AdminUI';
import type { EstadoPedido } from '@/types/domain';
import { OrderRepository } from '@/lib/repositories/orders-repository';
import { CustomerRepository } from '@/lib/repositories/customers-repository';

export const dynamic = 'force-dynamic';

const ESTADO_TONO: Record<EstadoPedido, 'neutro' | 'neon' | 'rojo' | 'am'> = {
  Pendiente: 'am',
  Pagado: 'neon',
  Despachado: 'neon',
  Completado: 'neutro',
  Cancelado: 'rojo',
  WhatsApp: 'neutro',
};

const ESTADO_LABEL: Record<EstadoPedido, string> = {
  Pendiente: 'Pendiente ⏳',
  Pagado: 'Pagado 🟢',
  Despachado: 'Despachado 🚚',
  Completado: 'Entregado ✅',
  Cancelado: 'Cancelado ❌',
  WhatsApp: 'WhatsApp 💬',
};

const OPERATIONAL_TO_LEGACY: Record<string, EstadoPedido> = {
  pending: 'Pendiente', confirmed: 'Pagado', processing: 'Pagado',
  shipped: 'Despachado', delivered: 'Completado', cancelled: 'Cancelado',
};

function saludo(): string {
  const hora = new Date().getHours();
  if (hora < 12) return 'Buenos días';
  if (hora < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

interface PageProps {
  searchParams: Promise<{ rango?: string }>;
}

export default async function AdminDashboardPage({ searchParams }: PageProps) {
  const { rango = 'mes' } = await searchParams;
  const supabase = createSupabaseServiceClient();

  const ahora = new Date();
  let inicio = new Date();

  if (rango === 'hoy') {
    inicio.setHours(0, 0, 0, 0);
  } else if (rango === 'mes') {
    inicio.setDate(1);
    inicio.setHours(0, 0, 0, 0);
  } else if (rango === 'año') {
    inicio.setMonth(0, 1);
    inicio.setHours(0, 0, 0, 0);
  } else {
    // histórico: 2000-01-01
    inicio = new Date('2000-01-01');
  }

  const orderRepository = new OrderRepository(supabase);
  const customerRepository = new CustomerRepository(supabase);
  const [orders, recent, customers, { data: lowStock }] = await Promise.all([
    orderRepository.list({ createdAfter: inicio.toISOString() }),
    orderRepository.list({ limit: 6 }),
    customerRepository.list(),
    supabase
      .from('productos')
      .select('id, nombre, stock, maneja_stock, activo')
      .eq('maneja_stock', true)
      .eq('activo', true)
      .lte('stock', 3)
  ]);
  const cCount = customers.length;

  const allOrders = orders;
  
  // Filtrar pedidos pagados/completados para el cálculo de ingresos
  const paidOrders = allOrders.filter((o) => ['confirmed', 'processing', 'shipped', 'delivered'].includes(o.status));
  const ventasPeriodo = paidOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const totalPedidos = allOrders.length;
  const ticketPromedio = paidOrders.length > 0 ? Math.round(ventasPeriodo / paidOrders.length) : 0;

  // Distribución de estados
  const statusCounts: Record<EstadoPedido, number> = {
    Pendiente: 0,
    Pagado: 0,
    Despachado: 0,
    Completado: 0,
    Cancelado: 0,
    WhatsApp: 0,
  };

  allOrders.forEach((o) => {
    const status = OPERATIONAL_TO_LEGACY[o.status] || 'Pendiente';
    if (statusCounts[status] !== undefined) {
      statusCounts[status]++;
    }
  });

  // Top productos más vendidos (agregado localmente sobre los pedidos cargados)
  const topProductsMap: Record<string, { nombre: string; qty: number; total: number }> = {};
  allOrders.forEach((o) => {
    if (o.status !== 'cancelled') {
      const items = (o.items || []) as { productoId: string; nombre: string; qty: number; precio: number }[];
      items.forEach((item) => {
        const id = item.productoId;
        if (!id) return;
        if (!topProductsMap[id]) {
          topProductsMap[id] = { nombre: item.nombre, qty: 0, total: 0 };
        }
        topProductsMap[id].qty += item.qty || 0;
        topProductsMap[id].total += (item.qty || 0) * (item.precio || 0);
      });
    }
  });

  const topProducts = Object.values(topProductsMap)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  const ranges = [
    { key: 'hoy', label: 'Hoy' },
    { key: 'mes', label: 'Este Mes' },
    { key: 'año', label: 'Este Año' },
    { key: 'historico', label: 'Histórico' },
  ];

  return (
    <div>
      <PageHeader
        eyebrow={ahora.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })}
        title={`${saludo()} 🌱`}
        action={
          <div className="flex gap-1.5 bg-white/5 border border-white/10 rounded-xl p-1 shrink-0">
            {ranges.map((r) => (
              <Link
                key={r.key}
                href={`/admin?rango=${r.key}`}
                className={`text-xs px-3.5 py-1.5 rounded-lg font-semibold transition-all ${
                  rango === r.key
                    ? 'bg-neon text-[#020705] shadow-[0_0_10px_rgba(0,255,179,0.3)]'
                    : 'text-muted hover:text-white'
                }`}
              >
                {r.label}
              </Link>
            ))}
          </div>
        }
      />

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Ventas del período" value={`$${ventasPeriodo.toLocaleString('es-CL')}`} accento="neon" />
        <StatCard label="Cantidad pedidos" value={String(totalPedidos)} accento="gold" />
        <StatCard label="Ticket promedio" value={`$${ticketPromedio.toLocaleString('es-CL')}`} accento="am" />
        <StatCard label="Clientes totales" value={String(cCount || 0)} accento="neon" />
      </div>

      {/* Operational Breakdown */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        {(Object.keys(statusCounts) as EstadoPedido[]).map((status) => {
          const count = statusCounts[status];
          const hasCount = count > 0;
          return (
            <div
              key={status}
              className={`border rounded-xl p-3.5 text-center transition-all ${
                hasCount
                  ? 'bg-white/[0.04] border-[rgba(0,255,179,0.2)] shadow-[0_2px_10px_rgba(0,255,179,0.02)]'
                  : 'bg-white/[0.01] border-white/5 opacity-50'
              }`}
            >
              <p className="text-[10px] uppercase tracking-wider text-muted font-bold truncate">
                {ESTADO_LABEL[status].split(' ')[0]}
              </p>
              <p
                className={`text-xl font-bold font-display mt-1 ${
                  hasCount ? 'text-neon font-black' : 'text-texto/60'
                }`}
              >
                {count}
              </p>
            </div>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Orders */}
        <div className="lg:col-span-2">
          <SectionCard
            title="Pedidos recientes"
            action={
              <Link href="/admin/pedidos" className="text-xs text-neon font-semibold hover:underline">
                Ver todos →
              </Link>
            }
          >
            {recent.length === 0 ? (
              <EmptyState emoji="📦" texto="Todavía no hay pedidos." />
            ) : (
              <div className="flex flex-col gap-2.5">
                {recent.map((p) => (
                  <Link
                    key={p.id}
                    href={`/admin/pedidos/${p.id}`}
                    className="flex items-center justify-between gap-3 bg-white/[0.02] hover:bg-white/[0.05] transition-colors rounded-xl px-4 py-3 border border-white/5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        #{p.id.substring(0, 6).toUpperCase()} · {p.customer_name || 'Sin nombre'}
                      </p>
                      <p className="text-xs text-muted">
                        {p.metodoPago === 'whatsapp' ? '💬 WhatsApp' : '🌐 Web'} ·{' '}
                        {new Date(p.created_at).toLocaleDateString('es-CL')}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm font-bold text-neon">${(p.total || 0).toLocaleString('es-CL')}</span>
                      <Badge tono={ESTADO_TONO[OPERATIONAL_TO_LEGACY[p.status] || 'Pendiente'] || 'neutro'}>{OPERATIONAL_TO_LEGACY[p.status] || p.status}</Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        {/* Sidebar Cards */}
        <div className="flex flex-col gap-6">
          {/* Top Selling Products */}
          <SectionCard title="🔥 Más vendidos">
            {topProducts.length === 0 ? (
              <EmptyState emoji="📈" texto="No hay registros de productos vendidos en este período." />
            ) : (
              <div className="flex flex-col gap-2.5">
                {topProducts.map((p, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-sm bg-white/[0.01] border border-white/5 rounded-xl px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-white font-medium truncate text-xs">{p.nombre}</p>
                      <p className="text-[10px] text-muted">${p.total.toLocaleString('es-CL')} generado</p>
                    </div>
                    <Badge tono="neon">{p.qty} u.</Badge>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Low Stock Alerts */}
          <SectionCard title="⚠️ Stock bajo">
            {!lowStock || lowStock.length === 0 ? (
              <EmptyState emoji="✅" texto="Todo el inventario está bien." />
            ) : (
              <div className="flex flex-col gap-2">
                {lowStock.slice(0, 5).map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <span className="text-texto truncate text-xs">{p.nombre}</span>
                    <Badge tono="rojo">{p.stock ?? 0} u.</Badge>
                  </div>
                ))}
                <Link href="/admin/productos" className="text-xs text-neon font-semibold hover:underline mt-2 inline-block">
                  Reponer stock en catálogo →
                </Link>
              </div>
            )}
          </SectionCard>

          {/* Quick Access */}
          <SectionCard title="Accesos rápidos">
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/admin/productos/nuevo"
                className="text-xs bg-white/[0.03] hover:bg-neon hover:text-[#020705] border border-white/5 rounded-lg px-3 py-2.5 text-texto font-medium transition-colors"
              >
                🌿 Nuevo producto
              </Link>
              <Link
                href="/admin/clientes"
                className="text-xs bg-white/[0.03] hover:bg-neon hover:text-[#020705] border border-white/5 rounded-lg px-3 py-2.5 text-texto font-medium transition-colors"
              >
                👥 Clientes CRM
              </Link>
              <Link
                href="/admin/entregas"
                className="text-xs bg-white/[0.03] hover:bg-neon hover:text-[#020705] border border-white/5 rounded-lg px-3 py-2.5 text-texto font-medium transition-colors"
              >
                📅 Config. despacho
              </Link>
              <Link
                href="/admin/cupones"
                className="text-xs bg-white/[0.03] hover:bg-neon hover:text-[#020705] border border-white/5 rounded-lg px-3 py-2.5 text-texto font-medium transition-colors"
              >
                🎟️ Crear cupón
              </Link>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
