'use client';

import { useState, useEffect } from 'react';
import { PageHeader, Badge, EmptyState } from '../_ui/AdminUI';

const PALETTES = [
  '#1e3f20,#00ffb3', // Verde Bosque & Menta
  '#2d6a4f,#74c69d', // Esmeralda & Salvia
  '#556b2f,#d4af37', // Olivo & Oro
  '#b45309,#fcd34d', // Ámbar & Crema
  '#831843,#fbcfe8', // Arándano & Rosa
];

export default function TemporadasPage() {
  const [seasons, setSeasons] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  const EMPTY = {
    name: '',
    slug: '',
    description: '',
    starts_at: '',
    ends_at: '',
    color_start: '#1e3f20',
    color_end: '#00ffb3',
    is_active: true,
    banner_image: '',
    badge_text: '',
  };
  const [form, setForm] = useState({ ...EMPTY });
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const [r1, r2] = await Promise.all([
        fetch('/api/admin/temporadas').then(r => r.json()),
        fetch('/api/admin/products').then(r => r.json()),
      ]);
      setSeasons(r1.data || []);
      setProducts(r2.data || []);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const toast = (text: string, ok = true) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 3000);
  };

  const setF = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const openNew = () => {
    setForm({ ...EMPTY });
    setSelectedProducts([]);
    setEditing(null);
    setShowForm(true);
  };

  const openEdit = (s: any) => {
    setForm({
      name: s.name,
      slug: s.slug || '',
      description: s.description || '',
      starts_at: s.starts_at ? s.starts_at.split('T')[0] : '',
      ends_at: s.ends_at ? s.ends_at.split('T')[0] : '',
      color_start: s.color_start || '#1e3f20',
      color_end: s.color_end || '#00ffb3',
      is_active: s.is_active,
      banner_image: s.banner_image || '',
      badge_text: s.badge_text || '',
    });
    setSelectedProducts((s.season_products || []).map((sp: any) => sp.product_id));
    setEditing(s.id);
    setShowForm(true);
  };

  const toggleProduct = (pid: string) =>
    setSelectedProducts(p => (p.includes(pid) ? p.filter(x => x !== pid) : [...p, pid]));

  const save = async () => {
    if (!form.name) return toast('El nombre es obligatorio', false);
    setSaving(true);
    const sl =
      form.slug ||
      form.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-');

    const url = editing ? `/api/admin/temporadas/${editing}` : '/api/admin/temporadas';
    const method = editing ? 'PUT' : 'POST';
    try {
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, slug: sl, product_ids: selectedProducts }),
      });
      if (r.ok) {
        toast(editing ? '✦ Temporada actualizada' : '✦ Temporada creada');
        setShowForm(false);
        load();
      } else {
        const d = await r.json();
        toast(`Error: ${d.error}`, false);
      }
    } catch (err: any) {
      toast(`Error de red: ${err.message}`, false);
    }
    setSaving(false);
  };

  const del = async (id: string) => {
    if (!confirm('¿Eliminar temporada?')) return;
    try {
      const r = await fetch(`/api/admin/temporadas/${id}`, { method: 'DELETE' });
      if (r.ok) {
        toast('Eliminada');
        load();
      } else {
        const d = await r.json();
        toast(`Error: ${d.error}`, false);
      }
    } catch (err: any) {
      toast(`Error de red: ${err.message}`, false);
    }
  };

  const toggleActive = async (s: any) => {
    try {
      await fetch(`/api/admin/temporadas/${s.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !s.is_active }),
      });
      load();
    } catch (err) {
      console.error(err);
    }
  };

  const now = new Date();
  const active = seasons.filter(
    s => s.is_active && new Date(s.starts_at) <= now && (!s.ends_at || new Date(s.ends_at) >= now)
  );
  const upcoming = seasons.filter(s => new Date(s.starts_at) > now);
  const past = seasons.filter(s => s.ends_at && new Date(s.ends_at) < now);

  return (
    <div className="max-w-[1000px] text-crema">
      <PageHeader
        eyebrow="🌱 Catálogo"
        title="Temporadas & Colecciones"
        action={
          <button
            onClick={openNew}
            className="bg-neon hover:bg-neon/90 text-black px-4 py-2 rounded-xl font-bold text-sm transition-all shadow-[0_0_15px_rgba(0,255,179,0.2)]"
          >
            + Nueva Temporada
          </button>
        }
      />

      {msg && (
        <div
          className={`border p-4 rounded-xl mb-6 text-sm ${
            msg.ok
              ? 'bg-[rgba(0,255,179,0.06)] border-neon/30 text-neon'
              : 'bg-[rgba(239,68,68,0.06)] border-rojo/30 text-rojo'
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* KPI Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Activas ahora', value: active.length, color: 'text-neon border-neon/20' },
          { label: 'Próximas campañas', value: upcoming.length, color: 'text-am border-am/20' },
          { label: 'Finalizadas', value: past.length, color: 'text-muted border-white/10' },
        ].map(g => (
          <div key={g.label} className={`bg-[#050e0a] border ${g.color} rounded-2xl p-4`}>
            <div className="text-[10px] uppercase tracking-wider text-muted font-medium mb-1">{g.label}</div>
            <div className="font-display font-bold text-2xl">{g.value}</div>
          </div>
        ))}
      </div>

      {/* Season creation form */}
      {showForm && (
        <div className="bg-[#050e0a] border border-white/10 rounded-2xl p-6 mb-6 shadow-xl">
          <h3 className="font-display font-bold text-lg text-white mb-6">
            {editing ? 'Editar Temporada' : 'Nueva Temporada'}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label className="block text-xs uppercase tracking-wider text-muted font-semibold mb-2">Nombre *</label>
              <input
                value={form.name}
                onChange={e => setF('name', e.target.value)}
                placeholder="Colección Primavera-Verano, Especial Navidad..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-neon text-white"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-muted font-semibold mb-2">Fecha de inicio</label>
              <input
                type="date"
                value={form.starts_at}
                onChange={e => setF('starts_at', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-neon text-white cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-muted font-semibold mb-2">Fecha de término</label>
              <input
                type="date"
                value={form.ends_at}
                onChange={e => setF('ends_at', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-neon text-white cursor-pointer"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs uppercase tracking-wider text-muted font-semibold mb-2">Descripción</label>
              <textarea
                value={form.description}
                onChange={e => setF('description', e.target.value)}
                rows={2}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-neon text-white resize-none"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-muted font-semibold mb-2">Badge / Etiqueta</label>
              <input
                value={form.badge_text}
                onChange={e => setF('badge_text', e.target.value)}
                placeholder="🌿 Edición Limitada, ❄ Invierno"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-neon text-white"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-muted font-semibold mb-2">Imagen banner (URL)</label>
              <input
                value={form.banner_image}
                onChange={e => setF('banner_image', e.target.value)}
                placeholder="https://..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-neon text-white"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs uppercase tracking-wider text-muted font-semibold mb-2">Paleta de colores estacional</label>
              <div className="flex gap-2.5 my-2">
                {PALETTES.map(p => {
                  const [c1, c2] = p.split(',');
                  const isSelected = form.color_start === c1;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        setF('color_start', c1);
                        setF('color_end', c2);
                      }}
                      className="w-10 h-7 rounded-lg transition-all"
                      style={{
                        background: `linear-gradient(135deg, ${c1}, ${c2})`,
                        boxShadow: isSelected ? '0 0 0 2px #fff, 0 0 10px rgba(255,255,255,0.2)' : 'none',
                        transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                      }}
                    />
                  );
                })}
              </div>
              <div
                className="h-1.5 w-full rounded-full transition-all mt-3"
                style={{ background: `linear-gradient(90deg, ${form.color_start}, ${form.color_end})` }}
              />
            </div>

            <div className="md:col-span-2 mt-2">
              <label className="inline-flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={e => setF('is_active', e.target.checked)}
                  className="w-4 h-4 rounded border-white/10 bg-white/5 text-neon focus:ring-neon accent-[#00ffb3]"
                />
                <span className="text-sm font-medium text-white">Colección Activa</span>
              </label>
            </div>
          </div>

          <div className="mt-6 border-t border-white/5 pt-4">
            <label className="block text-xs uppercase tracking-wider text-muted font-bold mb-3">
              Productos en esta colección ({selectedProducts.length} seleccionados)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-48 overflow-y-auto pr-1">
              {products.map((p: any) => {
                const selected = selectedProducts.includes(p.id);
                return (
                  <div
                    key={p.id}
                    onClick={() => toggleProduct(p.id)}
                    className={`border rounded-xl p-2.5 cursor-pointer flex items-center gap-3 transition-all ${
                      selected
                        ? 'bg-neon/10 border-neon/40 text-neon'
                        : 'bg-white/5 border-white/5 text-muted hover:border-white/10'
                    }`}
                  >
                    {p.images?.[0] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.images[0]} className="w-8 h-8 rounded-lg object-cover" alt="" />
                    )}
                    <span className="text-xs font-semibold truncate flex-1">{p.name}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex gap-3 mt-8 border-t border-white/5 pt-5">
            <button
              onClick={save}
              disabled={saving}
              className="bg-neon hover:bg-neon/90 text-black px-5 py-2.5 rounded-xl font-bold text-sm transition-all"
            >
              {saving ? 'Guardando...' : 'Guardar Temporada'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="bg-white/5 hover:bg-white/10 border border-white/10 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-all"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Main List */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-12 text-muted text-sm font-medium">
            Cargando colecciones del catálogo...
          </div>
        ) : seasons.length === 0 ? (
          <div className="bg-[#050e0a] border border-white/10 rounded-2xl p-8 text-center">
            <EmptyState emoji="🍂" texto="Aún no hay colecciones estacionales registradas." />
          </div>
        ) : (
          seasons.map((s: any) => {
            const isNow =
              s.is_active &&
              new Date(s.starts_at) <= now &&
              (!s.ends_at || new Date(s.ends_at) >= now);

            return (
              <div
                key={s.id}
                className={`bg-[#050e0a]/80 border rounded-2xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all ${
                  isNow ? 'border-neon/40 shadow-md shadow-neon/5' : 'border-white/10'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="w-12 h-12 rounded-xl shrink-0"
                    style={{ background: `linear-gradient(135deg, ${s.color_start}, ${s.color_end})` }}
                  />
                  <div>
                    <div className="flex items-center gap-3">
                      <h4 className="font-bold text-base text-white">{s.name}</h4>
                      {s.badge_text && (
                        <span className="bg-white/5 border border-white/10 text-white text-[10px] px-2 py-0.5 rounded-md font-semibold">
                          {s.badge_text}
                        </span>
                      )}
                      {isNow && <Badge tono="neon">ACTIVA</Badge>}
                    </div>
                    {s.description && <p className="text-xs text-muted mt-1 max-w-[500px]">{s.description}</p>}
                    <div className="flex gap-4 text-[11px] text-muted mt-2 font-mono">
                      {s.starts_at && (
                        <span>Inicio: {new Date(s.starts_at).toLocaleDateString('es-CL')}</span>
                      )}
                      {s.ends_at && (
                        <span>Término: {new Date(s.ends_at).toLocaleDateString('es-CL')}</span>
                      )}
                      <span className="text-neon">{(s.season_products || []).length} productos vinculados</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    onClick={() => toggleActive(s)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      s.is_active
                        ? 'bg-neon/10 border-neon/30 text-neon'
                        : 'bg-white/5 border-white/10 text-muted'
                    }`}
                  >
                    {s.is_active ? '✓ Habilitada' : 'Inactiva'}
                  </button>
                  <button
                    onClick={() => openEdit(s)}
                    className="bg-white/5 hover:bg-white/10 border border-white/10 text-white px-3 py-1.5 rounded-xl font-bold text-xs transition-all"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => del(s.id)}
                    className="text-rojo hover:text-rojo/80 text-xs font-semibold px-2"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
