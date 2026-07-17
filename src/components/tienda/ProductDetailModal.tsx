'use client';

import { useState, useMemo } from 'react';
import type { Producto } from '@/types/domain';
import { parseFormatos, parseVariedades } from '@/lib/pricing/formatos';
import { useCart } from '@/lib/cart/CartContext';

export function ProductDetailModal({ producto, onClose }: { producto: Producto; onClose: () => void }) {
  const { addItem } = useCart();

  const formatos = useMemo(() => parseFormatos(producto.gramaje, producto.precio), [producto]);
  const variedades = useMemo(() => parseVariedades(producto.variedades), [producto]);
  const tieneFormatos = formatos.length > 1 || formatos[0].label !== '';
  const tieneVariedades = variedades.length > 0;

  const [formatoIdx, setFormatoIdx] = useState(0);
  const [qty, setQty] = useState(1);
  // Para multi-variedad: cantidad individual por sabor
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
    onClose();
  }

  const disabledAdd = cantidadFinal === 0;

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

        <div className="flex gap-1.5 mb-4 flex-wrap">
          <span className="pill">🌱 100% Vegano</span>
          {producto.gluten_free && <span className="pill">🌾 Sin Gluten</span>}
          {producto.nut_free && <span className="pill">🥜 Sin Nueces</span>}
        </div>

        {tieneFormatos && (
          <div className="mb-4">
            <label className="block text-xs text-muted mb-1.5">Selecciona formato / peso:</label>
            <select
              value={formatoIdx}
              onChange={(e) => setFormatoIdx(Number(e.target.value))}
              className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white"
            >
              {formatos.map((f, idx) => (
                <option key={f.label} value={idx} className="bg-[#0d1e16]">
                  {f.label || 'Estándar'} — ${f.precio.toLocaleString('es-CL')}
                </option>
              ))}
            </select>
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
    </div>
  );
}
