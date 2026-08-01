'use client';

import { useEffect } from 'react';
import type { Producto } from '@/types/domain';
import { ProductPurchasePanel } from './ProductPurchasePanel';

export function ProductDetailModal({ producto, onClose }: { producto: Producto; onClose: () => void }) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    document.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[400] bg-black/75 flex items-end sm:items-center justify-center p-3 sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-detail-title"
    >
      <div className="glass rounded-t-2xl sm:rounded-2xl max-w-[420px] w-full max-h-[90vh] overflow-y-auto p-5 pt-4 relative">
        <div className="sticky top-0 z-[3] -mx-5 -mt-4 mb-3 flex items-center justify-between gap-3 border-b border-white/10 bg-[#07110d]/95 px-5 py-3 backdrop-blur">
          <span className="text-xs font-semibold text-white/55">Detalle del producto</span>
          <button
            onClick={onClose}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/10 px-3 text-xs font-bold text-white transition-colors hover:bg-white/18"
            aria-label="Cerrar detalle del producto"
          >
            ✕ Cerrar
          </button>
        </div>

        <button
          onClick={onClose}
          className="sr-only"
          aria-label="Cerrar detalle"
        >
          Cerrar
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

        <h2 id="product-detail-title" className="font-display font-bold text-xl text-white mb-1">{producto.nombre}</h2>
        {producto.descripcion && (
          <p className="text-sm text-white/75 leading-relaxed mb-3">{producto.descripcion}</p>
        )}

        <ProductPurchasePanel producto={producto} onAdded={onClose} />

        <button
          onClick={onClose}
          className="mt-3 w-full rounded-full border border-white/10 bg-white/[0.04] py-2.5 text-xs font-bold text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white"
        >
          Volver al catálogo
        </button>
      </div>
    </div>
  );
}
