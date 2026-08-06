import Link from 'next/link';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/supabase/require-role';
import { Badge } from '../_ui/AdminUI';
import type { EstadoPedido } from '@/types/domain';

export const dynamic = 'force-dynamic';

const ESTADOS: EstadoPedido[] = ['Pendiente', 'Pagado', 'Despachado', 'Completado', 'Cancelado', 'WhatsApp'];

const ESTADO_COLOR: Record<EstadoPedido, string> = {
  Pendiente: 'bg-[rgba(245,158,11,0.15)] text-am border-[rgba(245,158,11,0.3)]',
  Pagado: 'bg-[rgba(0,255,179,0.15)] text-neon border-[rgba(0,255,179,0.3)]',
  Despachado: 'bg-[rgba(0,158,227,0.15)] text-mp border-[rgba(0,158,227,0.3)]',
  Completado: 'bg-[rgba(82,183,136,0.15)] text-v4 border-[rgba(82,183,136,0.3)]',
  Cancelado: 'bg-[rgba(239,68,68,0.15)] text-rojo border-[rgba(239,68,68,0.3)]',
  WhatsApp: 'bg-[rgba(37,211,102,0.15)] text-wa border-[rgba(37,211,102,0.3)]',
};

const PAGO_LABELS: Record<string, string> = {
  mercadopago: '💳 Mercado Pago',
  flow: '💵 Flow',
  whatsapp: '💬 WhatsApp',
};

interface PageProps {
  searchParams: Promise<{ buscar?: string; estado?: string }>;
}

export default async function AdminPedidosPage({ searchParams }: PageProps) {
  await requireRole(['admin', 'soporte', 'bodega']);
  const { buscar = '', estado = 'Todos' } = await searchParams;

  const supabase = createSupabaseServiceClient();
  let query = supabase
    .from('pedidos')
    .select('*')
    .order('createdAt', { ascending: false });

  if (estado !== 'Todos') {
    query = query.eq('status', estado);
  }

  const { data: pedidos } = await query.limit(200);

  const buscarLower = buscar.toLowerCase().trim();
  const pedidosFiltrados = (pedidos || []).filter((p) => {
    if (!buscarLower) return true;
    const idMatch = p.id.toLowerCase().includes(buscarLower);
    const nombreMatch = p.cliente?.nombre?.toLowerCase().includes(buscarLower);
    const emailMatch = p.cliente?.email?.toLowerCase().includes(buscarLower);
    const telefonoMatch = p.cliente?.telefono?.toLowerCase().includes(buscarLower);
    const direccionMatch = p.cliente?.direccion?.toLowerCase().includes(buscarLower);
    const zonaMatch = p.zonaEnvio?.toLowerCase().includes(buscarLower);

    return idMatch || nombreMatch || emailMatch || telefonoMatch || direccionMatch || zonaMatch;
  });

  return (
    <div className="max-w-[900px]">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display font-bold text-xl text-white">🧾 Pedidos</h1>
        <Badge tono="neon">{pedidosFiltrados.length} pedidos encontrados</Badge>
      </div>

      {/* Buscador y Filtros */}
      <form method="GET" action="/admin/pedidos" className="flex flex-wrap gap-2.5 mb-6">
        <input
          name="buscar"
          defaultValue={buscar}
          placeholder="Buscar por cliente, ID, comuna, teléfono..."
          className="flex-1 min-w-[240px] bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-neon focus:ring-1 focus:ring-neon"
        />

        <select
          name="estado"
          defaultValue={estado}
          className="bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-neon"
        >
          <option value="Todos" className="bg-[#030907]">Todos los estados</option>
          {ESTADOS.map((e) => (
            <option key={e} value={e} className="bg-[#030907]">
              {e}
            </option>
          ))}
        </select>

        <button type="submit" className="bg-neon hover:bg-white text-[#020705] px-5 py-2 rounded-lg text-sm font-bold transition-all shadow-[0_0_10px_rgba(0,255,179,0.2)]">
          Filtrar
        </button>

        {(buscar || estado !== 'Todos') && (
          <Link
            href="/admin/pedidos"
            className="border border-white/10 hover:border-white/20 text-muted px-4 py-2 rounded-lg text-sm flex items-center hover:text-white transition-colors"
          >
            Limpiar filtros
          </Link>
        )}
      </form>

      {/* Lista de Pedidos */}
      <div className="flex flex-col gap-3">
        {pedidosFiltrados.map((p) => (
          <div
            key={p.id}
            className="bg-white/[0.02] hover:bg-white/[0.04] border border-[rgba(0,255,179,0.08)] rounded-xl p-4.5 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap mb-1">
                <span className="font-semibold text-white text-sm">
                  #{p.id.substring(0, 8).toUpperCase()}
                </span>
                <span className="text-xs text-muted">·</span>
                <span className="font-medium text-texto text-sm">
                  {p.cliente?.nombre || 'Sin nombre'}
                </span>
                <span className="text-xs text-muted">·</span>
                <span className="text-xs text-muted">
                  {new Date(p.createdAt).toLocaleDateString('es-CL')} {new Date(p.createdAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              <div className="text-xs text-muted flex flex-wrap gap-x-3 gap-y-1 mb-2.5">
                <span>📞 {p.cliente?.telefono}</span>
                {p.cliente?.email && <span>✉️ {p.cliente.email}</span>}
                {p.zonaEnvio && <span>🚚 {p.zonaEnvio}</span>}
              </div>

              {/* Items preview */}
              <div className="flex flex-wrap gap-1.5">
                {(p.items as { nombre: string; qty: number }[]).map((item, idx) => (
                  <span key={idx} className="text-[10px] bg-white/5 border border-white/5 px-2 py-0.5 rounded-full text-white/70">
                    {item.qty}× {item.nombre}
                  </span>
                ))}
              </div>
            </div>

            {/* Metricas de total y control de estado */}
            <div className="flex items-center justify-between md:justify-end gap-5 border-t border-white/5 md:border-t-0 pt-3 md:pt-0">
              <div className="md:text-right">
                <p className="font-bold text-neon text-lg font-display">${p.total.toLocaleString('es-CL')}</p>
                <p className="text-[10px] text-muted">{PAGO_LABELS[p.metodoPago] || p.metodoPago}</p>
              </div>

              <div className="flex items-center gap-3">
                <span className={`text-[11px] px-2.5 py-1 rounded-full font-semibold border ${ESTADO_COLOR[p.status as EstadoPedido] || 'bg-white/5 text-muted'}`}>
                  {p.status}
                </span>

                <Link
                  href={`/admin/pedidos/${p.id}`}
                  className="bg-white/5 hover:bg-neon hover:text-[#020705] border border-white/10 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white transition-all"
                >
                  Gestionar →
                </Link>
              </div>
            </div>
          </div>
        ))}

        {pedidosFiltrados.length === 0 && (
          <div className="bg-white/[0.01] border border-dashed border-white/10 rounded-2xl py-12 text-center text-muted text-sm">
            <span className="text-3xl block mb-2">📦</span>
            No se encontraron pedidos que coincidan con la búsqueda.
          </div>
        )}
      </div>
    </div>
  );
}
