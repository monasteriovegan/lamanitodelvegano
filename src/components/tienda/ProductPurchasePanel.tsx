'use client';

import { useState, useMemo } from 'react';
import type { Producto } from '@/types/domain';
import { parseFormatos, parseVariedades } from '@/lib/pricing/formatos';
import { useCart } from '@/lib/cart/CartContext';
import { trackAddToCart } from '@/lib/analytics/client';

export function ProductPurchasePanel({ producto, onAdded }: { producto: Producto; onAdded?: () => void }) {
  const { addItem } = useCart();

  const formatos = useMemo(() => parseFormatos(producto.gramaje, producto.precio), [producto]);
  const variedades = useMemo(() => parseVariedades(producto.variedades), [producto]);
  const tieneFormatos = formatos.length > 1 || formatos[0].label !== '';
  const tieneVariedades = variedades.length > 0;

  const [formatoIdx, setFormatoIdx] = useState(0);
  const [qty, setQty] = useState(1);
  const [variedadQtys, setVariedadQtys] = useState<number[]>(() => variedades.map(() => 0));

  const formatoActual = formatos[formatoIdx];
  const precioUnitario = formatoActual.precio;

  const totalVariedades = variedadQtys.reduce((a, b) => a + b, 0);
  const cantidadFinal = tieneVariedades ? totalVariedades : qty;
  const precioTotal = precioUnitario * (tieneVariedades ? Math.max(totalVariedades, 1) : qty);

  function changeVariedadQty(idx: number, delta: number) {
    setVariedadQtys((prev) => prev.map((q, i) => (i === idx ? Math.max(0, q + delta) : q)));
  }

  function handleAddToCart() {
    if (tieneVariedades) {
      variedadQtys.forEach((q, idx) => {
        if (q > 0) {
          addItem({
            productoId: producto.id,
            nombre: producto.nombre,
            precio: precioUnitario,
            qty: q,
            emoji: producto.emoji || '🌱',
            formato: tieneFormatos ? formatoActual.label : null,
            variedad: variedades[idx],
          });
        }
      });
    } else {
      addItem({
        productoId: producto.id,
        nombre: producto.nombre,
        precio: precioUnitario,
        qty,
        emoji: producto.emoji || '🌱',
        formato: tieneFormatos ? formatoActual.label : null,
        variedad: null,
      });
    }

    trackAddToCart({
      items: [{ id: producto.id, name: producto.nombre, price: precioUnitario, quantity: cantidadFinal }],
      value: precioTotal,
    });

    onAdded?.();
  }

  const disabledAdd = cantidadFinal === 0;

  return (
    <div>
      <div className="flex gap-1.5 mb-4 flex-wrap">
        <span className="pill">🌱 100% Vegano</span>
        {producto.gluten_free && <span className="pill">🌾 Sin Gluten</span>}
        {producto.nut_free && <span className="pill">🥜 Sin Nueces</span>}
      </div>

      {tieneFormatos && (
        <div className="mb-4">
          <label className="block text-xs text-muted mb-2">Selecciona formato / peso:</label>
          <div className="grid grid-cols-2 gap-2">
            {formatos.map((f, idx) => (
              <button
                key={f.label}
                type="button"
                onClick={() => setFormatoIdx(idx)}
                className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                  formatoIdx === idx
                    ? 'border-neon bg-[rgba(0,255,179,0.10)] text-white'
                    : 'border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.07]'
                }`}
              >
                <span className="block text-sm font-bold">{f.label || 'Estandar'}</span>
                <span className="text-xs text-neon">${f.precio.toLocaleString('es-CL')}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {tieneVariedades ? (
        <div className="mb-4">
          <label className="block text-xs text-muted mb-2">Selecciona sabores y cantidades:</label>
          <div className="flex flex-col gap-2">
            {variedades.map((v, idx) => (
              <div key={v} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
                <span className="text-sm text-white">{v}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => changeVariedadQty(idx, -1)}
                    className="w-6 h-6 rounded-md bg-white/10 text-white text-xs flex items-center justify-center"
                  >
                    −
                  </button>
                  <span className="text-sm text-white font-bold min-w-[16px] text-center">{variedadQtys[idx]}</span>
                  <button
                    onClick={() => changeVariedadQty(idx, 1)}
                    className="w-6 h-6 rounded-md bg-neon text-[#020705] text-xs flex items-center justify-center"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mb-4 flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
          <span className="text-sm text-white">Cantidad</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="w-7 h-7 rounded-md bg-white/10 text-white text-sm flex items-center justify-center"
            >
              −
            </button>
            <span className="text-sm text-white font-bold min-w-[20px] text-center">{qty}</span>
            <button
              onClick={() => setQty((q) => q + 1)}
              className="w-7 h-7 rounded-md bg-neon text-[#020705] text-sm flex items-center justify-center"
            >
              +
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-muted">Precio Total</span>
        <span className="font-display font-bold text-xl text-neon">${precioTotal.toLocaleString('es-CL')}</span>
      </div>

      <button
        onClick={handleAddToCart}
        disabled={disabledAdd}
        className="w-full bg-neon text-[#020705] font-bold py-3 rounded-full text-sm shadow-[0_0_15px_rgba(0,255,179,0.4)] transition-all hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
      >
        🛒 Agregar al carrito
      </button>
    </div>
  );
}
