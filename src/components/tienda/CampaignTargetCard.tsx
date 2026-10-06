'use client';

import { useMemo, useState } from 'react';
import { trackAddToCart } from '@/lib/analytics/client';
import { useCart } from '@/lib/cart/CartContext';
import { toCampaignTargetCartItem } from '@/lib/catalog/catalog-cart';
import type { PublicCatalogCampaign } from '@/lib/catalog/public-dto';
import { SafeStorageImage } from '@/components/media/SafeStorageImage';

export function CampaignTargetCard({ product, campaignTag }: {
  product: PublicCatalogCampaign['products'][number];
  campaignTag: string;
}) {
  const { addItem, openCart } = useCart();
  const [selectedTargetId, setSelectedTargetId] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const purchaseTargets = product.purchaseTargets;
  const selectedTarget = purchaseTargets.find((target) => target.id === selectedTargetId);
  const groups = useMemo(() => {
    const grouped = new Map<string, typeof purchaseTargets>();
    for (const target of purchaseTargets) grouped.set(target.groupLabel, [...(grouped.get(target.groupLabel) || []), target]);
    return [...grouped.entries()];
  }, [purchaseTargets]);
  const hasStock = Boolean(selectedTarget && (!selectedTarget.managesStock || (selectedTarget.stock ?? 0) >= quantity));
  const image = product.campaignImageUrl || product.imageUrl;
  const name = product.campaignName || product.name;
  const description = product.campaignDescription || product.description;

  function add() {
    if (!selectedTarget || !hasStock) return;
    const item = toCampaignTargetCartItem(name, selectedTarget, quantity, campaignTag);
    if (!item) return;
    addItem(item);
    trackAddToCart({ items: [{ id: selectedTarget.variantSku, name: selectedTarget.productName, price: selectedTarget.price, quantity }], value: selectedTarget.price * quantity });
    openCart();
  }

  if (!purchaseTargets.length) return null;
  return (
    <article className="overflow-hidden rounded-3xl border border-neon/25 bg-[#07130e] shadow-[0_18px_70px_rgba(0,0,0,0.35)]">
      <div className="relative aspect-square overflow-hidden bg-[#132d22]"><SafeStorageImage src={image} alt={product.campaignAltText || name} className="absolute inset-0 h-full w-full object-contain" fallback={<div className="flex h-full items-center justify-center text-7xl">🍫</div>} /></div>
      <div className="space-y-5 p-5 sm:p-6">
        <div><p className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-neon">Elige universo y formato</p><h2 className="font-display text-2xl font-extrabold text-white">{name}</h2>{description && <p className="mt-2 text-sm leading-6 text-white/65">{description}</p>}</div>
        <div className="space-y-4">{groups.map(([groupLabel, targets]) => <fieldset key={groupLabel}><legend className="mb-2 text-sm font-extrabold text-white">{groupLabel}</legend><div className="grid grid-cols-2 gap-2">{targets.map((target) => { const available = !target.managesStock || (target.stock ?? 0) > 0; return <button key={target.id} type="button" disabled={!available} onClick={() => { setSelectedTargetId(target.id); setQuantity(1); }} className={`rounded-xl border px-3 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-35 ${selectedTargetId === target.id ? 'border-neon bg-neon/10' : 'border-white/10 bg-white/5 hover:border-white/30'}`}><span className="block text-sm font-bold text-white">{target.optionLabel}</span><span className="text-sm font-extrabold text-neon">${target.price.toLocaleString('es-CL')}</span>{target.compareAtPrice && target.compareAtPrice > target.price && <span className="block text-xs text-white/50 line-through">${target.compareAtPrice.toLocaleString('es-CL')}</span>}</button>; })}</div></fieldset>)}</div>
        {selectedTarget && <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3"><span className="text-sm font-medium text-white">Cantidad</span><div className="flex items-center gap-2.5"><button type="button" aria-label="Disminuir cantidad" onClick={() => setQuantity((current) => Math.max(1, current - 1))} className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 font-bold text-white">−</button><span className="min-w-[24px] text-center font-bold text-white">{quantity}</span><button type="button" aria-label="Aumentar cantidad" onClick={() => setQuantity((current) => current + 1)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-neon font-bold text-[#020705]">+</button></div></div>}
        <button type="button" onClick={add} disabled={!selectedTarget || !hasStock} className="w-full rounded-full bg-neon px-5 py-3 text-sm font-extrabold text-[#020705] shadow-[0_0_22px_rgba(0,255,179,0.24)] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-35">{!selectedTarget ? 'Elige una opción' : hasStock ? '🛒 Agregar al carrito' : 'Sin stock'}</button>
      </div>
    </article>
  );
}
