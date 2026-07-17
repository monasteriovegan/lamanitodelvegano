import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { cambiarEstadoPedido } from './actions';
import type { EstadoPedido } from '@/types/domain';

const ESTADOS: EstadoPedido[] = ['Pendiente', 'Pagado', 'Despachado', 'Completado', 'Cancelado', 'WhatsApp'];

const ESTADO_COLOR: Record<EstadoPedido, string> = {
  Pendiente: 'bg-[rgba(245,158,11,0.15)] text-am',
  Pagado: 'bg-[rgba(0,255,179,0.15)] text-neon',
  Despachado: 'bg-[rgba(0,158,227,0.15)] text-mp',
  Completado: 'bg-[rgba(82,183,136,0.15)] text-v4',
  Cancelado: 'bg-[rgba(239,68,68,0.15)] text-rojo',
  WhatsApp: 'bg-[rgba(37,211,102,0.15)] text-wa',
};

export default async function AdminPedidosPage() {
  const supabase = createSupabaseServiceClient();
  const { data: pedidos } = await supabase
    .from('pedidos')
    .select('*')
    .order('createdAt', { ascending: false })
    .limit(100);

  return (
    <div>
      <h1 className="font-display font-bold text-xl text-white mb-6">🧾 Pedidos</h1>

      <div className="flex flex-col gap-3">
        {(pedidos || []).map((p) => (
          <div key={p.id} className="bg-white/[0.03] border border-[rgba(0,255,179,0.1)] rounded-xl p-4">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <p className="font-semibold text-white text-sm">
                  #{p.id.substring(0, 6).toUpperCase()} — {p.cliente?.nombre}
                </p>
                <p className="text-xs text-muted">
                  {p.cliente?.telefono} · {p.cliente?.email || 'sin email'}
                </p>
                <p className="text-xs text-white/50 mt-1">{p.cliente?.direccion}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-neon text-base">${p.total.toLocaleString('es-CL')}</p>
                <p className="text-[10px] text-muted">{new Date(p.createdAt).toLocaleString('es-CL')}</p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {(p.items as { nombre: string; qty: number }[]).map((item, idx) => (
                <span key={idx} className="text-[11px] bg-white/5 px-2 py-1 rounded-full text-white/70">
                  {item.qty}× {item.nombre}
                </span>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between">
              <span className={`text-[11px] px-2.5 py-1 rounded-full font-semibold ${ESTADO_COLOR[p.status as EstadoPedido]}`}>
                {p.status}
              </span>
              <form
                action={async (formData) => {
                  'use server';
                  await cambiarEstadoPedido(p.id, formData.get('estado') as EstadoPedido);
                }}
              >
                <select
                  name="estado"
                  defaultValue={p.status}
                  onChange={(e) => e.currentTarget.form?.requestSubmit()}
                  className="bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-2 py-1 text-xs text-white"
                >
                  {ESTADOS.map((estado) => (
                    <option key={estado} value={estado} className="bg-[#0d1e16]">
                      {estado}
                    </option>
                  ))}
                </select>
              </form>
            </div>
          </div>
        ))}

        {(!pedidos || pedidos.length === 0) && (
          <p className="text-center text-muted text-sm py-10">Todavía no hay pedidos.</p>
        )}
      </div>
    </div>
  );
}
