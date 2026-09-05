import {
  guardarGrupoOpciones,
  eliminarGrupoOpciones,
  guardarComponentePack,
  eliminarComponentePack,
} from './structure-actions';

type OptionValueRow = {
  id: string;
  label: string;
  price_delta: number;
  is_active?: boolean;
  sort_order?: number;
};

type OptionGroupRow = {
  id: string;
  name: string;
  selection_mode: string;
  is_required: boolean;
  is_active?: boolean;
  sort_order?: number;
  product_option_values?: OptionValueRow[];
};

type PackComponentRow = {
  id: string;
  component_product_id?: string | null;
  component_name: string;
  quantity: number;
  unit: string;
  weight_grams?: number | null;
  sort_order?: number;
};

type CatalogProductChoice = {
  id: string;
  nombre: string;
  product_option_groups?: OptionGroupRow[];
};

const inputClass = 'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-neon/50';
const labelClass = 'mb-1 block text-[10px] font-bold uppercase tracking-wider text-white/45';

function valuesText(group: OptionGroupRow) {
  return (group.product_option_values || [])
    .filter((value) => value.is_active !== false)
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
    .map((value) => `${value.label} | ${Number(value.price_delta || 0)}`)
    .join('\n');
}

function ChildOptions({ product }: { product: CatalogProductChoice | undefined }) {
  const groups = (product?.product_option_groups || []).filter((group) => group.is_active !== false);
  if (!groups.length) return null;
  return (
    <div className="mt-2 rounded-lg border border-neon/15 bg-neon/[0.04] px-3 py-2">
      <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-neon/70">Opciones heredadas del componente</div>
      {groups.map((group) => (
        <div key={group.id} className="text-[11px] text-white/65">
          <strong className="text-white/80">{group.name}:</strong>{' '}
          {(group.product_option_values || []).filter((value) => value.is_active !== false).map((value) => value.label).join(' · ') || 'Sin valores activos'}
        </div>
      ))}
    </div>
  );
}

