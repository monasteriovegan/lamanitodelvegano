import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { guardarProducto } from './actions';
import { FormatoOpcionesInput } from './FormatoOpcionesInput';
import type { Producto } from '@/types/domain';

export async function ProductoForm({ producto }: { producto?: Producto }) {
  const supabase = createSupabaseServiceClient();
  const { data: categorias } = await supabase.from('categorias').select('id, nombre');

  return (
    <form action={guardarProducto} className="max-w-[640px] flex flex-col gap-4">
      {producto && <input type="hidden" name="id" value={producto.id} />}

      <div>
        <label className="block text-xs text-muted mb-1.5">Nombre</label>
        <input
          name="nombre"
          required
          defaultValue={producto?.nombre}
          className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white"
        />
      </div>

      <div>
        <label className="block text-xs text-muted mb-1.5">
          URL del producto <span className="text-white/30">(opcional — se genera sola desde el nombre si la dejas vacía)</span>
        </label>
        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-white/30 whitespace-nowrap">/productos/</span>
          <input
            name="slug"
            placeholder="tableta-70-peru"
            defaultValue={producto?.slug || ''}
            className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white"
          />
        </div>
        <p className="text-[11px] text-white/30 mt-1">
          Esta es la URL que le mandas a la campaña de anuncios (Meta/Google Ads) para que aterrice directo en este producto.
        </p>
      </div>

      <div>
        <label className="block text-xs text-muted mb-1.5">Descripción</label>
        <textarea
          name="descripcion"
          rows={3}
          defaultValue={producto?.descripcion || ''}
          className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-muted mb-1.5">Precio</label>
          <input
            type="number"
            name="precio"
            required
            defaultValue={producto?.precio}
            className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1.5">Precio anterior (oferta)</label>
          <input
            type="number"
            name="precio_anterior"
            defaultValue={producto?.precio_anterior || ''}
            className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-muted mb-1.5">Categoría</label>
          <select
            name="categoria"
            defaultValue={producto?.categoria || ''}
            className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white"
          >
            <option value="" className="bg-[#0d1e16]">— Sin categoría —</option>
            {(categorias || []).map((c) => (
              <option key={c.id} value={c.nombre} className="bg-[#0d1e16]">
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted mb-1.5">Etiqueta</label>
          <select
            name="etiqueta"
            defaultValue={producto?.etiqueta || ''}
            className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white"
          >
            <option value="" className="bg-[#0d1e16]">— Ninguna —</option>
            <option value="nuevo" className="bg-[#0d1e16]">Nuevo</option>
            <option value="oferta" className="bg-[#0d1e16]">Oferta</option>
            <option value="estrella" className="bg-[#0d1e16]">Estrella</option>
            <option value="promo" className="bg-[#0d1e16]">Promo</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-muted mb-1.5">Emoji</label>
          <input
            name="emoji"
            defaultValue={producto?.emoji || '🌱'}
            className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1.5">Color de fondo</label>
          <input
            name="color_fondo"
            type="color"
            defaultValue={producto?.color_fondo || '#1B4332'}
            className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-1 h-[42px]"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-muted mb-1.5">URL de imagen (opcional, si no se usa el emoji)</label>
        <input
          name="imagen_url"
          defaultValue={producto?.imagen_url || ''}
          className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white"
        />
      </div>

      <FormatoOpcionesInput defaultValue={producto?.gramaje || ''} />

      <div>
        <label className="block text-xs text-muted mb-1.5">
          Variedades / sabores (separados por coma, deja vacío si no aplica)
        </label>
        <input
          name="variedades"
          defaultValue={producto?.variedades || ''}
          className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-muted mb-1.5">SKU del Producto</label>
          <input
            name="sku"
            defaultValue={producto?.sku || ''}
            placeholder="LMDV-EMP-VEG"
            className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1.5">Peso en Gramos</label>
          <input
            type="number"
            name="weight_grams"
            defaultValue={producto?.weight_grams || ''}
            placeholder="250"
            className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-muted mb-1.5">Costo de Producción (CLP)</label>
          <input
            type="number"
            name="cost_price"
            defaultValue={producto?.cost_price || ''}
            placeholder="1500"
            className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1.5">Alerta de Stock Bajo (unidades)</label>
          <input
            type="number"
            name="low_stock_alert"
            defaultValue={producto?.low_stock_alert || ''}
            placeholder="5"
            className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-muted mb-1.5">Ingredientes (separados por coma)</label>
        <input
          name="ingredients"
          defaultValue={producto?.ingredients?.join(', ') || ''}
          placeholder="harina integral, espinaca orgánica, tofu..."
          className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white"
        />
      </div>

      <div>
        <label className="block text-xs text-muted mb-1.5">Alérgenos (separados por coma)</label>
        <input
          name="allergens"
          defaultValue={producto?.allergens?.join(', ') || ''}
          placeholder="gluten, soya, frutos secos..."
          className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white"
        />
      </div>

      <div>
        <label className="block text-xs text-muted mb-1.5">Historia / Storytelling de producción</label>
        <textarea
          name="story"
          rows={2}
          defaultValue={producto?.story || ''}
          placeholder="Nuestra masa de espinaca orgánica se fermenta lentamente por 24 horas..."
          className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex items-center gap-2 text-sm text-white">
          <input type="checkbox" name="maneja_stock" defaultChecked={producto?.maneja_stock} />
          Gestionar stock
        </label>
        <div>
          <label className="block text-xs text-muted mb-1.5">Stock disponible</label>
          <input
            type="number"
            name="stock"
            defaultValue={producto?.stock || 0}
            className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm text-white">
          <input type="checkbox" name="gluten_free" defaultChecked={producto?.gluten_free ?? true} />
          Sin gluten
        </label>
        <label className="flex items-center gap-2 text-sm text-white">
          <input type="checkbox" name="nut_free" defaultChecked={producto?.nut_free ?? true} />
          Sin nueces
        </label>
        <label className="flex items-center gap-2 text-sm text-white">
          <input type="checkbox" name="is_new" defaultChecked={producto?.is_new ?? false} />
          Marcar como nuevo
        </label>
        <label className="flex items-center gap-2 text-sm text-white">
          <input type="checkbox" name="is_featured" defaultChecked={producto?.is_featured ?? false} />
          Marcar destacado
        </label>
        <label className="flex items-center gap-2 text-sm text-white">
          <input type="checkbox" name="activo" defaultChecked={producto?.activo ?? true} />
          Activo (visible)
        </label>
      </div>

      <button
        type="submit"
        className="bg-neon text-black font-bold py-3 rounded-xl text-sm shadow-[0_0_15px_rgba(0,255,179,0.2)] hover:bg-neon/90 transition-all w-fit px-8 mt-2"
      >
        {producto ? 'Guardar cambios' : 'Crear producto'}
      </button>
    </form>
  );
}
