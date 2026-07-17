import Link from 'next/link';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { toggleDestacado, eliminarProducto } from './actions';

export default async function AdminProductosPage() {
  const supabase = createSupabaseServiceClient();
  const { data: productos } = await supabase
    .from('productos')
    .select('*')
    .order('id', { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display font-bold text-xl text-white">📦 Productos</h1>
        <Link
          href="/admin/productos/nuevo"
          className="bg-neon text-[#020705] px-4 py-2 rounded-full text-sm font-bold hover:bg-white transition-colors"
        >
          + Agregar producto
        </Link>
      </div>

      <div className="bg-white/[0.03] border border-[rgba(0,255,179,0.1)] rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted text-xs border-b border-[rgba(0,255,179,0.1)]">
              <th className="p-3">Producto</th>
              <th className="p-3">Categoría</th>
              <th className="p-3">Estado</th>
              <th className="p-3">Stock</th>
              <th className="p-3">Precio</th>
              <th className="p-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {(productos || []).map((p) => (
              <tr key={p.id} className="border-b border-white/5">
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-lg overflow-hidden"
                      style={{ background: p.color_fondo }}
                    >
                      {p.imagen_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.imagen_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        p.emoji
                      )}
                    </div>
                    <span className="font-semibold text-white">{p.nombre}</span>
                  </div>
                </td>
                <td className="p-3 text-white/70">{p.categoria || '—'}</td>
                <td className="p-3">
                  {p.etiqueta ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(0,255,179,0.1)] text-neon uppercase">
                      {p.etiqueta}
                    </span>
                  ) : (
                    <span className="text-white/30 text-xs">—</span>
                  )}
                </td>
                <td className="p-3">
                  {!p.maneja_stock ? (
                    <span className="text-white/40 text-xs">♾️ Ilimitado</span>
                  ) : p.stock <= 0 ? (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-[rgba(239,68,68,0.15)] text-rojo font-bold">
                      Agotado
                    </span>
                  ) : p.stock <= 3 ? (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-[rgba(245,158,11,0.15)] text-am font-bold">
                      Bajo ({p.stock})
                    </span>
                  ) : (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-[rgba(0,255,179,0.1)] text-neon">
                      {p.stock} uds
                    </span>
                  )}
                </td>
                <td className="p-3 text-white font-semibold">${p.precio.toLocaleString('es-CL')}</td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <form action={toggleDestacado.bind(null, p.id, p.destacado)}>
                      <button type="submit" title="Destacar" className={p.destacado ? 'text-am' : 'text-white/20'}>
                        ⭐
                      </button>
                    </form>
                    <Link href={`/admin/productos/${p.id}`} className="text-xs text-neon hover:underline">
                      Editar
                    </Link>
                    <form action={eliminarProducto.bind(null, p.id)}>
                      <button type="submit" title="Eliminar" className="text-xs text-rojo hover:underline">
                        🗑
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
