'use client';
/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '../_ui/AdminUI';

type Product = any;

export default function CatalogoMasterPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch('/api/admin/catalog-master', { cache: 'no-store' });
    const body = await response.json();
    setProducts(body.data?.products || []);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const update = async (payload: Record<string, unknown>) => {
    setMessage('Guardando…');
    const response = await fetch('/api/admin/catalog-master', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    setMessage(response.ok ? 'Cambios guardados desde la fuente única de verdad.' : `Error: ${(await response.json()).error}`);
    if (response.ok) await load();
  };

  return <div className="max-w-[1100px] text-crema">
    <PageHeader eyebrow="🌱 Catálogo Master" title="Fiestas Patrias 2026" />
    <p className="mb-4 text-sm text-muted">Precios, variantes y visibilidad por canal. Los cambios se aplican a web, Remy y mensajería sin duplicar productos.</p>
    {message && <div className="mb-4 rounded-xl border border-neon/30 bg-neon/5 p-3 text-sm text-neon">{message}</div>}
    {loading ? <p>Cargando catálogo…</p> : <div className="space-y-4">{products.map((product) => <section key={product.id} className="rounded-2xl border border-white/10 bg-[#050e0a] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="font-bold text-white">{product.name}</h2><p className="text-xs text-muted">{product.slug}</p></div>
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={product.active} onChange={(e) => void update({ productId: product.id, productActive: e.target.checked })} /> Producto activo</label>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">{([
        ['web', 'visibleWeb', 'Web'], ['whatsapp', 'visibleWhatsapp', 'WhatsApp'],
        ['instagram', 'visibleInstagram', 'Instagram'], ['remy', 'availableToRemy', 'Remy'],
      ] as const).map(([key, field, label]) => <label key={key} className="flex items-center gap-2 rounded-lg bg-white/5 p-2 text-xs">
        <input type="checkbox" checked={Boolean(product.visibility[key])} onChange={(e) => void update({ productId: product.id, [field]: e.target.checked })} /> {label}
      </label>)}</div>
      <div className="mt-4 space-y-2">{product.variants.map((variant: any) => <div key={variant.id} className="grid items-center gap-2 rounded-xl border border-white/5 p-3 md:grid-cols-[1fr_150px_120px_110px]">
        <div><strong className="text-sm text-white">{variant.name}</strong><div className="text-[11px] text-muted">{variant.sku}</div></div>
        <label className="text-xs">Precio CLP<input className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white" type="number" defaultValue={variant.price} onBlur={(e) => void update({ productId: product.id, variantId: variant.id, price: Number(e.target.value) })} /></label>
        <label className="text-xs">Stock/cupo<input className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white" type="number" value={variant.stock ?? ''} placeholder="Sin límite" onChange={(e) => setProducts((all) => all.map((p) => p.id === product.id ? { ...p, variants: p.variants.map((v: any) => v.id === variant.id ? { ...v, stock: e.target.value === '' ? null : Number(e.target.value) } : v) } : p))} onBlur={() => void update({ productId: product.id, variantId: variant.id, stock: variant.stock })} /></label>
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={variant.active} onChange={(e) => void update({ productId: product.id, variantId: variant.id, variantActive: e.target.checked })} /> Variante activa</label>
      </div>)}</div>
      {product.optionGroups.map((group: any) => <div key={group.id} className="mt-4"><h3 className="mb-2 text-xs font-bold uppercase text-muted">{group.name}</h3><div className="flex flex-wrap gap-2">{group.values.map((value: any) => <label key={value.id} className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs"><input type="checkbox" checked={value.active} onChange={(e) => void update({ productId: product.id, optionValueId: value.id, optionActive: e.target.checked })} />{value.label}</label>)}</div></div>)}
    </section>)}</div>}
  </div>;
}
