'use client';
/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

type SeasonalVariant = {
  id: string;
  sku: string;
  name: string;
  masterPrice: number;
  masterCompareAtPrice: number | null;
  priceOverride: number | null;
  compareAtPriceOverride: number | null;
  stock: number | null;
  managesStock: boolean;
  active: boolean;
};

type SeasonalProduct = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  visibility: { web: boolean; whatsapp: boolean; instagram: boolean; remy: boolean };
  variants: SeasonalVariant[];
  optionGroups: Array<{ id: string; name: string; values: Array<{ id: string; label: string; active: boolean }> }>;
};

type Season = { id: string; name: string; campaign_tag?: string | null; starts_at?: string | null; ends_at?: string | null; is_active: boolean };

const money = (value: number | null | undefined) => value == null ? '—' : `$${value.toLocaleString('es-CL')}`;
const inputClass = 'mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-neon focus:outline-none';

export default function SeasonCatalogEditor({ seasonId }: { seasonId: string }) {
  const [season, setSeason] = useState<Season | null>(null);
  const [products, setProducts] = useState<SeasonalProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch(`/api/admin/temporadas/${seasonId}/catalogo`, { cache: 'no-store' });
    const body = await response.json();
    if (!response.ok) {
      setMessage(`Error: ${body.error || 'No se pudo cargar la temporada.'}`);
      setLoading(false);
      return;
    }
    setSeason(body.data?.season || null);
    setProducts(body.data?.products || []);
    setLoading(false);
  }, [seasonId]);

  useEffect(() => { void load(); }, [load]);

  const patch = async (payload: Record<string, unknown>) => {
    setMessage('Guardando…');
    const response = await fetch(`/api/admin/temporadas/${seasonId}/catalogo`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const body = await response.json();
      setMessage(`Error: ${body.error || 'No se pudo guardar.'}`);
      return false;
    }
    setMessage('✓ Cambios guardados solo para esta temporada. El Catálogo Master no fue modificado.');
    return true;
  };

  const setVisibility = async (productId: string, key: keyof SeasonalProduct['visibility'], value: boolean) => {
    setProducts((all) => all.map((product) => product.id === productId ? { ...product, visibility: { ...product.visibility, [key]: value } } : product));
    const field = { web: 'visibleWeb', whatsapp: 'visibleWhatsapp', instagram: 'visibleInstagram', remy: 'availableToRemy' }[key];
    if (!(await patch({ productId, [field]: value }))) await load();
  };

  const saveOverride = async (productId: string, variant: SeasonalVariant, next: Partial<Pick<SeasonalVariant, 'priceOverride' | 'compareAtPriceOverride'>>) => {
    const updated = { ...variant, ...next };
    setProducts((all) => all.map((product) => product.id === productId ? {
      ...product,
      variants: product.variants.map((row) => row.id === variant.id ? updated : row),
    } : product));
    if (!(await patch({
      productId,
      variantId: variant.id,
      priceOverride: updated.priceOverride,
      compareAtPriceOverride: updated.compareAtPriceOverride,
    }))) await load();
  };

  const clearOverride = async (productId: string, variantId: string) => {
    if (await patch({ productId, variantId, clearOverride: true })) await load();
  };

  return (
    <div className="max-w-[1150px] w-full text-crema">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/temporadas" className="text-xs font-semibold text-neon hover:text-white">← Temporadas & Colecciones</Link>
          <p className="mt-4 text-[11px] tracking-[4px] text-neon uppercase font-display">📅 Temporada</p>
          <h1 className="font-display font-bold text-3xl text-white">{season?.name || 'Catálogo de temporada'}</h1>
          {season && <p className="mt-1 text-xs text-muted">{[season.starts_at && `Inicio ${new Date(season.starts_at).toLocaleDateString('es-CL')}`, season.ends_at && `Término ${new Date(season.ends_at).toLocaleDateString('es-CL')}`].filter(Boolean).join(' · ') || 'Sin fechas definidas'}</p>}
        </div>
        <Link href="/admin/productos" className="rounded-xl border border-neon/30 px-4 py-2 text-sm font-bold text-neon">Abrir Catálogo Master</Link>
      </div>

      <div className="mb-5 rounded-2xl border border-neon/20 bg-neon/[0.05] p-4 text-sm text-white/75">
        <strong className="text-neon">Precio maestro ≠ precio temporal.</strong> Los valores promocionales que guardes aquí solo se aplican mientras esta colección esté activa y visible. El precio y stock base permanecen en Catálogo Master.
      </div>
      {message && <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-white">{message}</div>}

      {loading ? <p className="text-sm text-muted">Cargando catálogo de la temporada…</p> : products.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-muted">Esta temporada todavía no tiene productos. Vuelve a Temporadas & Colecciones y agrega productos desde “Editar”.</div>
      ) : (
        <div className="space-y-5">
          {products.map((product) => (
            <section key={product.id} className="rounded-2xl border border-white/10 bg-[#050e0a] p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><h2 className="font-bold text-white">{product.name}</h2><p className="text-xs text-muted">{product.slug} · {product.active ? 'Activo en Master' : 'Inactivo en Master'}</p></div>
                <Link href={`/admin/productos?buscar=${encodeURIComponent(product.name)}`} className="text-xs font-semibold text-white/50 hover:text-neon">Editar ficha maestra →</Link>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
                {([
                  ['web', 'Web'], ['whatsapp', 'WhatsApp'], ['instagram', 'Instagram'], ['remy', 'Remy'],
                ] as const).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.035] p-3 text-xs">
                    <input type="checkbox" checked={product.visibility[key]} onChange={(event) => void setVisibility(product.id, key, event.target.checked)} />
                    {label}
                  </label>
                ))}
              </div>

              <div className="mt-5 space-y-3">
                {product.variants.map((variant) => {
                  const effective = variant.priceOverride ?? variant.masterPrice;
                  const hasOverride = variant.priceOverride !== null || variant.compareAtPriceOverride !== null;
                  return (
                    <div key={variant.id} className="rounded-xl border border-white/8 bg-white/[0.025] p-4">
                      <div className="grid gap-3 md:grid-cols-[1.3fr_150px_170px_170px_auto] md:items-end">
                        <div>
                          <strong className="text-sm text-white">{variant.name}</strong>
                          <div className="mt-0.5 text-[11px] text-muted">{variant.sku}</div>
                          <div className="mt-1 text-[11px] text-white/45">{variant.managesStock ? `Stock Master: ${variant.stock ?? 0}` : 'Sin stock físico gestionado'}</div>
                        </div>
                        <div><span className="block text-[10px] uppercase tracking-wider text-muted">Precio maestro</span><div className="mt-1 rounded-lg border border-white/8 bg-black/20 px-3 py-2 text-sm font-bold text-white/70">{money(variant.masterPrice)}</div></div>
                        <label className="text-[10px] uppercase tracking-wider text-muted">Precio de esta temporada
                          <input className={inputClass} type="number" min={0} value={variant.priceOverride ?? ''} placeholder={String(variant.masterPrice)} onChange={(e) => {
                            const value = e.target.value === '' ? null : Number(e.target.value);
                            setProducts((all) => all.map((p) => p.id === product.id ? { ...p, variants: p.variants.map((v) => v.id === variant.id ? { ...v, priceOverride: value } : v) } : p));
                          }} onBlur={(e) => void saveOverride(product.id, variant, { priceOverride: e.target.value === '' ? null : Number(e.target.value) })} />
                        </label>
                        <label className="text-[10px] uppercase tracking-wider text-muted">Precio anterior / referencia
                          <input className={inputClass} type="number" min={0} value={variant.compareAtPriceOverride ?? ''} placeholder={variant.masterCompareAtPrice == null ? 'Opcional' : String(variant.masterCompareAtPrice)} onChange={(e) => {
                            const value = e.target.value === '' ? null : Number(e.target.value);
                            setProducts((all) => all.map((p) => p.id === product.id ? { ...p, variants: p.variants.map((v) => v.id === variant.id ? { ...v, compareAtPriceOverride: value } : v) } : p));
                          }} onBlur={(e) => void saveOverride(product.id, variant, { compareAtPriceOverride: e.target.value === '' ? null : Number(e.target.value) })} />
                        </label>
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[10px] uppercase tracking-wider text-muted">Efectivo</span>
                          <span className="rounded-lg bg-neon/10 px-3 py-2 text-sm font-extrabold text-neon">{money(effective)}</span>
                          {hasOverride && <button type="button" onClick={() => void clearOverride(product.id, variant.id)} className="text-[10px] text-red-300 hover:text-red-200">Quitar promoción</button>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {product.optionGroups.length > 0 && (
                <div className="mt-5 border-t border-white/8 pt-4">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted">Opciones / sabores definidos en Catálogo Master</p>
                  {product.optionGroups.map((group) => <div key={group.id} className="mb-2"><span className="mr-2 text-xs font-semibold text-white/70">{group.name}:</span>{group.values.filter((value) => value.active).map((value) => <span key={value.id} className="mr-1.5 inline-block rounded-full border border-white/10 px-2.5 py-1 text-[10px] text-white/60">{value.label}</span>)}</div>)}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
