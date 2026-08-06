'use client';

import { useState, useEffect } from 'react';
import { PageHeader, Badge, EmptyState } from '../_ui/AdminUI';

const ALLERGEN_LIST = [
  'Gluten', 'Lácteos', 'Huevo', 'Frutos secos', 'Maní',
  'Soja', 'Sésamo', 'Mariscos', 'Pescado', 'Apio',
  'Mostaza', 'Sulfitos', 'Lupino', 'Moluscos'
];
const UNIT_LIST = ['g', 'kg', 'ml', 'l', 'unidad', 'cucharada', 'cucharadita', 'taza', 'oz'];

const EMPTY = {
  name: '',
  category: '',
  unit: 'g',
  cost_per_unit: 0,
  supplier: '',
  allergens: [] as string[],
  is_allergen: false,
  notes: '',
  calories_per_100g: 0,
  protein_per_100g: 0,
  carbs_per_100g: 0,
  fat_per_100g: 0,
  is_active: true
};

export default function IngredientesPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ ...EMPTY });
  const [editing, setEditing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'basico' | 'nutricional'>('basico');

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/ingredientes');
      const d = await r.json();
      setItems(d.data || []);
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

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const openNew = () => {
    setForm({ ...EMPTY });
    setEditing(null);
    setShowForm(true);
    setTab('basico');
  };

  const openEdit = (item: any) => {
    setForm({ ...EMPTY, ...item, allergens: item.allergens || [] });
    setEditing(item.id);
    setShowForm(true);
    setTab('basico');
  };

  const toggleAllergen = (a: string) => {
    setForm(f => ({
      ...f,
      allergens: f.allergens.includes(a) ? f.allergens.filter(x => x !== a) : [...f.allergens, a]
    }));
  };

  const save = async () => {
    if (!form.name) return toast('El nombre es obligatorio', false);
    setSaving(true);
    const url = editing ? `/api/admin/ingredientes/${editing}` : '/api/admin/ingredientes';
    const method = editing ? 'PUT' : 'POST';
    try {
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, cost_per_unit: Number(form.cost_per_unit) || 0 })
      });
      if (r.ok) {
        toast(editing ? '✦ Ingrediente actualizado' : '✦ Ingrediente creado');
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
    if (!confirm('¿Eliminar ingrediente?')) return;
    try {
      const r = await fetch(`/api/admin/ingredientes/${id}`, { method: 'DELETE' });
      if (r.ok) {
        toast('Eliminado');
        load();
      } else {
        const d = await r.json();
        toast(`Error: ${d.error}`, false);
      }
    } catch (err: any) {
      toast(`Error de red: ${err.message}`, false);
    }
  };

  const categories = Array.from(new Set(items.map(i => i.category).filter(Boolean)));
  const filtered = items.filter(i =>
    (!search || i.name.toLowerCase().includes(search.toLowerCase())) &&
    (!filterCat || i.category === filterCat)
  );

  return (
    <div className="max-w-[1000px] text-crema">
      <PageHeader
        eyebrow="🍫 Gastronomía"
        title="Ingredientes & Alérgenos"
        action={
          <button
            onClick={openNew}
            className="bg-neon hover:bg-neon/90 text-black px-4 py-2 rounded-xl font-bold text-sm transition-all shadow-[0_0_15px_rgba(0,255,179,0.2)]"
          >
            + Nuevo Ingrediente
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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total ingredientes', value: items.length, border: 'border-white/10 text-white' },
          { label: 'Con alérgenos', value: items.filter(i => i.allergens?.length > 0).length, border: 'border-rojo/20 text-rojo' },
          { label: 'Categorías', value: categories.length, border: 'border-neon/20 text-neon' },
          { label: 'Activos', value: items.filter(i => i.is_active).length, border: 'border-white/10 text-white' },
        ].map(k => (
          <div key={k.label} className={`bg-[#050e0a] border ${k.border} rounded-2xl p-4`}>
            <div className="text-[10px] uppercase tracking-wider text-muted font-medium mb-1">{k.label}</div>
            <div className="font-display font-bold text-2xl">{k.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar ingrediente..."
          className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-neon w-full sm:w-64 text-white"
        />
        <select
          value={filterCat}
          onChange={e => setFilterCat(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-neon w-full sm:w-48 text-white cursor-pointer"
        >
          <option value="" className="bg-[#050e0a] text-white">Todas las categorías</option>
          {categories.map(c => (
            <option key={c} value={c} className="bg-[#050e0a] text-white">{c}</option>
          ))}
        </select>
      </div>

      {/* Form Modal/Drawer */}
      {showForm && (
        <div className="bg-[#050e0a] border border-white/10 rounded-2xl p-6 mb-6 shadow-xl relative overflow-hidden">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-display font-bold text-lg text-white">
              {editing ? 'Editar Ingrediente' : 'Nuevo Ingrediente'}
            </h3>
            <div className="flex gap-1.5 bg-white/5 p-1 rounded-xl">
              {(['basico', 'nutricional'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    tab === t ? 'bg-neon text-black shadow-md' : 'text-muted hover:text-white'
                  }`}
                >
                  {t === 'basico' ? 'Básico' : 'Nutricional'}
                </button>
              ))}
            </div>
          </div>

          {tab === 'basico' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="md:col-span-3">
                <label className="block text-xs uppercase tracking-wider text-muted font-semibold mb-2">Nombre *</label>
                <input
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  placeholder="Harina de Almendras, Aceite de Coco..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-neon text-white"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-muted font-semibold mb-2">Categoría</label>
                <input
                  value={form.category}
                  onChange={e => set('category', e.target.value)}
                  placeholder="Frutos Secos, Harinas, Aceites..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-neon text-white"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-muted font-semibold mb-2">Unidad</label>
                <select
                  value={form.unit}
                  onChange={e => set('unit', e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-neon text-white cursor-pointer"
                >
                  {UNIT_LIST.map(u => (
                    <option key={u} value={u} className="bg-[#050e0a] text-white">{u}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-muted font-semibold mb-2">Costo por unidad (CLP)</label>
                <input
                  type="number"
                  value={form.cost_per_unit}
                  onChange={e => set('cost_per_unit', e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-neon text-white"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-xs uppercase tracking-wider text-muted font-semibold mb-2">Proveedor</label>
                <input
                  value={form.supplier}
                  onChange={e => set('supplier', e.target.value)}
                  placeholder="Nombre del proveedor"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-neon text-white"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-xs uppercase tracking-wider text-muted font-semibold mb-2">Notas</label>
                <textarea
                  value={form.notes}
                  onChange={e => set('notes', e.target.value)}
                  placeholder="Observaciones sobre almacenamiento, vida útil, etc."
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-neon text-white resize-none"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-xs uppercase tracking-wider text-muted font-semibold mb-2">Alérgenos que contiene</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {ALLERGEN_LIST.map(a => {
                    const active = form.allergens.includes(a);
                    return (
                      <button
                        key={a}
                        onClick={() => toggleAllergen(a)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                          active
                            ? 'bg-rojo/10 border-rojo/40 text-rojo'
                            : 'bg-white/5 border-white/5 text-muted hover:border-white/10'
                        }`}
                      >
                        {a}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="md:col-span-3">
                <label className="inline-flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={e => set('is_active', e.target.checked)}
                    className="w-4 h-4 rounded border-white/10 bg-white/5 text-neon focus:ring-neon accent-[#00ffb3]"
                  />
                  <span className="text-sm font-medium text-white">Ingrediente Habilitado / Activo</span>
                </label>
              </div>
            </div>
          )}

          {tab === 'nutricional' && (
            <div>
              <p className="text-xs text-muted mb-4">Valores nutricionales declarados por cada 100 gramos del ingrediente.</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                {[
                  ['calories_per_100g', 'Calorías (kcal)'],
                  ['protein_per_100g', 'Proteínas (g)'],
                  ['carbs_per_100g', 'Carbohidratos (g)'],
                  ['fat_per_100g', 'Grasas (g)']
                ].map(([k, l]) => (
                  <div key={k}>
                    <label className="block text-xs uppercase tracking-wider text-muted font-semibold mb-2">{l}</label>
                    <input
                      type="number"
                      step="0.1"
                      value={(form as any)[k]}
                      onChange={e => set(k, Number(e.target.value))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-neon text-white"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 mt-8 border-t border-white/5 pt-5">
            <button
              onClick={save}
              disabled={saving}
              className="bg-neon hover:bg-neon/90 text-black px-5 py-2.5 rounded-xl font-bold text-sm transition-all"
            >
              {saving ? 'Guardando...' : 'Guardar Cambios'}
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

      {/* Main Table */}
      <div className="bg-[#050e0a]/80 border border-white/10 rounded-2xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02]">
                {['Ingrediente', 'Categoría', 'Costo/unidad', 'Alérgenos', 'Estado', 'Acciones'].map(h => (
                  <th key={h} className="text-[10px] uppercase tracking-wider text-neon font-bold px-5 py-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-muted text-sm font-medium">
                    Cargando ingredientes de la base de datos...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12">
                    <EmptyState
                      emoji="🥕"
                      texto={search ? 'No se encontraron coincidencias para tu búsqueda.' : 'No hay ingredientes agregados al inventario.'}
                    />
                  </td>
                </tr>
              ) : (
                filtered.map((item: any) => (
                  <tr
                    key={item.id}
                    className={`border-b border-white/5 hover:bg-white/[0.01] transition-all ${
                      !item.is_active ? 'opacity-40' : ''
                    }`}
                  >
                    <td className="px-5 py-4">
                      <div className="font-semibold text-sm text-white">{item.name}</div>
                      {item.supplier && <div className="text-xs text-muted mt-0.5">🚚 {item.supplier}</div>}
                    </td>
                    <td className="px-5 py-4 text-sm text-white/80">{item.category || '—'}</td>
                    <td className="px-5 py-4 font-mono text-sm text-white font-medium">
                      {item.cost_per_unit > 0
                        ? `$${Number(item.cost_per_unit).toLocaleString('es-CL')}/${item.unit}`
                        : '—'}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {item.allergens?.length > 0 ? (
                          item.allergens.map((a: string) => (
                            <span
                              key={a}
                              className="bg-rojo/10 border border-rojo/20 text-rojo text-[10px] font-semibold px-2 py-0.5 rounded-md"
                            >
                              {a}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-muted">Ninguno</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <Badge tono={item.is_active ? 'neon' : 'neutro'}>
                        {item.is_active ? 'Activo' : 'Habilitar'}
                      </Badge>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => openEdit(item)}
                          className="text-neon hover:text-neon/80 text-xs font-semibold transition-all"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => del(item.id)}
                          className="text-rojo hover:text-rojo/80 text-xs font-semibold transition-all"
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
