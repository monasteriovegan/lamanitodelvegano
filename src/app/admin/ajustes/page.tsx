import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { guardarAjustes } from './actions';

export default async function AdminAjustesPage() {
  const supabase = createSupabaseServiceClient();
  const { data: ajustesRow } = await supabase.from('ajustes').select('data').eq('id', 'global').maybeSingle();
  const ajustes = ajustesRow?.data || {};

  return (
    <div className="max-w-[500px]">
      <h1 className="font-display font-bold text-xl text-white mb-6">⚙️ Ajustes generales</h1>

      <form action={guardarAjustes} className="flex flex-col gap-4">
        <div>
          <label className="block text-xs text-muted mb-1.5">Nombre de la tienda</label>
          <input
            name="nombre"
            defaultValue={ajustes.nombre || ''}
            className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white"
          />
        </div>

        <div>
          <label className="block text-xs text-muted mb-1.5">Estado de la tienda</label>
          <select
            name="estado"
            defaultValue={ajustes.estado || 'abierto'}
            className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white"
          >
            <option value="abierto" className="bg-[#0d1e16]">🟢 Abierto — recibiendo pedidos</option>
            <option value="cerrado" className="bg-[#0d1e16]">🔴 Cerrado — pausado temporalmente</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-muted mb-1.5">WhatsApp (solo números, con código país)</label>
          <input
            name="whatsapp"
            defaultValue={ajustes.whatsapp || ''}
            placeholder="56912345678"
            className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-muted mb-1.5">Instagram (usuario)</label>
            <input
              name="instagram"
              defaultValue={ajustes.instagram || ''}
              className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1.5">TikTok (usuario)</label>
            <input
              name="tiktok"
              defaultValue={ajustes.tiktok || ''}
              className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-muted mb-1.5">Facebook (usuario o página)</label>
          <input
            name="facebook"
            defaultValue={ajustes.facebook || ''}
            className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white"
          />
        </div>

        <fieldset className="bg-white/[0.03] border border-[rgba(0,255,179,0.1)] rounded-xl p-4 mt-2">
          <legend className="text-sm font-bold text-white px-1">⭐ Programa de fidelidad</legend>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div>
              <label className="block text-xs text-muted mb-1.5">$ para ganar 1 punto</label>
              <input
                name="tasa_puntos"
                type="number"
                defaultValue={ajustes.tasaPuntos || 1000}
                className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1.5">$ que vale 1 punto al canjear</label>
              <input
                name="valor_punto"
                type="number"
                defaultValue={ajustes.valorPunto || 100}
                className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white"
              />
            </div>
          </div>
        </fieldset>

        <button
          type="submit"
          className="bg-neon text-[#020705] font-bold py-3 rounded-full text-sm shadow-[0_0_15px_rgba(0,255,179,0.4)] hover:bg-white transition-all w-fit px-8"
        >
          Guardar ajustes
        </button>
      </form>
    </div>
  );
}
