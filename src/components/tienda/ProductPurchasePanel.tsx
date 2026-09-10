'use client';

import { useState, useMemo } from 'react';
import type { Producto } from '@/types/domain';
import type { CatalogOptionGroup, CatalogProduct, CatalogVariant } from '@/lib/catalog/types';
import { parseFormatos, parseVariedades } from '@/lib/pricing/formatos';
import { resolveCatalogLine } from '@/lib/catalog/selection';
import { toCatalogCartItem } from '@/lib/catalog/catalog-cart';
import { useCart } from '@/lib/cart/CartContext';
import { trackAddToCart } from '@/lib/analytics/client';

type CanonicalProducto = Producto & {
  variants?: CatalogVariant[];
  optionGroups?: CatalogOptionGroup[];
};

export function ProductPurchasePanel({ producto, onAdded }: { producto: CanonicalProducto; onAdded?: () => void }) {
  const { addItem } = useCart();

  const canonicalVariants = useMemo(
    () => (producto.variants || []).filter((variant) => variant.active !== false).sort((a, b) => a.sortOrder - b.sortOrder),
    [producto.variants],
  );
  const canonicalOptionGroups = useMemo(
    () => (producto.optionGroups || []).filter((group) => group.active !== false).sort((a, b) => a.sortOrder - b.sortOrder),
    [producto.optionGroups],
  );
  const hasCanonicalCatalog = canonicalVariants.length > 0;

  const [variantId, setVariantId] = useState(() => canonicalVariants[0]?.id || '');
  const [canonicalQty, setCanonicalQty] = useState(1);
  const [selectionQtys, setSelectionQtys] = useState<Record<string, number>>({});

  const selectedVariant = canonicalVariants.find((variant) => variant.id === variantId) || canonicalVariants[0] || null;
  const canonicalSelections = useMemo(() => canonicalOptionGroups.flatMap((group) => (
    group.values
      .filter((value) => value.active !== false && Number(selectionQtys[value.id] || 0) > 0)
      .map((value) => ({
        optionGroupId: group.id,
        optionGroupName: group.name,
        optionValueId: value.id,
        code: value.code,
        label: value.label,
        quantity: Number(selectionQtys[value.id] || 0),
      }))
  )), [canonicalOptionGroups, selectionQtys]);

  const catalogProduct = useMemo<CatalogProduct>(() => ({
    id: producto.id,
    businessUnitId: String(producto.business_unit_id || ''),
    slug: producto.slug,
    name: producto.nombre,
    description: producto.descripcion,
    imageUrl: producto.imagen_url,
    active: producto.activo !== false,
    availabilityDates: [],
    emoji: producto.emoji,
    color: producto.color_fondo,
    sku: producto.sku || null,
    glutenFree: producto.gluten_free,
    nutFree: producto.nut_free,
    ingredients: producto.ingredients || [],
    allergens: producto.allergens || [],
    variants: canonicalVariants,
    optionGroups: canonicalOptionGroups,
    packComponents: [],
  }), [producto, canonicalVariants, canonicalOptionGroups]);

  const canonicalResolution = useMemo(() => {
    if (!hasCanonicalCatalog || !selectedVariant) return null;
    return resolveCatalogLine(catalogProduct, {
      productId: producto.id,
      variantId: selectedVariant.id,
      quantity: canonicalQty,
      selections: canonicalSelections.map(({ optionValueId, quantity }) => ({ optionValueId, quantity })),
    });
  }, [hasCanonicalCatalog, selectedVariant, catalogProduct, producto.id, canonicalQty, canonicalSelections]);

  function selectVariant(nextVariantId: string) {
    setVariantId(nextVariantId);
    setSelectionQtys({});
    setCanonicalQty(1);
  }

  function chooseCanonicalSingle(group: CatalogOptionGroup, optionValueId: string) {
    setSelectionQtys((prev) => {
      const next = { ...prev };
      for (const value of group.values) delete next[value.id];
      next[optionValueId] = 1;
      return next;
    });
  }

  function changeCanonicalQuantity(group: CatalogOptionGroup, optionValueId: string, delta: number) {
    setSelectionQtys((prev) => {
      const current = Number(prev[optionValueId] || 0);
      const groupTotal = group.values.reduce((sum, value) => sum + Number(prev[value.id] || 0), 0);
      const target = Number(selectedVariant?.selectionQuantity || 0);
      if (delta > 0 && target > 0 && groupTotal >= target) return prev;
      const nextValue = Math.max(0, current + delta);
      return { ...prev, [optionValueId]: nextValue };
    });
  }

  function handleCanonicalAddToCart() {
    if (!canonicalResolution?.ok || !selectedVariant) return;
    const item = toCatalogCartItem(canonicalResolution.line, { emoji: producto.emoji || '🌱' });
    addItem(item);
    trackAddToCart({
      items: [{ id: selectedVariant.sku || producto.sku || producto.id, name: producto.nombre, price: selectedVariant.price, quantity: canonicalQty }],
      value: selectedVariant.price * canonicalQty,
    });
    onAdded?.();
  }

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

  function handleLegacyAddToCart() {
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
      items: [{ id: producto.sku || producto.id, name: producto.nombre, price: precioUnitario, quantity: cantidadFinal }],
      value: precioTotal,
    });

    onAdded?.();
  }

  if (hasCanonicalCatalog && selectedVariant) {
    const canonicalPriceTotal = selectedVariant.price * canonicalQty;
    const quantityLabel = selectedVariant.unitsIncluded > 1 ? 'Cantidad de cajas' : 'Cantidad';

    return (
      <div>
        <div className="flex gap-1.5 mb-4 flex-wrap">
          <span className="pill">🌱 100% Vegano</span>
        </div>

        {canonicalVariants.length > 1 && (
          <div className="mb-4">
            <label className="block text-xs text-muted mb-2">Selecciona formato / cantidad:</label>
            <div className="grid grid-cols-2 gap-2">
              {canonicalVariants.map((variant) => (
                <button
                  key={variant.id}
                  type="button"
                  onClick={() => selectVariant(variant.id)}
                  className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                    selectedVariant.id === variant.id
                      ? 'border-neon bg-[rgba(0,255,179,0.10)] text-white'
                      : 'border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.07]'
                  }`}
                >
                  <span className="block text-sm font-bold">{variant.name}</span>
                  <span className="text-xs text-neon">${variant.price.toLocaleString('es-CL')}</span>
                  {variant.compareAtPrice && variant.compareAtPrice > variant.price && (
                    <span className="ml-1.5 text-[10px] text-white/35 line-through">${variant.compareAtPrice.toLocaleString('es-CL')}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {canonicalOptionGroups.map((group) => {
          const selectedTotal = group.values.reduce((sum, value) => sum + Number(selectionQtys[value.id] || 0), 0);
          const target = Number(selectedVariant.selectionQuantity || 0);
          return (
            <div className="mb-4" key={group.id}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label className="block text-xs text-muted">{group.name}</label>
                {group.selectionMode === 'quantity' && target > 0 && (
                  <span className={`text-[11px] font-bold ${selectedTotal === target ? 'text-neon' : 'text-white/55'}`}>
                    {selectedTotal} / {target}
                  </span>
                )}
              </div>

              {group.selectionMode === 'quantity' ? (
                <div className="flex flex-col gap-2">
                  {group.values.filter((value) => value.active !== false).map((value) => (
                    <div key={value.id} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
                      <span className="text-sm text-white">{value.label}</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => changeCanonicalQuantity(group, value.id, -1)}
                          className="w-6 h-6 rounded-md bg-white/10 text-white text-xs flex items-center justify-center"
                        >
                          −
                        </button>
                        <span className="text-sm text-white font-bold min-w-[18px] text-center">{selectionQtys[value.id] || 0}</span>
                        <button
                          type="button"
                          onClick={() => changeCanonicalQuantity(group, value.id, 1)}
                          className="w-6 h-6 rounded-md bg-neon text-[#020705] text-xs flex items-center justify-center"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {group.values.filter((value) => value.active !== false).map((value) => {
                    const selected = Number(selectionQtys[value.id] || 0) === 1;
                    return (
                      <button
                        key={value.id}
                        type="button"
                        onClick={() => chooseCanonicalSingle(group, value.id)}
                        className={`rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
                          selected ? 'border-neon bg-neon/10 text-white' : 'border-white/10 bg-white/[0.04] text-white/70'
                        }`}
                      >
                        {selected ? '✓ ' : ''}{value.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        <div className="mb-4 flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
          <span className="text-sm text-white">{quantityLabel}</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setCanonicalQty((value) => Math.max(1, value - 1))} className="w-7 h-7 rounded-md bg-white/10 text-white text-sm flex items-center justify-center">−</button>
            <span className="text-sm text-white font-bold min-w-[20px] text-center">{canonicalQty}</span>
            <button type="button" onClick={() => setCanonicalQty((value) => value + 1)} className="w-7 h-7 rounded-md bg-neon text-[#020705] text-sm flex items-center justify-center">+</button>
          </div>
        </div>

        {!canonicalResolution?.ok && canonicalOptionGroups.length > 0 && (
          <p className="mb-3 text-xs text-white/55">Completa la selección indicada para agregar este formato al carrito.</p>
        )}

        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-muted">Precio Total</span>
          <span className="font-display font-bold text-xl text-neon">${canonicalPriceTotal.toLocaleString('es-CL')}</span>
        </div>

        <button
          onClick={handleCanonicalAddToCart}
          disabled={!canonicalResolution?.ok}
          className="w-full bg-neon text-[#020705] font-bold py-3 rounded-full text-sm shadow-[0_0_15px_rgba(0,255,179,0.4)] transition-all hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
        >
          🛒 Agregar al carrito
        </button>
      </div>
    );
  }

  const disabledAdd = cantidadFinal === 0;

  return (
    <div>
      <div className="flex gap-1.5 mb-4 flex-wrap">
        <span className="pill">🌱 100% Vegano</span>
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
                  <button type="button" onClick={() => changeVariedadQty(idx, -1)} className="w-6 h-6 rounded-md bg-white/10 text-white text-xs flex items-center justify-center">−</button>
                  <span className="text-sm text-white font-bold min-w-[16px] text-center">{variedadQtys[idx]}</span>
                  <button type="button" onClick={() => changeVariedadQty(idx, 1)} className="w-6 h-6 rounded-md bg-neon text-[#020705] text-xs flex items-center justify-center">+</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mb-4 flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
          <span className="text-sm text-white">Cantidad</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-7 h-7 rounded-md bg-white/10 text-white text-sm flex items-center justify-center">−</button>
            <span className="text-sm text-white font-bold min-w-[20px] text-center">{qty}</span>
            <button type="button" onClick={() => setQty((q) => q + 1)} className="w-7 h-7 rounded-md bg-neon text-[#020705] text-sm flex items-center justify-center">+</button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-muted">Precio Total</span>
        <span className="font-display font-bold text-xl text-neon">${precioTotal.toLocaleString('es-CL')}</span>
      </div>

      <button
        onClick={handleLegacyAddToCart}
        disabled={disabledAdd}
        className="w-full bg-neon text-[#020705] font-bold py-3 rounded-full text-sm shadow-[0_0_15px_rgba(0,255,179,0.4)] transition-all hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
      >
        🛒 Agregar al carrito
      </button>
    </div>
  );
}
