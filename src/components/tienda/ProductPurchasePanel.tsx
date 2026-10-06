'use client';

import { useState, useMemo, useRef } from 'react';
import type { Producto } from '@/types/domain';
import { parseFormatos, parseVariedades } from '@/lib/pricing/formatos';
import { useCart } from '@/lib/cart/CartContext';
import { trackAddToCart } from '@/lib/analytics/client';
import { OptionQuantitySelector } from './OptionQuantitySelector';
import type { CatalogCartSelection } from '@/lib/catalog/catalog-cart';
import {
  buildInitialOptionState,
  evaluateOptionSelection,
  purchaseActionState,
} from '@/lib/catalog/purchase-option-state';

export function ProductPurchasePanel({ producto, onAdded }: { producto: Producto; onAdded?: () => void }) {
  const { addItem, openCart } = useCart();

  const hasCanonicalVariants = Boolean(producto.variants && producto.variants.length > 0);
  const canonicalVariants = producto.variants || [];
  const canonicalOptionGroups = producto.optionGroups || [];

  // Canonical state
  const [canonicalVariantIdx, setCanonicalVariantIdx] = useState(0);
  const [optionsState, setOptionsState] = useState<Record<string, Record<string, number>>>(() =>
    buildInitialOptionState(canonicalOptionGroups),
  );
  const [canonicalQty, setCanonicalQty] = useState(1);
  const optionsContainerRef = useRef<HTMLDivElement>(null);

  // Legacy state
  const formatos = useMemo(() => parseFormatos(producto.gramaje, producto.precio), [producto]);
  const variedades = useMemo(() => parseVariedades(producto.variedades), [producto]);
  const tieneFormatosLegacy = formatos.length > 1 || formatos[0].label !== '';
  const tieneVariedadesLegacy = variedades.length > 0;

  const [formatoIdx, setFormatoIdx] = useState(0);
  const [legacyQty, setLegacyQty] = useState(1);
  const [variedadQtys, setVariedadQtys] = useState<number[]>(() => variedades.map(() => 0));

  if (hasCanonicalVariants) {
    const activeVariant = canonicalVariants[canonicalVariantIdx] || canonicalVariants[0];
    const hasOptionGroups = canonicalOptionGroups.length > 0;

    // Quantity always represents how many canonical variants the customer buys.
    // Required quantity-mode selections scale with it (2 unit empanadas = 2 flavor allocations,
    // 2 Pack 10 = 20 allocations). Single-choice options apply to the whole line.
    const quantity = canonicalQty;
    const selectionProgress = evaluateOptionSelection(
      canonicalOptionGroups,
      optionsState,
      activeVariant.selectionQuantity,
      canonicalQty,
    );
    const selections: CatalogCartSelection[] = selectionProgress.selections;

    const unitPrice = activeVariant.price;
    const compareAtPrice = activeVariant.compareAtPrice || activeVariant.compare_at_price || producto.precio_anterior || null;
    const totalPrice = unitPrice * quantity;
    const actionState = purchaseActionState(quantity, selectionProgress);

    const variedadLabel = selections.length > 0
      ? selections.map((s) => `${s.quantity}× ${s.label}`).join(', ')
      : null;

    const handleCanonicalAdd = () => {
      if (!selectionProgress.valid) {
        optionsContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      if (actionState.disabled) return;

      addItem({
        productoId: producto.id,
        nombre: producto.nombre,
        precio: unitPrice,
        qty: quantity,
        emoji: producto.emoji || '🌱',
        formato: activeVariant.name,
        variedad: variedadLabel,
        variantId: activeVariant.id,
        variantSku: activeVariant.sku || undefined,
        sku: activeVariant.sku || producto.sku || undefined,
        selections: selections.length > 0 ? selections : undefined,
      });

      trackAddToCart({
        items: [{
          id: activeVariant.sku || producto.sku || producto.id,
          name: `${producto.nombre} - ${activeVariant.name}`,
          price: unitPrice,
          quantity,
        }],
        value: totalPrice,
      });

      onAdded?.();
      openCart();
    };

    return (
      <div>
        <div className="flex gap-1.5 mb-4 flex-wrap">
          <span className="pill">🌱 100% Vegano</span>
          {producto.is_new && <span className="pill bg-neon/20 text-neon">✨ Nuevo</span>}
        </div>

        {/* Variant selector */}
        {canonicalVariants.length > 1 && (
          <div className="mb-5">
            <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">
              Selecciona presentación / formato:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {canonicalVariants.map((v, idx) => {
                const isSelected = canonicalVariantIdx === idx;
                const vCompare = v.compareAtPrice || v.compare_at_price;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => {
                      setCanonicalVariantIdx(idx);
                      setCanonicalQty(1);
                      setOptionsState(buildInitialOptionState(canonicalOptionGroups));
                    }}
                    className={`rounded-xl border p-3 text-left transition-all ${
                      isSelected
                        ? 'border-neon bg-[rgba(0,255,179,0.12)] text-white shadow-[0_0_12px_rgba(0,255,179,0.2)]'
                        : 'border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08]'
                    }`}
                  >
                    <span className="block text-sm font-bold text-white mb-0.5">{v.name}</span>
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-neon">${v.price.toLocaleString('es-CL')}</span>
                      {vCompare && (
                        <span className="text-[10px] text-white/40 line-through">
                          ${vCompare.toLocaleString('es-CL')}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Quantity is independent from flavor/adobo selection. */}
        <div className="mb-5 flex items-center justify-between bg-white/5 rounded-xl border border-white/10 px-4 py-3">
          <span className="text-sm font-medium text-white">Cantidad de {activeVariant.name}</span>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setCanonicalQty((q) => Math.max(1, q - 1))}
              className="w-8 h-8 rounded-lg bg-white/10 text-white text-sm font-bold flex items-center justify-center transition-colors hover:bg-white/20"
              aria-label="Disminuir cantidad"
            >
              −
            </button>
            <span className="text-base text-white font-bold min-w-[24px] text-center">{canonicalQty}</span>
            <button
              type="button"
              onClick={() => setCanonicalQty((q) => q + 1)}
              className="w-8 h-8 rounded-lg bg-neon text-[#020705] text-sm font-bold flex items-center justify-center transition-colors hover:bg-white"
              aria-label="Aumentar cantidad"
            >
              +
            </button>
          </div>
        </div>

        {/* Option Groups (Flavors / Toppings / inherited pack component options) */}
        {hasOptionGroups && (
          <div ref={optionsContainerRef} className="mb-5 space-y-4">
            {canonicalOptionGroups.map((group) => (
              <OptionQuantitySelector
                key={group.id}
                group={group}
                values={optionsState[group.id] || {}}
                target={group.selectionMode === 'quantity' ? activeVariant.selectionQuantity * canonicalQty : 1}
                onChange={(next) => setOptionsState((prev) => ({ ...prev, [group.id]: next }))}
              />
            ))}
          </div>
        )}

        {!selectionProgress.valid && (
          <p role="status" className="mb-4 rounded-xl border border-amber-300/35 bg-amber-300/10 px-3 py-2.5 text-xs font-semibold leading-5 text-amber-100">
            {selectionProgress.messages.join(' ')} Usa los botones + para completar tu elección.
          </p>
        )}

        {/* Price display & comparison */}
        <div className="flex items-center justify-between mb-5 bg-white/[0.02] p-3.5 rounded-xl border border-white/5">
          <div>
            <span className="text-xs text-muted block mb-0.5">Precio Total</span>
            {compareAtPrice && compareAtPrice > unitPrice && (
              <span className="text-xs text-white/40 line-through mr-2">
                ${(compareAtPrice * quantity).toLocaleString('es-CL')}
              </span>
            )}
            <span className="font-display font-extrabold text-2xl text-neon">
              ${totalPrice.toLocaleString('es-CL')}
            </span>
          </div>
          {compareAtPrice && compareAtPrice > unitPrice && (
            <span className="text-[11px] font-bold text-neon bg-neon/10 px-2.5 py-1 rounded-full border border-neon/20">
              Ahorras ${((compareAtPrice - unitPrice) * quantity).toLocaleString('es-CL')}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleCanonicalAdd}
          disabled={actionState.disabled}
          className={`w-full font-bold py-3.5 rounded-full text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none ${actionState.needsSelection ? 'border border-amber-300/60 bg-amber-300 text-[#171006] shadow-[0_0_20px_rgba(252,211,77,0.2)] hover:bg-white' : 'bg-neon text-[#020705] shadow-[0_0_20px_rgba(0,255,179,0.35)] hover:bg-white'}`}
        >
          {actionState.label}
        </button>
      </div>
    );
  }

  // --- Fallback for legacy products ---
  const formatoActual = formatos[formatoIdx];
  const precioUnitario = formatoActual.precio;
  const totalVariedades = variedadQtys.reduce((a, b) => a + b, 0);
  const cantidadFinal = tieneVariedadesLegacy ? totalVariedades : legacyQty;
  const precioTotal = precioUnitario * (tieneVariedadesLegacy ? Math.max(totalVariedades, 1) : legacyQty);

  function changeVariedadQty(idx: number, delta: number) {
    setVariedadQtys((prev) => prev.map((q, i) => (i === idx ? Math.max(0, q + delta) : q)));
  }

  function handleLegacyAddToCart() {
    if (tieneVariedadesLegacy) {
      variedadQtys.forEach((q, idx) => {
        if (q > 0) {
          addItem({
            productoId: producto.id,
            nombre: producto.nombre,
            precio: precioUnitario,
            qty: q,
            emoji: producto.emoji || '🌱',
            formato: tieneFormatosLegacy ? formatoActual.label : null,
            variedad: variedades[idx],
            sku: producto.sku || undefined,
          });
        }
      });
    } else {
      addItem({
        productoId: producto.id,
        nombre: producto.nombre,
        precio: precioUnitario,
        qty: legacyQty,
        emoji: producto.emoji || '🌱',
        formato: tieneFormatosLegacy ? formatoActual.label : null,
        variedad: null,
        sku: producto.sku || undefined,
      });
    }

    trackAddToCart({
      items: [{ id: producto.sku || producto.id, name: producto.nombre, price: precioUnitario, quantity: cantidadFinal }],
      value: precioTotal,
    });

    onAdded?.();
    openCart();
  }

  const disabledAddLegacy = cantidadFinal === 0;

  return (
    <div>
      <div className="flex gap-1.5 mb-4 flex-wrap">
        <span className="pill">🌱 100% Vegano</span>
      </div>

      {tieneFormatosLegacy && (
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

      {tieneVariedadesLegacy ? (
        <div className="mb-4">
          <label className="block text-xs text-muted mb-2">Selecciona sabores y cantidades:</label>
          <div className="flex flex-col gap-2">
            {variedades.map((v, idx) => (
              <div key={v} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
                <span className="text-sm text-white">{v}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => changeVariedadQty(idx, -1)}
                    className="w-6 h-6 rounded-md bg-white/10 text-white text-xs flex items-center justify-center"
                  >
                    −
                  </button>
                  <span className="text-sm text-white font-bold min-w-[16px] text-center">{variedadQtys[idx]}</span>
                  <button
                    type="button"
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
              type="button"
              onClick={() => setLegacyQty((q) => Math.max(1, q - 1))}
              className="w-7 h-7 rounded-md bg-white/10 text-white text-sm flex items-center justify-center"
            >
              −
            </button>
            <span className="text-sm text-white font-bold min-w-[20px] text-center">{legacyQty}</span>
            <button
              type="button"
              onClick={() => setLegacyQty((q) => q + 1)}
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
        type="button"
        onClick={handleLegacyAddToCart}
        disabled={disabledAddLegacy}
        className="w-full bg-neon text-[#020705] font-bold py-3 rounded-full text-sm shadow-[0_0_15px_rgba(0,255,179,0.4)] transition-all hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
      >
        🛒 Agregar al carrito
      </button>
    </div>
  );
}
