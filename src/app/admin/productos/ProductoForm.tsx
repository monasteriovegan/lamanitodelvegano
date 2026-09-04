import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { guardarProducto } from './actions';
import { FormatoOpcionesInput } from './FormatoOpcionesInput';
import type { Producto } from '@/types/domain';

export interface ProductoFormProps {
  producto?: Producto;
  variants?: Array<{ id: string; sku: string; name: string; price: number; stock: number | null; is_active: boolean }>;
  optionGroups?: Array<{ id: string; name: string; selection_mode: string; is_required: boolean; product_option_values?: Array<{ id: string; label: string; price_delta: number; is_active: boolean }> }>;
  packComponents?: Array<{ id: string; component_name: string; quantity: number; unit: string; weight_grams: number | null }>;
}

export async function ProductoForm({ producto, variants = [], optionGroups = [], packComponents = [] }: ProductoFormProps) {
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-muted mb-1.5">Atributo Gluten (Tri-state)</label>
          <select
            name="gluten_free"
            defaultValue={producto?.gluten_free === null || producto?.gluten_free === undefined ? '' : String(producto.gluten_free)}
            className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white"
          >
            <option value="" className="bg-[#0d1e16]">Sin verificar / no afirmar (null)</option>
            <option value="true" className="bg-[#0d1e16]">Verificado libre de gluten (true)</option>
            <option value="false" className="bg-[#0d1e16]">Contiene gluten / no apto (false)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted mb-1.5">Atributo Frutos Secos (Tri-state)</label>
          <select
            name="nut_free"
            defaultValue={producto?.nut_free === null || producto?.nut_free === undefined ? '' : String(producto.nut_free)}
            className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white"
          >
            <option value="" className="bg-[#0d1e16]">Sin verificar / no afirmar (null)</option>
            <option value="true" className="bg-[#0d1e16]">Verificado libre de nueces (true)</option>
            <option value="false" className="bg-[#0d1e16]">Contiene nueces / no apto (false)</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
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

      {variants.length > 0 && (
        <div className="rounded-xl border border-[rgba(0,255,179,0.15)] bg-white/[0.02] p-4 text-xs">
          <h3 className="font-bold text-neon uppercase tracking-wider mb-2">📦 Variantes Estructuradas en Catálogo Master (product_variants)</h3>
          <div className="space-y-1.5">
            {variants.map((v) => (
              <div key={v.id} className="flex items-center justify-between border-b border-white/5 py-1 text-white/80">
                <span><strong>{v.name}</strong> ({v.sku})</span>
                <span className="font-mono text-neon">${v.price?.toLocaleString('es-CL')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {optionGroups.length > 0 && (
        <div className="rounded-xl border border-[rgba(0,255,179,0.15)] bg-white/[0.02] p-4 text-xs">
          <h3 className="font-bold text-neon uppercase tracking-wider mb-2">🎛️ Grupos de Opciones / Sabores (product_option_groups)</h3>
          <div className="space-y-2">
            {optionGroups.map((g) => (
              <div key={g.id} className="border-b border-white/5 pb-1.5">
                <div className="font-semibold text-white">{g.name} ({g.selection_mode}, {g.is_required ? 'Requerido' : 'Opcional'})</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(g.product_option_values || []).map((val) => (
                    <span key={val.id} className="rounded bg-white/10 px-2 py-0.5 text-[10px] text-white/70">
                      {val.label} {val.price_delta ? `(+$${val.price_delta})` : ''}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {packComponents.length > 0 && (
        <div className="rounded-xl border border-[rgba(0,255,179,0.15)] bg-white/[0.02] p-4 text-xs">
          <h3 className="font-bold text-neon uppercase tracking-wider mb-2">🎁 Componentes del Pack (product_pack_components)</h3>
          <div className="space-y-1">
            {packComponents.map((c) => (
              <div key={c.id} className="flex justify-between text-white/80">
                <span>{c.component_name}</span>
                <span className="text-neon">{c.quantity} {c.unit}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        type="submit"
        className="bg-neon text-black font-bold py-3 rounded-xl text-sm shadow-[0_0_15px_rgba(0,255,179,0.2)] hover:bg-neon/90 transition-all w-fit px-8 mt-2"
      >
        {producto ? 'Guardar cambios' : 'Crear producto'}
      </button>
    </form>
  );
}
