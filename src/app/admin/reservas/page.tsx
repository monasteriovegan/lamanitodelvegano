'use client';

import { useState, useEffect } from 'react';
import { PageHeader, Badge, EmptyState } from '../_ui/AdminUI';

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  confirmed: '#00ffb3',
  ready: '#8b5cf6',
  completed: '#10b981',
  cancelled: '#ef4444',
};

const STATUS_TONO: Record<string, 'am' | 'neon' | 'neutro' | 'rojo'> = {
  pending: 'am',
  confirmed: 'neon',
  ready: 'neon',
  completed: 'neon',
  cancelled: 'rojo',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmada',
  ready: 'Lista para retiro',
  completed: 'Completada',
  cancelled: 'Cancelada',
};

const SLOTS = [
  '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30', '18:00'
];

export default function ReservasPage() {
  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDate, setFilterDate] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  const EMPTY = {
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    reservation_date: '',
    reservation_time: '10:00',
    party_size: 1,
    notes: '',
    internal_notes: '',
    status: 'pending',
    type: 'pickup',
  };
  const [form, setForm] = useState({ ...EMPTY });

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/reservas');
      const d = await r.json();
      setReservations(d.data || []);
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

  const save = async () => {
    if (!form.customer_name || !form.reservation_date) {
      return toast('Nombre y fecha son obligatorios', false);
    }
    setSaving(true);
    try {
      const r = await fetch('/api/admin/reservas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, party_size: Number(form.party_size) }),
      });
      if (r.ok) {
        toast('✦ Reserva creada');
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

  const updateStatus = async (id: string, status: string) => {
    try {
      await fetch(`/api/admin/reservas/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      toast('✦ Estado actualizado');
      load();
      if (selected?.id === id) {
        setSelected((s: any) => ({ ...s, status }));
      }
    } catch (err: any) {
      toast(`Error: ${err.message}`, false);
    }
  };

  const updateNotes = async (id: string, internal_notes: string) => {
    try {
      await fetch(`/api/admin/reservas/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ internal_notes }),
      });
      toast('✦ Notas guardadas');
    } catch (err: any) {
      toast(`Error: ${err.message}`, false);
    }
  };

  const del = async (id: string) => {
    if (!confirm('¿Eliminar reserva?')) return;
    try {
      const r = await fetch(`/api/admin/reservas/${id}`, { method: 'DELETE' });
      if (r.ok) {
        setSelected(null);
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

  const today = new Date().toISOString().split('T')[0];
  const filtered = reservations.filter(
    r =>
      (filterStatus === 'all' || r.status === filterStatus) &&
      (!filterDate || r.reservation_date === filterDate)
  );

  const todayRes = reservations.filter(r => r.reservation_date === today);
  const pending = reservations.filter(r => r.status === 'pending').length;
  const confirmed = reservations.filter(r => r.status === 'confirmed').length;

  return (
    <div className="max-w-[1100px] text-crema">
      <PageHeader
        eyebrow="📅 Comercio"
        title="Reservas & Retiros"
        action={
          <button
            onClick={() => {
              setForm({ ...EMPTY });
              setShowForm(true);
            }}
            className="bg-neon hover:bg-neon/90 text-black px-4 py-2 rounded-xl font-bold text-sm transition-all shadow-[0_0_15px_rgba(0,255,179,0.2)]"
          >
            + Nueva Reserva
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

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Hoy', value: todayRes.length, accento: 'am' },
          { label: 'Pendientes', value: pending, accento: pending > 0 ? 'am' : 'neon' },
          { label: 'Confirmadas', value: confirmed, accento: 'neon' },
          { label: 'Total', value: reservations.length, accento: 'neon' },
        ].map(k => (
          <div key={k.label} className="bg-[#050e0a] border border-white/10 rounded-2xl p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted font-medium mb-1">{k.label}</div>
            <div className="font-display font-bold text-2xl" style={{ color: STATUS_COLORS[k.accento] || '#fff' }}>
              {k.value}
            </div>
          </div>
        ))}
      </div>

      {/* Manual Creation Form */}
      {showForm && (
        <div className="bg-[#050e0a] border border-white/10 rounded-2xl p-6 mb-6 shadow-xl">
          <h3 className="font-display font-bold text-lg text-white mb-6">Nueva Reserva Manual</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs uppercase tracking-wider text-muted font-semibold mb-2">Nombre *</label>
              <input
                value={form.customer_name}
                onChange={e => setF('customer_name', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-neon text-white"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-muted font-semibold mb-2">Email</label>
              <input
                type="email"
                value={form.customer_email}
                onChange={e => setF('customer_email', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-neon text-white"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-muted font-semibold mb-2">Teléfono</label>
              <input
                value={form.customer_phone}
                onChange={e => setF('customer_phone', e.target.value)}
                placeholder="+569..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-neon text-white"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-muted font-semibold mb-2">Fecha *</label>
              <input
                type="date"
                value={form.reservation_date}
                onChange={e => setF('reservation_date', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-neon text-white cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-muted font-semibold mb-2">Horario</label>
              <select
                value={form.reservation_time}
                onChange={e => setF('reservation_time', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-neon text-white cursor-pointer"
              >
                {SLOTS.map(s => (
                  <option key={s} value={s} className="bg-[#050e0a] text-white">{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-muted font-semibold mb-2">Tipo</label>
              <select
                value={form.type}
                onChange={e => setF('type', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-neon text-white cursor-pointer"
              >
                <option value="pickup" className="bg-[#050e0a] text-white">Retiro en Taller</option>
                <option value="tasting" className="bg-[#050e0a] text-white">Degustación / Taller</option>
                <option value="workshop" className="bg-[#050e0a] text-white">Curso / Workshop</option>
                <option value="visit" className="bg-[#050e0a] text-white">Visita Especial</option>
              </select>
            </div>
            <div className="md:col-span-3">
              <label className="block text-xs uppercase tracking-wider text-muted font-semibold mb-2">Notas del cliente</label>
              <textarea
                value={form.notes}
                onChange={e => setF('notes', e.target.value)}
                rows={2}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-neon text-white resize-none"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button
              onClick={save}
              disabled={saving}
              className="bg-neon hover:bg-neon/90 text-black px-5 py-2.5 rounded-xl font-bold text-sm transition-all"
            >
              {saving ? 'Guardando...' : 'Crear Reserva'}
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

      {/* Date Filter & Status Tabs */}
      <div className="flex flex-col md:flex-row gap-4 mb-6 items-start md:items-center">
        <input
          type="date"
          value={filterDate}
          onChange={e => setFilterDate(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-neon text-white w-48 cursor-pointer"
        />
        <div className="flex flex-wrap gap-1 bg-white/5 p-1 rounded-xl">
          {['all', 'pending', 'confirmed', 'ready', 'completed', 'cancelled'].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filterStatus === s ? 'bg-neon text-black shadow-md' : 'text-muted hover:text-white'
              }`}
            >
              {s === 'all' ? 'Todas' : STATUS_LABELS[s]}
            </button>
          ))}
        </div>
        {filterDate && (
          <button
            onClick={() => setFilterDate('')}
            className="text-muted hover:text-white text-xs font-semibold ml-2"
          >
            ✕ Limpiar fecha
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left Side: List */}
        <div className="bg-[#050e0a]/80 border border-white/10 rounded-2xl overflow-hidden shadow-lg">
          <div className="divide-y divide-white/5">
            {loading ? (
              <div className="text-center py-12 text-muted text-sm font-medium">
                Cargando reservas de clientes...
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState emoji="📅" texto="No se encontraron reservas con los filtros aplicados." />
            ) : (
              filtered.map((r: any) => {
                const isSelected = selected?.id === r.id;
                return (
                  <div
                    key={r.id}
                    onClick={() => setSelected(r)}
                    className={`p-4 transition-all cursor-pointer hover:bg-white/[0.01] flex justify-between items-center ${
                      isSelected ? 'bg-white/[0.02]' : ''
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-sm text-white">{r.customer_name}</div>
                      <div className="flex gap-4 text-xs text-muted mt-1.5 font-mono">
                        <span>📅 {r.reservation_date} {r.reservation_time}</span>
                        <span>
                          {r.type === 'pickup'
                            ? 'Retiro'
                            : r.type === 'tasting'
                            ? 'Taller'
                            : r.type === 'workshop'
                            ? 'Curso'
                            : 'Especial'}
                        </span>
                      </div>
                    </div>
                    <Badge tono={STATUS_TONO[r.status]}>{STATUS_LABELS[r.status]}</Badge>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Detail */}
        {selected && (
          <div className="bg-[#050e0a] border border-white/10 rounded-2xl p-6 shadow-xl relative">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-display font-bold text-lg text-white">{selected.customer_name}</h3>
              <button
                onClick={() => setSelected(null)}
                className="text-muted hover:text-white text-base font-semibold"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 bg-white/[0.02] border border-white/5 rounded-xl p-4 mb-6 text-sm">
              {[
                ['Fecha', selected.reservation_date],
                ['Horario', selected.reservation_time],
                ['Email', selected.customer_email || '—'],
                ['Teléfono', selected.customer_phone || '—'],
                ['Tipo', selected.type || '—'],
              ].map(([k, v]) => (
                <div key={k}>
                  <div className="text-[10px] uppercase tracking-wider text-neon font-bold mb-0.5">{k}</div>
                  <div className="text-white font-medium">{v}</div>
                </div>
              ))}
            </div>

            {selected.notes && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
                <div className="text-[10px] uppercase tracking-wider text-muted font-bold mb-1">
                  Notas del cliente
                </div>
                <p className="text-xs text-white/80">{selected.notes}</p>
              </div>
            )}

            <div className="mb-6">
              <label className="block text-xs uppercase tracking-wider text-muted font-bold mb-3">
                Cambiar estado
              </label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <button
                    key={k}
                    onClick={() => updateStatus(selected.id, k)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                    style={{
                      borderColor: selected.status === k ? STATUS_COLORS[k] : 'rgba(255,255,255,0.1)',
                      backgroundColor: selected.status === k ? `${STATUS_COLORS[k]}15` : 'transparent',
                      color: selected.status === k ? STATUS_COLORS[k] : '#a8a8a8',
                    }}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-xs uppercase tracking-wider text-muted font-bold mb-2">
                Notas internas (equipo)
              </label>
              <textarea
                key={selected.id}
                defaultValue={selected.internal_notes || ''}
                onBlur={e => updateNotes(selected.id, e.target.value)}
                placeholder="Notas que solo tú y tus administradores verán..."
                rows={2}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-neon text-white resize-none"
              />
            </div>

            <div className="flex gap-3 border-t border-white/5 pt-5">
              {selected.customer_email && (
                <a
                  href={`mailto:${selected.customer_email}?subject=Tu reserva en La Manito del Vegano ✦`}
                  className="bg-white/5 hover:bg-white/10 border border-white/10 text-white px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5"
                >
                  ✉ Email
                </a>
              )}
              {selected.customer_phone && (
                <a
                  href={`https://wa.me/${selected.customer_phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                    `Hola ${selected.customer_name} ✦ confirmamos tu retiro de pedido / reserva en La Manito del Vegano para el ${selected.reservation_date} a las ${selected.reservation_time}.`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-[rgba(0,255,179,0.1)] hover:bg-[rgba(0,255,179,0.15)] border border-neon/30 text-neon px-4 py-2.5 rounded-xl font-bold text-xs transition-all"
                >
                  WhatsApp
                </a>
              )}
              <button
                onClick={() => del(selected.id)}
                className="ml-auto bg-rojo/10 hover:bg-rojo/20 border border-rojo/30 text-rojo px-4 py-2.5 rounded-xl font-bold text-xs transition-all"
              >
                Eliminar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
