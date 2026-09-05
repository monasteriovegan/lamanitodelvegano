'use client';
/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PageHeader, Badge, EmptyState } from '../_ui/AdminUI';
import { AdminImageUploadField } from '../_ui/AdminImageUploadField';

const EMPTY = {
  name: '', slug: '', description: '', starts_at: '', ends_at: '',
  color_start: '#1e3f20', color_end: '#00ffb3', is_active: true,
  banner_image: '', badge_text: '',
};

function slugify(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
}

export default function TemporadasPage() {
  const [seasons, setSeasons] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [seasonResponse, productResponse] = await Promise.all([
        fetch('/api/admin/temporadas', { cache: 'no-store' }),
        fetch('/api/admin/products', { cache: 'no-store' }),
      ]);
      const [seasonBody, productBody] = await Promise.all([seasonResponse.json(), productResponse.json()]);
      setSeasons(seasonBody.data || []);
      setProducts(productBody.data || []);
    } catch (error) {
      setMessage(`Error cargando temporadas: ${error instanceof Error ? error.message : 'desconocido'}`);
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ ...EMPTY });
    setSelectedProducts([]);
    setShowForm(true);
  };

  const openEdit = (season: any) => {
    setEditing(String(season.id));
    setForm({
      name: season.name || '', slug: season.slug || season.campaign_tag || '', description: season.description || '',
      starts_at: season.starts_at ? String(season.starts_at).slice(0, 10) : '',
      ends_at: season.ends_at ? String(season.ends_at).slice(0, 10) : '',
      color_start: season.color_start || '#1e3f20', color_end: season.color_end || '#00ffb3',
      is_active: season.is_active !== false, banner_image: season.banner_image || '', badge_text: season.badge_text || '',
    });
    setSelectedProducts((season.season_products || []).map((link: any) => String(link.product_id)));
    setShowForm(true);
  };

  const save = async () => {
    if (!form.name.trim()) return setMessage('El nombre es obligatorio.');
    setSaving(true);
    setMessage('Guardando…');
    const payload = { ...form, slug: form.slug || slugify(form.name), campaign_tag: form.slug || slugify(form.name), product_ids: selectedProducts };
    const response = await fetch(editing ? `/api/admin/temporadas/${editing}` : '/api/admin/temporadas', {
      method: editing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    const body = await response.json();
    if (!response.ok) setMessage(`Error: ${body.error || 'No se pudo guardar.'}`);
    else {
      setMessage(editing ? '✓ Temporada actualizada.' : '✓ Temporada creada.');
      setShowForm(false);
      await load();
    }
    setSaving(false);
  };

  const toggleActive = async (season: any) => {
    await fetch(`/api/admin/temporadas/${season.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: !season.is_active }),
    });
    await load();
  };

  const remove = async (id: string) => {
    if (!window.confirm('¿Eliminar esta temporada? Los productos del Catálogo Master no se borrarán.')) return;
    const response = await fetch(`/api/admin/temporadas/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      const body = await response.json();
      setMessage(`Error: ${body.error || 'No se pudo eliminar.'}`);
      return;
    }
    setMessage('✓ Temporada eliminada. El Catálogo Master quedó intacto.');
    await load();
  };

  const now = Date.now();
  const activeCount = seasons.filter((season) => season.is_active && (!season.starts_at || new Date(season.starts_at).getTime() <= now) && (!season.ends_at || new Date(season.ends_at).getTime() >= now)).length;
  const upcomingCount = seasons.filter((season) => season.starts_at && new Date(season.starts_at).getTime() > now).length;
  const pastCount = seasons.filter((season) => season.ends_at && new Date(season.ends_at).getTime() < now).length;

  return (
    <div className="max-w-[1050px] w-full text-crema">
      <PageHeader
        eyebrow="🌱 Catálogo"
        title="Temporadas & Colecciones"
        action={<div className="flex flex-wrap gap-2"><Link href="/admin/productos" className="rounded-xl border border-neon/30 px-4 py-2 text-sm font-bold text-neon">Catálogo Master</Link><button onClick={openNew} className="rounded-xl bg-neon px-4 py-2 text-sm font-bold text-black">+ Nueva temporada</button></div>}
      />
      <p className="mb-5 text-sm text-muted">Crea campañas reutilizables como Fiestas Patrias, Navidad o San Valentín. Los productos siguen viviendo una sola vez en Catálogo Master.</p>
      {message && <div className="mb-5 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-white">{message}</div>}

      <div className="mb-6 grid grid-cols-3 gap-3">
        {[['Activas ahora', activeCount], ['Próximas', upcomingCount], ['Finalizadas', pastCount]].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-white/10 bg-[#050e0a] p-4"><div className="text-[10px] uppercase tracking-wider text-muted">{label}</div><div className="mt-1 text-2xl font-bold text-neon">{value}</div></div>)}
      </div>

      {showForm && (
        <div className="mb-6 rounded-2xl border border-neon/20 bg-[#050e0a] p-5">
          <div className="mb-5 flex items-center justify-between"><div><h2 className="font-bold text-white">{editing ? 'Editar temporada' : 'Nueva temporada'}</h2><p className="mt-1 text-xs text-muted">Las promociones y canales se gestionan después dentro de cada temporada.</p></div><button onClick={() => setShowForm(false)} className="text-xs text-muted">Cerrar</button></div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs text-muted md:col-span-2">Nombre<input value={form.name} onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))} placeholder="Ej: Navidad 2026" className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-white" /></label>
            <label className="text-xs text-muted">Inicio<input type="date" value={form.starts_at} onChange={(e) => setForm((current) => ({ ...current, starts_at: e.target.value }))} className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-white" /></label>
            <label className="text-xs text-muted">Término<input type="date" value={form.ends_at} onChange={(e) => setForm((current) => ({ ...current, ends_at: e.target.value }))} className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-white" /></label>
            <label className="text-xs text-muted md:col-span-2">Descripción<textarea rows={2} value={form.description} onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))} className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-white" /></label>
            <label className="text-xs text-muted">Etiqueta<input value={form.badge_text} onChange={(e) => setForm((current) => ({ ...current, badge_text: e.target.value }))} placeholder="Edición limitada" className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-white" /></label>
            <AdminImageUploadField
              name="banner_image"
              label="Banner de temporada"
              value={form.banner_image}
              onChange={(banner_image) => setForm((current) => ({ ...current, banner_image }))}
              manualLabel="Usar URL manual"
              helpText="Sube el banner desde tu computador o conserva una URL externa si ya existe."
              className="md:col-span-2"
            />
          </div>

          <div className="mt-5 border-t border-white/8 pt-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">Productos de esta colección ({selectedProducts.length})</p>
            <div className="grid max-h-52 grid-cols-2 gap-2 overflow-y-auto md:grid-cols-3">
              {products.map((product: any) => {
                const id = String(product.id);
                const selected = selectedProducts.includes(id);
                return <button type="button" key={id} onClick={() => setSelectedProducts((current) => selected ? current.filter((item) => item !== id) : [...current, id])} className={`rounded-xl border p-3 text-left text-xs font-semibold ${selected ? 'border-neon/40 bg-neon/10 text-neon' : 'border-white/8 bg-white/[0.03] text-white/60'}`}>{selected ? '✓ ' : ''}{product.name || product.nombre}</button>;
              })}
            </div>
          </div>

          <div className="mt-5 flex gap-2"><button disabled={saving} onClick={() => void save()} className="rounded-xl bg-neon px-5 py-2.5 text-sm font-bold text-black disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar temporada'}</button><button onClick={() => setShowForm(false)} className="rounded-xl border border-white/10 px-5 py-2.5 text-sm text-white">Cancelar</button></div>
        </div>
      )}

      <div className="space-y-4">
        {loading ? <p className="py-10 text-center text-sm text-muted">Cargando temporadas…</p> : seasons.length === 0 ? <div className="rounded-2xl border border-white/10 bg-[#050e0a] p-8"><EmptyState emoji="🍂" texto="Aún no hay colecciones estacionales registradas." /></div> : seasons.map((season: any) => {
          const isNow = season.is_active && (!season.starts_at || new Date(season.starts_at).getTime() <= now) && (!season.ends_at || new Date(season.ends_at).getTime() >= now);
          return (
            <section key={season.id} className={`rounded-2xl border bg-[#050e0a] p-5 ${isNow ? 'border-neon/35' : 'border-white/10'}`}>
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2"><h2 className="font-bold text-white">{season.name}</h2>{isNow && <Badge tono="neon">ACTIVA</Badge>}{season.badge_text && <span className="rounded-md border border-white/10 px-2 py-0.5 text-[10px] text-white/60">{season.badge_text}</span>}</div>
                  {season.description && <p className="mt-1 text-xs text-muted">{season.description}</p>}
                  <p className="mt-2 text-[11px] text-white/45">{season.starts_at ? new Date(season.starts_at).toLocaleDateString('es-CL') : 'Sin inicio'} → {season.ends_at ? new Date(season.ends_at).toLocaleDateString('es-CL') : 'Sin término'} · {(season.season_products || []).length} productos</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/admin/temporadas/${season.id}/catalogo`} className="rounded-xl bg-neon px-4 py-2 text-xs font-extrabold text-[#020705]">Gestionar productos y canales</Link>
                  <button onClick={() => openEdit(season)} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-white">Editar</button>
                  <button onClick={() => void toggleActive(season)} className="rounded-xl border border-white/10 px-3 py-2 text-xs text-white/70">{season.is_active ? 'Desactivar' : 'Activar'}</button>
                  <button onClick={() => void remove(String(season.id))} className="px-2 text-xs font-bold text-red-300">Eliminar</button>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
