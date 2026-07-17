import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { crearCupon, toggleCuponActivo, eliminarCupon } from './actions';

const TIPO_LABELS: Record<string, string> = {
  fijo: 'Monto fijo',
  porcentaje: 'Porcentaje',
  bogo: '2x1 (BOGO)',
  regalo: 'Regalo',
};

export default async function AdminCuponesPage() {
  const supabase = createSupabaseServiceClient();
  const { data: cupones } = await supabase.from('cupones').select('*').order('created_at', { ascending: false });

  return (
    <div className="max-w-[640px]">
      <h1 className="font-display font-bold text-xl text-white mb-6">🎟️ Cupones &amp; Promos</h1>

      <form action={crearCupon} className="bg-white/[0.03] border border-[rgba(0,255,179,0.1)] rounded-xl p-4 mb-6 flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <input
            name="codigo"
            required
            placeholder="CÓDIGO (ej: VERANO10)"
            className="bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white uppercase"
          />
          <select
            name="tipo"
            required
            className="bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white"
          >
            <option value="fijo" className="bg-[#0d1e16]">Monto fijo</option>
            <option value="porcentaje" className="bg-[#0d1e16]">Porcentaje</option>
            <option value="bogo" className="bg-[#0d1e16]">2x1 (BOGO)</option>
            <option value="regalo" className="bg-[#0d1e16]">Regalo</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input
            name="valor"
            required
            placeholder="Valor (monto, %, o nombre de producto para BOGO/regalo)"
            className="bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white"
          />
          <input
            name="min_monto"
            type="number"
            placeholder="Monto mínimo de compra (opcional)"
            className="bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white"
          />
        </div>
        <button type="submit" className="bg-neon text-[#020705] py-2.5 rounded-lg text-sm font-bold w-fit px-6">
          Crear cupón
        </button>
      </form>

      <div className="flex flex-col gap-2">
        {(cupones || []).map((c) => (
          <div key={c.id} className="flex items-center justify-between bg-white/[0.03] border border-[rgba(0,255,179,0.1)] rounded-lg px-4 py-3">
            <div>
              <p className="text-sm font-bold text-white">{c.id}</p>
              <p className="text-xs text-muted">
                {TIPO_LABELS[c.tipo]} · {c.valor}
                {c.minMonto > 0 && ` · min $${c.minMonto.toLocaleString('es-CL')}`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <form action={toggleCuponActivo.bind(null, c.id, c.activo)}>
                <button
                  type="submit"
                  className={`text-[11px] px-2.5 py-1 rounded-full font-semibold ${
                    c.activo ? 'bg-[rgba(0,255,179,0.15)] text-neon' : 'bg-white/10 text-white/40'
                  }`}
                >
                  {c.activo ? 'Activo' : 'Inactivo'}
                </button>
              </form>
              <form action={eliminarCupon.bind(null, c.id)}>
                <button type="submit" className="text-xs text-rojo hover:underline">
                  Eliminar
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
