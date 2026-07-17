import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { crearCategoria, eliminarCategoria } from './actions';

export default async function AdminCategoriasPage() {
  const supabase = createSupabaseServiceClient();
  const { data: categorias } = await supabase.from('categorias').select('*').order('nombre');

  return (
    <div className="max-w-[500px]">
      <h1 className="font-display font-bold text-xl text-white mb-6">🏷️ Categorías</h1>

      <form action={crearCategoria} className="flex gap-2 mb-6">
        <input
          name="emoji"
          placeholder="🌱"
          maxLength={4}
          className="w-14 bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-2 py-2.5 text-sm text-white text-center"
        />
        <input
          name="nombre"
          required
          placeholder="Nombre de la categoría"
          className="flex-1 bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white"
        />
        <button type="submit" className="bg-neon text-[#020705] px-4 rounded-lg text-sm font-bold">
          Agregar
        </button>
      </form>

      <div className="flex flex-col gap-2">
        {(categorias || []).map((cat) => (
          <div key={cat.id} className="flex items-center justify-between bg-white/[0.03] border border-[rgba(0,255,179,0.1)] rounded-lg px-4 py-3">
            <span className="text-sm text-white">
              {cat.emoji} {cat.nombre}
            </span>
            <form action={eliminarCategoria.bind(null, cat.id)}>
              <button type="submit" className="text-xs text-rojo hover:underline">
                Eliminar
              </button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
