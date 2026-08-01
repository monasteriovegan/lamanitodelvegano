'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import type { Producto } from '@/types/domain';
import { ProductPurchasePanel } from '@/components/tienda/ProductPurchasePanel';

export function VistaProducto({ producto }: { producto: Producto }) {
  // ViewContent / view_item: se dispara una sola vez al entrar a la página
  // del producto — es el evento que Meta/Google usan para armar públicos
  // de retargeting ("gente que vio este producto y no compró").
  useEffect(() => {
    if (typeof window !== 'undefined' && window.fbq) {
      window.fbq('track', 'ViewContent', {
        content_name: producto.nombre,
        content_ids: [producto.id],
        value: producto.precio,
        currency: 'CLP',
      });
    }
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'view_item', {
        currency: 'CLP',
        value: producto.precio,
        items: [{ item_id: producto.id, item_name: producto.nombre }],
      });
    }
  }, [producto.id, producto.nombre, producto.precio]);

  return (
    <main className="px-4 pt-[92px] pb-10 max-w-[520px] mx-auto">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link
          href="/#catalogo"
          className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(0,255,179,0.22)] bg-white/[0.04] px-3 py-2 text-xs font-semibold text-neon transition-colors hover:bg-[rgba(0,255,179,0.1)]"
        >
          ← Volver a productos
        </Link>
        <Link
          href="/"
          className="text-xs font-semibold text-white/55 underline-offset-4 hover:text-white hover:underline"
        >
          Inicio
        </Link>
      </div>

      <div
        className="w-full aspect-square rounded-2xl flex items-center justify-center text-7xl mb-5 overflow-hidden relative"
        style={{ background: producto.color_fondo || '#1B4332' }}
      >
        {producto.imagen_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={producto.imagen_url} alt={producto.nombre} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          producto.emoji || '🌱'
        )}
      </div>

      <h1 className="font-display font-bold text-2xl text-white mb-1.5">{producto.nombre}</h1>
      {producto.descripcion && (
        <p className="text-sm text-white/75 leading-relaxed mb-4">{producto.descripcion}</p>
      )}

      <ProductPurchasePanel producto={producto} />

      <div className="mt-5 grid grid-cols-2 gap-2">
        <Link
          href="/#catalogo"
          className="rounded-full border border-[rgba(0,255,179,0.22)] bg-white/[0.04] px-4 py-3 text-center text-xs font-bold text-neon transition-colors hover:bg-[rgba(0,255,179,0.1)]"
        >
          Seguir comprando
        </Link>
        <Link
          href="/checkout"
          className="rounded-full bg-white/[0.08] px-4 py-3 text-center text-xs font-bold text-white transition-colors hover:bg-white/[0.14]"
        >
          Ir al checkout
        </Link>
      </div>
    </main>
  );
}
