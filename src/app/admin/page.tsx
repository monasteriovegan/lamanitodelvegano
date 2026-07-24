import Link from 'next/link';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { PageHeader, StatCard, SectionCard, EmptyState, Badge } from './_ui/AdminUI';
import type { EstadoPedido } from '@/types/domain';

export const dynamic = 'force-dynamic';

const ESTADO_TONO: Record<EstadoPedido, 'neutro' | 'neon' | 'rojo' | 'am'> = {
  Pendiente: 'am',
  Pagado: 'neon',
  Despachado: 'neon',
  Completado: 'neutro',
  Cancelado: 'rojo',
  WhatsApp: 'neutro',
};

function saludo(): string {
  const hora = new Date().getHours();
  if (hora < 12) return 'Buenos días';
  if (hora < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

export default async function AdminDashboardPage() {
  const supabase = createSupabaseServiceClient();

  const inicioHoy = new Date();
  inicioHoy.setHours(0, 0, 0, 0);

  const [{ data: pedidosHoy }, { data: pedidosRecientes }, { data: pendientes }, { data: productos }] =
    await Promise.all([
      supabase.from('pedidos').select('total').gte('createdAt', inicioHoy.toISOString()),
      supabase.from('pedidos').select('*').order('createdAt', { ascending: false }).limit(6),
      supabase.from('pedidos').select('id').eq('status', 'Pendiente'),
      supabase.from('productos').select('id, nombre, stock, maneja_stock, activo').eq('maneja_stock', true),
    ]);

  const ventasHoy = (pedidosHoy || []).reduce((sum, p) => sum + (p.total || 0), 0);
  const cantidadPedidosHoy = pedidosHoy?.length || 0;
  const pedidosPendientes = pendientes?.length || 0;
  const stockBajo = (productos || []).filter((p) => p.activo && (p.stock ?? 0) <= 3);

  return (
    <div>
      <PageHeader
        eyebrow={new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })}
        title={`${saludo()} 🌱`}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Ventas de hoy" value={`$${ventasHoy.toLocaleString('es-CL')}`} accento="neon" />
        <StatCard label="Pedidos de hoy" value={String(cantidadPedidosHoy)} accento="gold" />
        <StatCard
          label="Pendientes de gestionar"
          value={String(pedidosPendientes)}
          accento={pedidosPendientes > 0 ? 'am' : 'neon'}
          hint={pedidosPendientes > 0 ? 'Revisar en Pedidos' : undefined}
        />
        <StatCard
          label="Stock bajo"
          value={String(stockBajo.length)}
          accento={stockBajo.length > 0 ? 'rojo' : 'neon'}
          hint={stockBajo.length > 0 ? 'Revisar en Productos' : 'Todo con stock ok'}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <SectionCard
            title="Pedidos recientes"
            action={
              <Link href="/admin/pedidos" className="text-xs text-neon font-semibold hover:underline">
                Ver todos →
              </Link>
            }
          >
            {!pedidosRecientes || pedidosRecientes.length === 0 ? (
              <EmptyState emoji="📦" texto="Todavía no hay pedidos." />
            ) : (
              <div className="flex flex-col gap-2.5">
                {pedidosRecientes.map((p) => (
                  <Link
                    key={p.id}
                    href="/admin/pedidos"
                    className="flex items-center justify-between gap-3 bg-white/[0.02] hover:bg-white/[0.05] transition-colors rounded-xl px-4 py-3 border border-white/5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        #{p.id.substring(0, 6).toUpperCase()} · {p.cliente?.nombre || 'Sin nombre'}
                      </p>
                      <p className="text-xs text-muted">{new Date(p.createdAt).toLocaleString('es-CL')}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm font-bold text-neon">${(p.total || 0).toLocaleString('es-CL')}</span>
                      <Badge tono={ESTADO_TONO[p.status as EstadoPedido] || 'neutro'}>{p.status}</Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        <div className="flex flex-col gap-4">
          <SectionCard title="⚠️ Stock bajo">
            {stockBajo.length === 0 ? (
              <EmptyState emoji="✅" texto="Todo el inventario está bien." />
            ) : (
              <div className="flex flex-col gap-2">
                {stockBajo.slice(0, 6).map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <span className="text-texto truncate">{p.nombre}</span>
                    <Badge tono="rojo">{p.stock ?? 0} unid.</Badge>
                  </div>
                ))}
                <Link href="/admin/productos" className="text-xs text-neon font-semibold hover:underline mt-1">
                  Reponer stock →
                </Link>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Accesos rápidos">
            <div className="grid grid-cols-2 gap-2">
              <Link href="/admin/productos" className="text-xs bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 rounded-lg px-3 py-2.5 text-texto transition-colors">
                🌿 Nuevo producto
              </Link>
              <Link href="/admin/destacados" className="text-xs bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 rounded-lg px-3 py-2.5 text-texto transition-colors">
                ⭐ Destacados
              </Link>
              <Link href="/admin/promo-flyer" className="text-xs bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 rounded-lg px-3 py-2.5 text-texto transition-colors">
                📢 Promo Flyer
              </Link>
              <Link href="/admin/cupones" className="text-xs bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 rounded-lg px-3 py-2.5 text-texto transition-colors">
                🎟️ Nuevo cupón
              </Link>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
