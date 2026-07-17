import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { crearZona, eliminarZona } from './actions';

export default async function AdminZonasPage() {
  const supabase = createSupabaseServiceClient();
  const { data: zonas } = await supabase.from('zonas').select('*').order('nombre');

  return (
    <div className="max-w-[600px]">
      <h1 className="font-display font-bold text-xl text-white mb-6">🚚 Zonas de despacho</h1>

      <form action={crearZona} className="bg-white/[0.03] border border-[rgba(0,255,179,0.1)] rounded-xl p-4 mb-6 flex flex-col gap-3">
        <input
          name="nombre"
          required
          placeholder="Nombre de la zona (ej: Santiago Centro)"
          className="bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white"
        />
        <input
          name="comunas"
          placeholder="Comunas incluidas (ej: Santiago, Providencia, Ñuñoa)"
          className="bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white"
        />
        <div className="flex gap-2">
          <input
            name="precio"
            type="number"
            required
            placeholder="Precio del envío"
            className="flex-1 bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white"
          />
          <button type="submit" className="bg-neon text-[#020705] px-5 rounded-lg text-sm font-bold">
            Agregar zona
          </button>
        </div>
      </form>

      <div className="flex flex-col gap-2">
        {(zonas || []).map((z) => (
          <div key={z.id} className="flex items-center justify-between bg-white/[0.03] border border-[rgba(0,255,179,0.1)] rounded-lg px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-white">{z.nombre}</p>
              <p className="text-xs text-muted">{z.comunas}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-neon font-bold">${z.precio.toLocaleString('es-CL')}</span>
              <form action={eliminarZona.bind(null, z.id)}>
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
