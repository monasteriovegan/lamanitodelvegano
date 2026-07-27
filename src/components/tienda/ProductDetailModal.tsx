'use client';

import type { Producto } from '@/types/domain';
import { ProductPurchasePanel } from './ProductPurchasePanel';

export function ProductDetailModal({ producto, onClose }: { producto: Producto; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[400] bg-black/70 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="glass rounded-2xl max-w-[420px] w-full max-h-[85vh] overflow-y-auto p-5 relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center"
          aria-label="Cerrar"
        >
          ✕
        </button>

        <div
          className="w-full aspect-[16/9] rounded-xl flex items-center justify-center text-6xl mb-4 overflow-hidden relative"
          style={{ background: producto.color_fondo || '#1B4332' }}
        >
          {producto.imagen_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={producto.imagen_url} alt={producto.nombre} className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            producto.emoji || '🌱'
          )}
        </div>

        <h2 className="font-display font-bold text-xl text-white mb-1">{producto.nombre}</h2>
        {producto.descripcion && (
          <p className="text-sm text-white/75 leading-relaxed mb-3">{producto.descripcion}</p>
        )}

        <ProductPurchasePanel producto={producto} onAdded={onClose} />
      </div>
    </div>
  );
}