export function ProductStructureEditor({
  productId,
  optionGroups,
  packComponents,
  catalogProducts,
}: {
  productId: string;
  optionGroups: OptionGroupRow[];
  packComponents: PackComponentRow[];
  catalogProducts: CatalogProductChoice[];
}) {
  const activeGroups = optionGroups.filter((group) => group.is_active !== false);

  return (
    <div className="mt-8 space-y-6 border-t border-white/10 pt-7">
      <section className="rounded-2xl border border-neon/15 bg-white/[0.025] p-5">
        <div className="mb-4">
          <h2 className="font-display text-lg font-bold text-white">🎛️ Opciones / sabores</h2>
          <p className="mt-1 text-xs text-white/50">Aquí defines elecciones reales del producto. Usa una opción por línea: <strong className="text-white/70">Nombre | diferencia de precio</strong>. Ejemplo: <em>Barbecue | 0</em>.</p>
        </div>

        <div className="space-y-4">
          {activeGroups.map((group) => (
            <div key={group.id} className="rounded-xl border border-white/10 bg-black/10 p-4">
              <form action={guardarGrupoOpciones} className="grid gap-3 md:grid-cols-4">
                <input type="hidden" name="product_id" value={productId} />
                <input type="hidden" name="group_id" value={group.id} />
                <label className="md:col-span-2"><span className={labelClass}>Nombre del grupo</span><input name="name" required defaultValue={group.name} className={inputClass} /></label>
                <label><span className={labelClass}>Tipo</span><select name="selection_mode" defaultValue={group.selection_mode || 'single'} className={inputClass}><option value="single" className="bg-[#07110c]">Elegir una</option><option value="quantity" className="bg-[#07110c]">Distribuir cantidades</option></select></label>
                <label><span className={labelClass}>Orden</span><input name="sort_order" type="number" defaultValue={group.sort_order || 10} className={inputClass} /></label>
                <label className="md:col-span-4"><span className={labelClass}>Opciones / valores</span><textarea name="values" rows={Math.max(3, (group.product_option_values || []).length)} defaultValue={valuesText(group)} className={inputClass} /></label>
                <label className="flex items-center gap-2 text-xs text-white/70"><input name="is_required" type="checkbox" defaultChecked={group.is_required} /> Obligatorio</label>
                <div className="md:col-span-3 text-right"><button type="submit" className="rounded-lg bg-neon px-4 py-2 text-xs font-bold text-black">Guardar opciones</button></div>
              </form>
              <form action={eliminarGrupoOpciones.bind(null, productId, group.id)} className="mt-2 text-right">
                <button type="submit" className="text-[11px] text-red-300 hover:underline">Quitar este grupo</button>
              </form>
            </div>
          ))}

          <form action={guardarGrupoOpciones} className="grid gap-3 rounded-xl border border-dashed border-neon/20 p-4 md:grid-cols-4">
            <input type="hidden" name="product_id" value={productId} />
            <label className="md:col-span-2"><span className={labelClass}>Nuevo grupo</span><input name="name" required placeholder="Ej: Adobo, Sabor, Relleno" className={inputClass} /></label>
            <label><span className={labelClass}>Tipo</span><select name="selection_mode" defaultValue="single" className={inputClass}><option value="single" className="bg-[#07110c]">Elegir una</option><option value="quantity" className="bg-[#07110c]">Distribuir cantidades</option></select></label>
            <label><span className={labelClass}>Orden</span><input name="sort_order" type="number" defaultValue={10} className={inputClass} /></label>
            <label className="md:col-span-4"><span className={labelClass}>Opciones / valores</span><textarea name="values" rows={4} required placeholder={'Barbecue | 0\nMostaza | 0\nFinas hierbas | 0'} className={inputClass} /></label>
            <label className="flex items-center gap-2 text-xs text-white/70"><input name="is_required" type="checkbox" defaultChecked /> Obligatorio</label>
            <div className="md:col-span-3 text-right"><button type="submit" className="rounded-lg border border-neon/30 px-4 py-2 text-xs font-bold text-neon">+ Agregar grupo</button></div>
          </form>
        </div>
      </section>

      <section className="rounded-2xl border border-neon/15 bg-white/[0.025] p-5">
        <div className="mb-4">
          <h2 className="font-display text-lg font-bold text-white">🎁 Componentes del pack</h2>
          <p className="mt-1 text-xs text-white/50">Vincula un producto real cuando exista. Así el pack hereda automáticamente sus opciones; por ejemplo, Le Kostilles mantiene sus adobos sin duplicarlos.</p>
        </div>

        <div className="space-y-4">
          {packComponents.map((component) => {
            const linked = catalogProducts.find((product) => product.id === component.component_product_id);
            return (
              <div key={component.id} className="rounded-xl border border-white/10 bg-black/10 p-4">
                <form action={guardarComponentePack} className="grid gap-3 md:grid-cols-6">
                  <input type="hidden" name="product_id" value={productId} />
                  <input type="hidden" name="component_id" value={component.id} />
                  <label className="md:col-span-3"><span className={labelClass}>Producto vinculado</span><select name="component_product_id" defaultValue={component.component_product_id || ''} className={inputClass}><option value="" className="bg-[#07110c]">Componente personalizado</option>{catalogProducts.filter((product) => product.id !== productId).map((product) => <option key={product.id} value={product.id} className="bg-[#07110c]">{product.nombre}</option>)}</select></label>
                  <label className="md:col-span-3"><span className={labelClass}>Nombre si es personalizado</span><input name="component_name" defaultValue={component.component_product_id ? '' : component.component_name} placeholder={component.component_name} className={inputClass} /></label>
                  <label><span className={labelClass}>Cantidad</span><input name="quantity" type="number" min="0.01" step="0.01" required defaultValue={component.quantity} className={inputClass} /></label>
                  <label><span className={labelClass}>Unidad</span><input name="unit" required defaultValue={component.unit} className={inputClass} /></label>
                  <label><span className={labelClass}>Gramos</span><input name="weight_grams" type="number" min="0" defaultValue={component.weight_grams ?? ''} className={inputClass} /></label>
                  <label><span className={labelClass}>Orden</span><input name="sort_order" type="number" defaultValue={component.sort_order || 10} className={inputClass} /></label>
                  <div className="md:col-span-2 flex items-end justify-end"><button type="submit" className="rounded-lg bg-neon px-4 py-2 text-xs font-bold text-black">Guardar componente</button></div>
                </form>
                <ChildOptions product={linked} />
                <form action={eliminarComponentePack.bind(null, productId, component.id)} className="mt-2 text-right"><button type="submit" className="text-[11px] text-red-300 hover:underline">Quitar componente</button></form>
              </div>
            );
          })}

          <form action={guardarComponentePack} className="grid gap-3 rounded-xl border border-dashed border-neon/20 p-4 md:grid-cols-6">
            <input type="hidden" name="product_id" value={productId} />
            <label className="md:col-span-3"><span className={labelClass}>Agregar producto al pack</span><select name="component_product_id" className={inputClass}><option value="" className="bg-[#07110c]">Componente personalizado</option>{catalogProducts.filter((product) => product.id !== productId).map((product) => <option key={product.id} value={product.id} className="bg-[#07110c]">{product.nombre}</option>)}</select></label>
            <label className="md:col-span-3"><span className={labelClass}>O nombre personalizado</span><input name="component_name" placeholder="Ej: Choripanes veganos" className={inputClass} /></label>
            <label><span className={labelClass}>Cantidad</span><input name="quantity" type="number" min="0.01" step="0.01" defaultValue={1} required className={inputClass} /></label>
            <label><span className={labelClass}>Unidad</span><input name="unit" defaultValue="unidad" required className={inputClass} /></label>
            <label><span className={labelClass}>Gramos</span><input name="weight_grams" type="number" min="0" className={inputClass} /></label>
            <label><span className={labelClass}>Orden</span><input name="sort_order" type="number" defaultValue={10} className={inputClass} /></label>
            <div className="md:col-span-2 flex items-end justify-end"><button type="submit" className="rounded-lg border border-neon/30 px-4 py-2 text-xs font-bold text-neon">+ Agregar componente</button></div>
          </form>
        </div>
      </section>
    </div>
  );
}
