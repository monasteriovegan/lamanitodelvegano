'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { trackAddToCart } from '@/lib/analytics/client';
import { useCart } from '@/lib/cart/CartContext';
import type { PublicCatalogCampaign } from '@/lib/catalog/public-dto';
import { buildInitialOptionState, evaluateOptionSelection, purchaseActionState } from '@/lib/catalog/purchase-option-state';
import { formatDeliveryDateLabel } from '@/lib/pricing/fechas';
import { SafeStorageImage } from '@/components/media/SafeStorageImage';
import { OptionQuantitySelector } from './OptionQuantitySelector';

export function CampaignProductCard({ product, campaignTag }: {
  product: PublicCatalogCampaign['products'][number];
  campaignTag: string;
}) {
  const { addItem, openCart } = useCart();
  const [variantId, setVariantId] = useState(product.variants[0]?.id || '');
  const [quantity, setQuantity] = useState(1);
  const [selected, setSelected] = useState<Record<string, Record<string, number>>>(() => buildInitialOptionState(product.optionGroups));
  const variant = product.variants.find((item) => item.id === variantId) || product.variants[0];
  const hasStock = Boolean(variant && (!variant.managesStock || (variant.stock ?? 0) >= quantity));
  const selectionState = useMemo(
    () => evaluateOptionSelection(product.optionGroups, selected, variant?.selectionQuantity || 0, quantity),
    [product.optionGroups, quantity, selected, variant],
  );
  const actionState = purchaseActionState(quantity, selectionState);
  const image = product.campaignImageUrl || product.imageUrl;
  const name = product.campaignName || product.name;
  const description = product.campaignDescription || product.description;

  function add() {
    if (!variant || !selectionState.valid || !hasStock || quantity <= 0) return;
    addItem({
      productoId: product.id,
      nombre: product.name,
      precio: variant.price,
      qty: quantity,
      emoji: product.emoji || '🌱',
      formato: variant.name,
      variedad: selectionState.selections.length ? selectionState.selections.map((item) => `${item.quantity}× ${item.label}`).join(', ') : null,
      variantId: variant.id,
      variantSku: variant.sku,
      selections: selectionState.selections,
      campaignTag,
    });
    trackAddToCart({ items: [{ id: variant.sku || product.id, name: product.name, price: variant.price, quantity }], value: variant.price * quantity });
    openCart();
  }

  if (!variant) return null;
  return (
    <article className="overflow-hidden rounded-3xl border border-white/10 bg-[#07130e] shadow-[0_18px_70px_rgba(0,0,0,0.35)]">
      <Link href={`/productos/${product.slug}`} className="relative block aspect-square overflow-hidden bg-[#132d22]">
        <SafeStorageImage src={image} alt={product.campaignAltText || name} className="absolute inset-0 h-full w-full object-contain transition duration-500 hover:scale-[1.02]" fallback={<div className="flex h-full flex-col items-center justify-center gap-3 bg-[radial-gradient(circle_at_top,#244b39,#07130e_70%)] px-8 text-center"><span className="text-6xl">🌱</span><span className="font-display text-xl font-extrabold text-white">{name}</span><span className="text-xs text-white/55">Pack por encargo</span></div>} />
      </Link>
      <div className="space-y-5 p-5 sm:p-6">
        <div><p className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-neon">100% vegano · Solo por encargo</p><h2 className="font-display text-2xl font-extrabold text-white">{name}</h2>{description && <p className="mt-2 text-sm leading-6 text-white/65">{description}</p>}</div>
        {product.packComponents.length > 0 && <ul className="space-y-1 rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm text-white/75">{product.packComponents.map((component) => <li key={component.id}>✓ {component.quantity} {component.unit} de {component.name}</li>)}</ul>}
        {product.variants.length > 1 && <div className="grid grid-cols-2 gap-2">{product.variants.map((item) => <button key={item.id} type="button" onClick={() => { setVariantId(item.id); setQuantity(1); setSelected(buildInitialOptionState(product.optionGroups)); }} className={`rounded-xl border px-3 py-3 text-left ${item.id === variant.id ? 'border-neon bg-neon/10' : 'border-white/10 bg-white/5'}`}><span className="block text-sm font-bold text-white">{item.name}</span><span className="text-sm font-bold text-neon">${item.price.toLocaleString('es-CL')}</span>{item.compareAtPrice && item.compareAtPrice > item.price && <span className="block text-xs text-white/50 line-through">${item.compareAtPrice.toLocaleString('es-CL')}</span>}</button>)}</div>}
        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3"><span className="text-sm font-medium text-white">Cantidad de {variant.name}</span><div className="flex items-center gap-2.5"><button type="button" aria-label="Disminuir cantidad" onClick={() => setQuantity((current) => Math.max(1, current - 1))} className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-sm font-bold text-white">−</button><span className="min-w-[24px] text-center text-base font-bold text-white">{quantity}</span><button type="button" aria-label="Aumentar cantidad" onClick={() => setQuantity((current) => current + 1)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-neon text-sm font-bold text-[#020705]">+</button></div></div>
        {product.optionGroups.map((group) => <OptionQuantitySelector key={group.id} group={group} values={selected[group.id] || {}} target={group.selectionMode === 'quantity' ? variant.selectionQuantity * quantity : 1} onChange={(values) => setSelected((current) => ({ ...current, [group.id]: values }))} />)}
        {!selectionState.valid && <p role="status" className="rounded-xl border border-amber-300/35 bg-amber-300/10 px-3 py-2.5 text-xs font-semibold leading-5 text-amber-100">{selectionState.messages.join(' ')} Usa los botones + para completar tu elección.</p>}
        {product.availabilityDates.length > 0 && <p className="text-xs leading-5 text-white/60">📅 Entregas: {product.availabilityDates.map(formatDeliveryDateLabel).join(', ')}</p>}
        <div className="flex items-end justify-between gap-4 border-t border-white/10 pt-4"><div><span className="block text-xs text-white/50">{product.variants.length > 1 ? variant.name : 'Precio total'}</span><span className="font-display text-2xl font-extrabold text-neon">${(variant.price * quantity).toLocaleString('es-CL')}</span>{variant.compareAtPrice && variant.compareAtPrice > variant.price && <span className="block text-sm text-white/50 line-through">${(variant.compareAtPrice * quantity).toLocaleString('es-CL')}</span>}</div><button type="button" onClick={add} disabled={!hasStock || actionState.disabled} className={`rounded-full px-5 py-3 text-sm font-extrabold transition disabled:cursor-not-allowed disabled:opacity-35 ${hasStock && actionState.needsSelection ? 'border border-amber-300/60 bg-amber-300 text-[#171006] hover:bg-white' : 'bg-neon text-[#020705] shadow-[0_0_22px_rgba(0,255,179,0.24)] hover:bg-white'}`}>{hasStock ? actionState.label : 'Sin stock'}</button></div>
      </div>
    </article>
  );
}
