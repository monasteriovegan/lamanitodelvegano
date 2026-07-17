'use client';

import { useState, useMemo } from 'react';
import type { Producto, AjustesData } from '@/types/domain';
import { parseFormatos, parseVariedades } from '@/lib/pricing/formatos';
import { useCart, itemKey } from '@/lib/cart/CartContext';

interface PromoEspecialProps {
  ajustes: AjustesData;
  productos: Producto[];
}

export function PromoEspecial({ ajustes, productos }: PromoEspecialProps) {
  const { items, addItem } = useCart();

  const activa = ajustes.promo_activa ?? false;
  const imgUrl = ajustes.promo_imagen_url ?? '';
  const prodId = ajustes.promo_producto_id ?? '';

  // 1. Si no está activa o no hay imagen promocional, no renderizar nada
  if (!activa || !imgUrl) return null;

  // 2. Buscar el producto asociado en el catálogo
  const producto = useMemo(() => {
    if (!prodId) return null;
    return productos.find((p) => p.id === prodId) || null;
  }, [prodId, productos]);

  return <PromoEspecialContenido producto={producto} imgUrl={imgUrl} itemsInCart={items} addItem={addItem} />;
}

function PromoEspecialContenido({
  producto,
  imgUrl,
  itemsInCart,
  addItem,
}: {
  producto: Producto | null;
  imgUrl: string;
  itemsInCart: ReturnType<typeof useCart>['items'];
  addItem: ReturnType<typeof useCart>['addItem'];
}) {
  const formatos = useMemo(() => parseFormatos(producto?.gramaje, producto?.precio || 0), [producto]);
  const variedades = useMemo(() => parseVariedades(producto?.variedades), [producto]);

  const tieneFormatos = formatos.length > 1 || formatos[0]?.label !== '';
  const tieneVariedades = variedades.length > 0;

  const [formatoIdx, setFormatoIdx] = useState(0);
  const [variedadVal, setVariedadVal] = useState(() => (tieneVariedades ? variedades[0] : ''));
  const [qty, setQty] = useState(1);

  const formatoActual = formatos[formatoIdx];
  const precioUnitario = formatoActual?.precio ?? producto?.precio ?? 0;
  const precioTotal = precioUnitario * qty;

  // Controlar stock disponible
  const stockMaximo = useMemo(() => {
    if (!producto || !producto.maneja_stock) return 999;
    return producto.stock ?? 0;
  }, [producto]);

  const qtyEnCarrito = useMemo(() => {
    if (!producto) return 0;
    return itemsInCart
      .filter((i) => i.productoId === producto.id)
      .reduce((acc, curr) => acc + curr.qty, 0);
  }, [producto, itemsInCart]);

  const stockDisponible = Math.max(0, stockMaximo - qtyEnCarrito);

  function handleAdd() {
    if (!producto) return;
    if (qty > stockDisponible) return;

    addItem({
      productoId: producto.id,
      nombre: producto.nombre,
      precio: precioUnitario,
      qty,
      emoji: producto.emoji || '🔥',
      formato: tieneFormatos ? formatoActual.label : null,
      variedad: tieneVariedades ? variedadVal : null,
    });

    setQty(1);
  }

  // Si no hay producto, centrar la imagen a pantalla completa (solo folleto informativo)
  if (!producto) {
    return (
      <section className="px-4 py-4 max-w-[600px] mx-auto">
        <div className="rounded-2xl overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.5)] border border-[rgba(0,255,179,0.2)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imgUrl} alt="Promoción Especial" className="w-full h-auto object-cover display-block" />
        </div>
      </section>
    );
  }

  return (
    <section className="px-4 py-4 max-w-[1100px] mx-auto">
      <div className="promo-section">
        {/* Lado Izquierdo: Imagen */}
        <div className="promo-image-container">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imgUrl} alt={producto.nombre} />
        </div>

        {/* Lado Derecho: Compra Rápida */}
        <div className="promo-buy-container">
          <div className="hpill" style={{ alignSelf: 'flex-start' }}>
            {producto.emoji || '🔥'} Especial
          </div>
          <h2 className="font-serif italic text-2xl text-white font-extrabold mb-1">{producto.nombre}</h2>
          {producto.descripcion && (
            <p className="text-white/80 text-sm leading-relaxed mb-4">
              {producto.descripcion.split(' ||| ')[0]}
            </p>
          )}

          {/* Formato / Gramaje */}
          {tieneFormatos && (
            <div className="mb-4">
              <label className="flbl">Selecciona opción / tamaño:</label>
              <select
                value={formatoIdx}
                onChange={(e) => setFormatoIdx(Number(e.target.value))}
                className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none"
              >
                {formatos.map((f, idx) => (
                  <option key={f.label} value={idx} className="bg-[#0d1e16]">
                    {f.label || 'Estándar'} {f.precio !== producto.precio ? `($${f.precio.toLocaleString('es-CL')})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Sabor / Variedad */}
          {tieneVariedades && (
            <div className="mb-4">
              <label className="flbl">Selecciona sabor / variedad:</label>
              <select
                value={variedadVal}
                onChange={(e) => setVariedadVal(e.target.value)}
                className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none"
              >
                {variedades.map((v) => (
                  <option key={v} value={v} className="bg-[#0d1e16]">
                    {v}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Precio y Cantidad */}
          <div className="border-t border-b border-[rgba(0,255,179,0.15)] py-4 mb-5 flex justify-between items-center">
            <div>
              <span className="text-[10px] text-muted uppercase font-bold tracking-wider display-block">
                Precio Total
              </span>
              <span className="font-serif italic font-bold text-2xl text-neon">
                ${precioTotal.toLocaleString('es-CL')}
              </span>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="qc">
              <button
                type="button"
                className="qb"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
              >
                -
              </button>
              <span className="qn">{qty}</span>
              <button
                type="button"
                className="qb p"
                onClick={() => setQty((q) => (q < stockDisponible ? q + 1 : q))}
              >
                +
              </button>
            </div>

            <button
              onClick={handleAdd}
              disabled={stockDisponible <= 0 || qty > stockDisponible}
              className="flex-1 bg-neon text-[#020705] font-bold h-12 rounded-xl text-sm shadow-[0_0_15px_rgba(0,255,179,0.4)] transition-all hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {stockDisponible <= 0 ? 'Sin Stock' : '🛒 Comprar Oferta'}
            </button>
          </div>

          {producto.maneja_stock && (
            <p className="text-[10px] text-muted mt-2 text-right">
              Stock disponible: {stockDisponible} un.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
