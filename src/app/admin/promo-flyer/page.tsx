import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/supabase/require-role';
import { leerAjustes } from '@/lib/ajustes/helpers';
import { guardarPromoFlyer } from './actions';
import { PageHeader, SectionCard } from '../_ui/AdminUI';
import type { Producto } from '@/types/domain';

export const dynamic = 'force-dynamic';

export default async function AdminPromoFlyerPage() {
  await requireRole(['admin']);
  const [ajustes, { data: productosData }] = await Promise.all([
    leerAjustes(),
    createSupabaseServiceClient().from('productos').select('id, nombre, emoji').eq('activo', true).order('nombre'),
  ]);
  const productos = (productosData as Pick<Producto, 'id' | 'nombre' | 'emoji'>[]) || [];

  return (
    <div className="max-w-xl">
      <PageHeader eyebrow="Portada" title="📢 Promo Flyer" />
      <p className="text-sm text-muted -mt-6 mb-8">
        La imagen y el producto que se muestran como promoción especial arriba del catálogo, en la portada.
      </p>

      <SectionCard>
        <form action={guardarPromoFlyer} className="flex flex-col gap-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="promo_activa"
              defaultChecked={ajustes.promo_activa ?? false}
              className="w-4 h-4 accent-[#00ffb3]"
            />
            <span className="text-sm text-texto">Mostrar la promo especial en la portada</span>
          </label>

          <div>
            <label className="block text-xs text-muted mb-1.5">URL de la imagen del flyer</label>
            <input
              name="promo_imagen_url"
              defaultValue={ajustes.promo_imagen_url || ''}
              placeholder="https://..."
              className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white"
            />
            <p className="text-[11px] text-muted mt-1">Sube la imagen a donde alojes tus otras fotos de producto y pega el link acá.</p>
          </div>

          {ajustes.promo_imagen_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={ajustes.promo_imagen_url}
              alt="Vista previa del flyer"
              className="w-full max-h-56 object-cover rounded-xl border border-white/10"
            />
          )}

          <div>
            <label className="block text-xs text-muted mb-1.5">Producto asociado</label>
            <select
              name="promo_producto_id"
              defaultValue={ajustes.promo_producto_id || ''}
              className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white"
            >
              <option value="" className="bg-[#0d1e16]">— Ninguno —</option>
              {productos.map((p) => (
                <option key={p.id} value={p.id} className="bg-[#0d1e16]">
                  {p.emoji || '🌱'} {p.nombre}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted mt-1">
              El cliente podrá agregarlo al carrito directo desde el flyer, con sus formatos y variedades.
            </p>
          </div>

          <button
            type="submit"
            className="mt-2 bg-[#00ffb3] text-[#030907] font-semibold text-sm rounded-lg px-4 py-2.5 hover:brightness-95 transition-all"
          >
            Guardar promo
          </button>
        </form>
      </SectionCard>
    </div>
  );
}
