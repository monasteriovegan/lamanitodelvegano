'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useCart } from '@/lib/cart/CartContext';
import type { CatalogCartSelection } from '@/lib/catalog/catalog-cart';
import type { PublicCatalogCampaign, PublicCatalogProduct } from '@/lib/catalog/public-dto';
import { trackAddToCart } from '@/lib/analytics/client';
import { formatDeliveryDateLabel } from '@/lib/pricing/fechas';
import { OptionQuantitySelector } from './OptionQuantitySelector';

function CampaignProductCard({ product, campaignTag }: { product: PublicCatalogProduct; campaignTag: string }) {
  const { addItem, openCart } = useCart();
  const [variantId, setVariantId] = useState(product.variants[0]?.id || '');
  const [selected, setSelected] = useState<Record<string, Record<string, number>>>({});
  const variant = product.variants.find((item) => item.id === variantId) || product.variants[0];

  const selectionState = useMemo(() => {
    const selections: CatalogCartSelection[] = [];
    let valid = Boolean(variant);
    for (const group of product.optionGroups) {
      const values = selected[group.id] || {};
      const total = Object.values(values).reduce((sum, quantity) => sum + quantity, 0);
      const expected = group.selectionMode === 'quantity' ? (variant?.selectionQuantity || 0) : 1;
      if (group.required && total !== expected) valid = false;
      for (const value of group.values) {
        const quantity = values[value.id] || 0;
        if (quantity > 0) selections.push({
          optionGroupId: group.id,
          optionGroupName: group.name,
          optionValueId: value.id,
          code: value.code,
          label: value.label,
          quantity,
        });
      }
    }
    return { selections, valid };
  }, [product.optionGroups, selected, variant]);

  function add() {
    if (!variant || !selectionState.valid) return;
    addItem({
      productoId: product.id,
      nombre: product.name,
      precio: variant.price,
      qty: 1,
      emoji: product.emoji || '🌱',
      formato: variant.name,
      variedad: selectionState.selections.length
        ? selectionState.selections.map((item) => `${item.quantity}× ${item.label}`).join(', ')
        : null,
      variantId: variant.id,
      variantSku: variant.sku,
      selections: selectionState.selections,
      campaignTag,
    });
    trackAddToCart({ items: [{ id: product.id, name: product.name, price: variant.price, quantity: 1 }], value: variant.price });
    openCart();
  }

  if (!variant) return null;

  return (
    <article className="overflow-hidden rounded-3xl border border-white/10 bg-[#07130e] shadow-[0_18px_70px_rgba(0,0,0,0.35)]">
      <Link href={`/productos/${product.slug}`} className="relative block aspect-square overflow-hidden bg-[#132d22]">
        {product.imageUrl ? (
          <Image src={product.imageUrl} alt={product.name} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover transition duration-500 hover:scale-[1.02]" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 bg-[radial-gradient(circle_at_top,#244b39,#07130e_70%)] px-8 text-center">
            <span className="text-6xl">🌱</span>
            <span className="font-display text-xl font-extrabold text-white">{product.name}</span>
            <span className="text-xs text-white/55">Pack por encargo</span>
          </div>
        )}
      </Link>
      <div className="space-y-5 p-5 sm:p-6">
        <div>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-neon">100% vegano · Solo por encargo</p>
          <h2 className="font-display text-2xl font-extrabold text-white">{product.name}</h2>
          {product.description && <p className="mt-2 text-sm leading-6 text-white/65">{product.description}</p>}
        </div>

        {product.packComponents.length > 0 && (
          <ul className="space-y-1 rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm text-white/75">
            {product.packComponents.map((component) => (
              <li key={component.id}>✓ {component.quantity} {component.unit} de {component.name}</li>
            ))}
          </ul>
        )}

        {product.variants.length > 1 && (
          <div className="grid grid-cols-2 gap-2">
            {product.variants.map((item) => (
              <button key={item.id} type="button" onClick={() => { setVariantId(item.id); setSelected({}); }} className={`rounded-xl border px-3 py-3 text-left ${item.id === variant.id ? 'border-neon bg-neon/10' : 'border-white/10 bg-white/5'}`}>
                <span className="block text-sm font-bold text-white">{item.name}</span>
                <span className="text-sm font-bold text-neon">${item.price.toLocaleString('es-CL')}</span>
              </button>
            ))}
          </div>
        )}

        {product.optionGroups.map((group) => (
          <OptionQuantitySelector
            key={group.id}
            group={group}
            values={selected[group.id] || {}}
            target={group.selectionMode === 'quantity' ? variant.selectionQuantity : 1}
            onChange={(values) => setSelected((current) => ({ ...current, [group.id]: values }))}
          />
        ))}

        {product.availabilityDates.length > 0 && (
          <p className="text-xs leading-5 text-white/60">📅 Entregas: {product.availabilityDates.map(formatDeliveryDateLabel).join(', ')}</p>
        )}

        <div className="flex items-end justify-between gap-4 border-t border-white/10 pt-4">
          <div>
            <span className="block text-xs text-white/50">{product.variants.length > 1 ? variant.name : 'Precio'}</span>
            <span className="font-display text-2xl font-extrabold text-neon">${variant.price.toLocaleString('es-CL')}</span>
          </div>
          <button type="button" onClick={add} disabled={!selectionState.valid} className="rounded-full bg-neon px-5 py-3 text-sm font-extrabold text-[#020705] shadow-[0_0_22px_rgba(0,255,179,0.24)] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-35">
            Agregar 🛒
          </button>
        </div>
      </div>
    </article>
  );
}
export function CampaignCatalog({ campaign }: { campaign: PublicCatalogCampaign }) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {campaign.products.map((product) => <CampaignProductCard key={product.id} product={product} campaignTag={campaign.campaignTag} />)}
    </div>
  );
}
