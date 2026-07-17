'use client';

import { useState, useMemo } from 'react';
import type { Producto, Categoria } from '@/types/domain';
import { ProductCard } from './ProductCard';
import { ProductDetailModal } from './ProductDetailModal';

export function CatalogoGrid({ productos, categorias }: { productos: Producto[]; categorias: Categoria[] }) {
  const [catActiva, setCatActiva] = useState<string>('todos');
  const [productoDetalle, setProductoDetalle] = useState<Producto | null>(null);

  const productosFiltrados = useMemo(() => {
    if (catActiva === 'todos') return productos;
    return productos.filter((p) => p.categoria === catActiva);
  }, [productos, catActiva]);

  return (
    <section id="catalogo" className="px-4 pb-8">
      <h2 className="font-display font-bold text-lg text-white py-4">🌿 Nuestros productos</h2>

      <div className="flex gap-2 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          onClick={() => setCatActiva('todos')}
          className={`whitespace-nowrap px-4 py-[7px] rounded-full border text-[11px] font-semibold transition-all ${
            catActiva === 'todos'
              ? 'bg-neon border-neon text-[#020705] shadow-[0_0_10px_rgba(0,255,179,0.2)]'
              : 'border-[rgba(0,255,179,0.2)] bg-[rgba(0,255,179,0.04)] text-white/80'
          }`}
        >
          Todos
        </button>
        {categorias.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setCatActiva(cat.nombre)}
            className={`whitespace-nowrap px-4 py-[7px] rounded-full border text-[11px] font-semibold transition-all ${
              catActiva === cat.nombre
                ? 'bg-neon border-neon text-[#020705] shadow-[0_0_10px_rgba(0,255,179,0.2)]'
                : 'border-[rgba(0,255,179,0.2)] bg-[rgba(0,255,179,0.04)] text-white/80'
            }`}
          >
            {cat.emoji} {cat.nombre}
          </button>
        ))}
      </div>

      {productosFiltrados.length === 0 ? (
        <p className="text-center text-muted text-sm py-10">No hay productos en esta categoría todavía 🌱</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
          {productosFiltrados.map((producto) => (
            <ProductCard key={producto.id} producto={producto} onOpenDetail={() => setProductoDetalle(producto)} />
          ))}
        </div>
      )}

      {productoDetalle && (
        <ProductDetailModal producto={productoDetalle} onClose={() => setProductoDetalle(null)} />
      )}
    </section>
  );
}
