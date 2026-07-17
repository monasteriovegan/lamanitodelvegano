'use client';

import { useState } from 'react';
import type { Producto } from '@/types/domain';
import { useCart } from '@/lib/cart/CartContext';
import { itemKey } from '@/lib/cart/CartContext';

const TAG_STYLES: Record<string, string> = {
  nuevo: 'bg-v3 text-white',
  oferta: 'bg-rojo text-white',
  estrella: 'bg-am text-white',
  promo: 'bg-gold text-[#020705]',
};

const TAG_LABELS: Record<string, string> = {
  nuevo: 'Nuevo',
  oferta: 'Oferta',
  estrella: 'Top',
  promo: 'Promo',
};

export function ProductCard({ producto, onOpenDetail }: { producto: Producto; onOpenDetail: () => void }) {
  const { items, addItem, changeQty } = useCart();
  const tieneFormatosOVariedades = !!(producto.gramaje?.trim() || producto.variedades?.trim());

  const key = itemKey({ productoId: producto.id, formato: null, variedad: null });
  const enCarrito = items.find((i) => itemKey(i) === key);

  function handleAdd() {
    if (tieneFormatosOVariedades) {
      onOpenDetail();
      return;
    }
    addItem({
      productoId: producto.id,
      nombre: producto.nombre,
      precio: producto.precio,
      qty: 1,
      emoji: producto.emoji || '🌱',
    });
  }

  return (
    <div className="bg-white/[0.03] border border-[rgba(0,255,179,0.15)] rounded-[14px] overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.4)] transition-all hover:-translate-y-[5px] hover:border-[rgba(0,255,179,0.4)]">
      <button
        onClick={onOpenDetail}
        className="w-full aspect-square flex items-center justify-center text-[42px] relative overflow-hidden"
        style={{ background: producto.color_fondo || '#1B4332' }}
      >
        {producto.imagen_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={producto.imagen_url}
            alt={producto.nombre}
            className="absolute inset-0 w-full h-full object-cover transition-transform hover:scale-110"
          />
        ) : (
          <span className="relative z-[1]">{producto.emoji || '🌱'}</span>
        )}
        {producto.etiqueta && (
          <span
            className={`absolute top-1.5 left-1.5 px-[7px] py-0.5 rounded-full text-[8px] font-bold uppercase z-[2] ${TAG_STYLES[producto.etiqueta]}`}
          >
            {TAG_LABELS[producto.etiqueta]}
          </span>
        )}
      </button>

      <div className="px-3 pb-3 pt-2.5">
        <h3 className="font-body font-bold text-[13px] mb-0.5 text-white">{producto.nombre}</h3>
        {producto.descripcion && (
          <p className="text-[11px] text-white/90 font-semibold mb-2 leading-snug line-clamp-2">
            {producto.descripcion}
          </p>
        )}

        <div className="flex items-center justify-between">
          <div>
            <span className="font-body text-[14.5px] text-neon font-bold">
              ${producto.precio.toLocaleString('es-CL')}
            </span>
            {producto.precio_anterior && (
              <span className="block text-[9px] text-gray-500 line-through">
                ${producto.precio_anterior.toLocaleString('es-CL')}
              </span>
            )}
          </div>

          {!enCarrito ? (
            <button
              onClick={handleAdd}
              aria-label={`Agregar ${producto.nombre} al carrito`}
              className="bg-neon text-[#020705] w-7 h-7 rounded-lg text-base flex items-center justify-center shadow-[0_3px_8px_rgba(0,255,179,0.3)] transition-all hover:bg-white"
            >
              +
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <button
                onClick={() => changeQty(key, -1)}
                className="bg-white/10 w-6 h-6 rounded-md text-xs text-white flex items-center justify-center hover:bg-white/15"
              >
                −
              </button>
              <span className="font-bold text-xs text-white min-w-[12px] text-center">{enCarrito.qty}</span>
              <button
                onClick={() => changeQty(key, 1)}
                className="bg-neon text-[#020705] w-6 h-6 rounded-md text-xs flex items-center justify-center"
              >
                +
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
