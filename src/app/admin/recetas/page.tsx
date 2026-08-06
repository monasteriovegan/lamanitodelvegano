'use client';

import { useState, useEffect } from 'react';
import { PageHeader, Badge, EmptyState } from '../_ui/AdminUI';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
  }).format(n);

export default function RecetasPage() {
  const [recipes, setRecipes] = useState<any[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  const EMPTY_RECIPE = {
    name: '',
    product_id: '',
    yield_units: 1,
    yield_description: '',
    labor_minutes: 0,
    overhead_percent: 15,
    selling_price: 0,
    notes: '',
  };
  const [form, setForm] = useState({ ...EMPTY_RECIPE });
  const [recipeIngredients, setRecipeIngredients] = useState<
    { ingredient_id: string; quantity: number; unit: string }[]
  >([]);
  const [editing, setEditing] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [r1, r2, r3] = await Promise.all([
        fetch('/api/admin/recetas').then(r => r.json()),
        fetch('/api/admin/ingredientes').then(r => r.json()),
        fetch('/api/admin/products').then(r => r.json()),
      ]);
      setRecipes(r1.data || []);
      setIngredients(r2.data || []);
      setProducts(r3.data || []);
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

  const calcCosts = () => {
    const ingredientCost = recipeIngredients.reduce((sum, ri) => {
      const ing = ingredients.find(i => i.id === ri.ingredient_id);
      if (!ing || !ing.cost_per_unit) return sum;
      return sum + Number(ing.cost_per_unit) * Number(ri.quantity);
    }, 0);
    const laborCost = (Number(form.labor_minutes) * 5000) / 60; // 5000 CLP/hour labor cost base
    const overhead = (ingredientCost + laborCost) * (Number(form.overhead_percent) / 100);
    const totalCost = ingredientCost + laborCost + overhead;
    const costPerUnit = form.yield_units > 0 ? totalCost / Number(form.yield_units) : totalCost;
    const margin =
      form.selling_price > 0
        ? ((Number(form.selling_price) - costPerUnit) / Number(form.selling_price)) * 100
        : 0;
    return { ingredientCost, laborCost, overhead, totalCost, costPerUnit, margin };
  };

  const addIngredient = () =>
    setRecipeIngredients(prev => [...prev, { ingredient_id: '', quantity: 0, unit: 'g' }]);

  const updateIngredient = (idx: number, k: string, v: any) =>
    setRecipeIngredients(prev =>
      prev.map((ri, i) => (i === idx ? { ...ri, [k]: v } : ri))
    );

  const removeIngredient = (idx: number) =>
    setRecipeIngredients(prev => prev.filter((_, i) => i !== idx));

  const openNew = () => {
    setForm({ ...EMPTY_RECIPE });
    setRecipeIngredients([]);
    setEditing(null);
    setShowForm(true);
  };

  const openEdit = (r: any) => {
    setForm({
      name: r.name,
      product_id: r.product_id || '',
      yield_units: r.yield_units || 1,
      yield_description: r.yield_description || '',
      labor_minutes: r.labor_minutes || 0,
      overhead_percent: r.overhead_percent || 15,
      selling_price: r.selling_price || 0,
      notes: r.notes || '',
    });
    setRecipeIngredients(
      (r.recipe_ingredients || []).map((ri: any) => ({
        ingredient_id: ri.ingredient_id,
        quantity: ri.quantity,
        unit: ri.unit,
      }))
    );
    setEditing(r.id);
    setShowForm(true);
    setSelected(r);
  };

  const save = async () => {
    if (!form.name) return toast('El nombre es obligatorio', false);
    setSaving(true);
    const url = editing ? `/api/admin/recetas/${editing}` : '/api/admin/recetas';
    const method = editing ? 'PUT' : 'POST';
    try {
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          yield_units: Number(form.yield_units),
          labor_minutes: Number(form.labor_minutes),
          overhead_percent: Number(form.overhead_percent),
          selling_price: Number(form.selling_price),
          product_id: form.product_id || null,
          ingredients: recipeIngredients
            .filter(ri => ri.ingredient_id)
            .map(ri => ({ ...ri, quantity: Number(ri.quantity) })),
        }),
      });
      if (r.ok) {
        toast(editing ? '✦ Receta actualizada' : '✦ Receta creada');
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
    if (!confirm('¿Eliminar receta?')) return;
    try {
      const r = await fetch(`/api/admin/recetas/${id}`, { method: 'DELETE' });
      if (r.ok) {
        toast('Eliminada');
        load();
        setSelected(null);
      } else {
        const d = await r.json();
        toast(`Error: ${d.error}`, false);
      }
    } catch (err: any) {
      toast(`Error de red: ${err.message}`, false);
    }
  };

  const costs = calcCosts();

  return (
    <div className="max-w-[1100px] text-crema">
      <PageHeader
        eyebrow="🍳 Gastronomía"
        title="Recetas & Costos"
        action={
          <button
            onClick={openNew}
            className="bg-neon hover:bg-neon/90 text-black px-4 py-2 rounded-xl font-bold text-sm transition-all shadow-[0_0_15px_rgba(0,255,179,0.2)]"
          >
            + Nueva Receta
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left Side: List */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12 text-muted text-sm font-medium">
              Cargando recetas de producción...
            </div>
          ) : recipes.length === 0 ? (
            <div className="bg-[#050e0a] border border-white/10 rounded-2xl p-8 text-center">
              <EmptyState emoji="🍳" texto="Aún no hay recetas creadas en tu catálogo de costos." />
            </div>
          ) : (
            recipes.map((r: any) => {
              const ingCost = (r.recipe_ingredients || []).reduce(
                (s: number, ri: any) =>
                  s + Number(ri.ingredient?.cost_per_unit || 0) * Number(ri.quantity),
                0
              );
              const labor = (Number(r.labor_minutes || 0) * 5000) / 60;
              const oh = (ingCost + labor) * (Number(r.overhead_percent || 15) / 100);
              const total = ingCost + labor + oh;
              const cpu = r.yield_units > 0 ? total / r.yield_units : total;
              const margin =
                r.selling_price > 0 ? ((r.selling_price - cpu) / r.selling_price) * 100 : 0;

              const isSelected = selected?.id === r.id;

              return (
                <div
                  key={r.id}
                  onClick={() => setSelected(r)}
                  className={`bg-[#050e0a]/80 border transition-all rounded-2xl p-5 cursor-pointer hover:bg-white/[0.01] ${
                    isSelected ? 'border-neon shadow-md shadow-neon/5' : 'border-white/10'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-base text-white">{r.name}</h4>
                      {r.product?.nombre && (
                        <div className="text-xs text-neon mt-1 font-medium">
                          🌱 Vinculado a: {r.product.nombre}
                        </div>
                      )}
                      <div className="text-xs text-muted mt-2">
                        Rendimiento: {r.yield_units} {r.yield_description || 'unidades'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-base text-white">
                        {fmt(cpu)}
                        <span className="text-[10px] text-muted font-normal"> /u</span>
                      </div>
                      {r.selling_price > 0 && (
                        <div
                          className={`text-xs font-semibold mt-1 ${
                            margin > 50 ? 'text-neon' : margin > 30 ? 'text-am' : 'text-rojo'
                          }`}
                        >
                          {margin.toFixed(0)}% margen
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-3 mt-4 pt-4 border-t border-white/5">
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        openEdit(r);
                      }}
                      className="text-neon hover:text-neon/80 text-xs font-bold transition-all"
                    >
                      Editar
                    </button>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        del(r.id);
                      }}
                      className="text-rojo hover:text-rojo/80 text-xs font-semibold transition-all"
                    >
                      ✕ Eliminar
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Side: Form */}
        {showForm && (
          <div className="bg-[#050e0a] border border-white/10 rounded-2xl p-6 shadow-xl relative">
            <h3 className="font-display font-bold text-lg text-white mb-6">
              {editing ? 'Editar Receta' : 'Nueva Receta'}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
              <div className="md:col-span-2">
                <label className="block text-xs uppercase tracking-wider text-muted font-semibold mb-1.5">
                  Nombre de la receta *
                </label>
                <input
                  value={form.name}
                  onChange={e => setF('name', e.target.value)}
                  placeholder="Ganache de Frambuesas Vegano"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-neon text-white"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs uppercase tracking-wider text-muted font-semibold mb-1.5">
                  Producto vinculado (opcional)
                </label>
                <select
                  value={form.product_id}
                  onChange={e => setF('product_id', e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-neon text-white cursor-pointer"
                >
                  <option value="" className="bg-[#050e0a] text-white">Sin vincular</option>
                  {products.map((p: any) => (
                    <option key={p.id} value={p.id} className="bg-[#050e0a] text-white">
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-muted font-semibold mb-1.5">
                  Rendimiento (unidades)
                </label>
                <input
                  type="number"
                  value={form.yield_units}
                  onChange={e => setF('yield_units', e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-neon text-white"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-muted font-semibold mb-1.5">
                  Descripción rendimiento
                </label>
                <input
                  value={form.yield_description}
                  onChange={e => setF('yield_description', e.target.value)}
                  placeholder="porciones, potes, bombones..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-neon text-white"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-muted font-semibold mb-1.5">
                  Tiempo mano de obra (min)
                </label>
                <input
                  type="number"
                  value={form.labor_minutes}
                  onChange={e => setF('labor_minutes', e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-neon text-white"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-muted font-semibold mb-1.5">
                  Gastos generales (%)
                </label>
                <input
                  type="number"
                  value={form.overhead_percent}
                  onChange={e => setF('overhead_percent', e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-neon text-white"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs uppercase tracking-wider text-muted font-semibold mb-1.5">
                  Precio de venta estimado (CLP)
                </label>
                <input
                  type="number"
                  value={form.selling_price}
                  onChange={e => setF('selling_price', e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-neon text-white"
                />
              </div>
            </div>

            {/* Ingredients Selection Row */}
            <div className="mb-5 border-t border-white/5 pt-4">
              <div className="flex justify-between items-center mb-3">
                <label className="block text-xs uppercase tracking-wider text-neon font-bold">
                  Ingredientes Utilizados
                </label>
                <button
                  onClick={addIngredient}
                  className="bg-white/5 hover:bg-white/10 border border-white/10 text-white px-3 py-1 rounded-lg text-xs font-semibold transition-all"
                >
                  + Agregar Insumo
                </button>
              </div>

              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {recipeIngredients.map((ri, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <select
                      value={ri.ingredient_id}
                      onChange={e => updateIngredient(idx, 'ingredient_id', e.target.value)}
                      className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-neon text-white cursor-pointer"
                    >
                      <option value="" className="bg-[#050e0a] text-white">Seleccionar...</option>
                      {ingredients.map((ing: any) => (
                        <option key={ing.id} value={ing.id} className="bg-[#050e0a] text-white">
                          {ing.name}
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      step="0.1"
                      value={ri.quantity}
                      onChange={e => updateIngredient(idx, 'quantity', e.target.value)}
                      placeholder="Cant."
                      className="w-16 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-neon text-white text-center"
                    />

                    <input
                      value={ri.unit}
                      onChange={e => updateIngredient(idx, 'unit', e.target.value)}
                      placeholder="g"
                      className="w-12 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-neon text-white text-center"
                    />

                    <button
                      onClick={() => removeIngredient(idx)}
                      className="text-rojo hover:text-rojo/80 text-sm font-semibold px-1"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Calculations Card */}
            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 mb-6">
              <div className="text-[10px] uppercase tracking-wider text-neon font-bold mb-3">
                Cálculos de Producción
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  ['Ingredientes', fmt(costs.ingredientCost), 'text-white/80'],
                  ['Mano de obra', fmt(costs.laborCost), 'text-white/80'],
                  ['Gastos generales', fmt(costs.overhead), 'text-white/80'],
                  ['Costo de producción', fmt(costs.totalCost), 'text-white font-semibold'],
                  ['Costo por unidad', fmt(costs.costPerUnit), 'text-white font-semibold'],
                  [
                    'Margen estimado',
                    `${costs.margin.toFixed(1)}%`,
                    costs.margin > 50 ? 'text-neon font-bold' : costs.margin > 30 ? 'text-am font-bold' : 'text-rojo font-bold',
                  ],
                ].map(([label, val, style]) => (
                  <div key={label} className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-[11px] text-muted">{label}</span>
                    <span className={`text-xs ${style}`}>{val}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-xs uppercase tracking-wider text-muted font-semibold mb-1.5">
                Notas internas
              </label>
              <textarea
                value={form.notes}
                onChange={e => setF('notes', e.target.value)}
                placeholder="Observaciones de preparación, procesos de cocina, etc."
                rows={2}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-neon text-white resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={save}
                disabled={saving}
                className="bg-neon hover:bg-neon/90 text-black px-4 py-2.5 rounded-xl font-bold text-sm transition-all"
              >
                {saving ? 'Guardando...' : 'Guardar Receta'}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="bg-white/5 hover:bg-white/10 border border-white/10 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
