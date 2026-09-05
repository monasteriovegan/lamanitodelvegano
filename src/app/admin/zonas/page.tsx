import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/supabase/require-role';
import { crearZona, actualizarZona, eliminarZona } from './actions';

export default async function AdminZonasPage() {
  await requireRole(['admin']);
  const supabase = createSupabaseServiceClient();
  const { data: zonas } = await supabase.from('zonas').select('*').order('nombre');

  return (
    <div className="max-w-[760px]">
      <div className="mb-6">
        <h1 className="font-display font-bold text-xl text-white">🚚 Zonas de despacho</h1>
        <p className="mt-1 text-xs text-muted">Puedes editar en cualquier momento el nombre, las comunas y el valor base de cada zona. Los pedidos desde $50.000 en productos tienen despacho gratis.</p>
      </div>

      <form action={crearZona} className="bg-white/[0.03] border border-[rgba(0,255,179,0.1)] rounded-xl p-4 mb-6 flex flex-col gap-3">
        <h2 className="text-sm font-bold text-white">Agregar zona</h2>
        <input
          name="nombre"
          required
          placeholder="Nombre de la zona (ej: CENTRO)"
          className="bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white"
        />
        <textarea
          name="comunas"
          rows={2}
          placeholder="Comunas separadas por coma"
          className="bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white"
        />
        <div className="flex gap-2">
          <input
            name="precio"
            type="number"
            min="0"
            step="1"
            required
            placeholder="Precio base del envío"
            className="flex-1 bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white"
          />
          <button type="submit" className="bg-neon text-[#020705] px-5 rounded-lg text-sm font-bold">
            Agregar zona
          </button>
        </div>
      </form>

      <div className="flex flex-col gap-3">
        {(zonas || []).map((z) => (
          <div key={z.id} className="bg-white/[0.03] border border-[rgba(0,255,179,0.1)] rounded-xl p-4">
            <form action={actualizarZona} className="grid gap-3 md:grid-cols-[1fr_2fr_130px_auto] md:items-end">
              <input type="hidden" name="id" value={z.id} />
              <label className="block">
                <span className="mb-1 block text-[10px] uppercase tracking-wide text-muted">Zona</span>
                <input name="nombre" required defaultValue={z.nombre} className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2 text-sm text-white" />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] uppercase tracking-wide text-muted">Comunas</span>
                <textarea name="comunas" rows={2} defaultValue={z.comunas || ''} className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2 text-xs text-white" />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] uppercase tracking-wide text-muted">Valor CLP</span>
                <input name="precio" type="number" min="0" step="1" required defaultValue={z.precio ?? 0} className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2 text-sm font-semibold text-neon" />
              </label>
              <button type="submit" className="h-10 rounded-lg bg-neon px-4 text-xs font-bold text-[#020705]">Guardar</button>
            </form>
            <form action={eliminarZona.bind(null, z.id)} className="mt-2 text-right">
              <button type="submit" className="text-[11px] text-rojo hover:underline">Eliminar zona</button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
