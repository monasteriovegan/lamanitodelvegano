'use client';

import { useMemo, useState } from 'react';
import { guardarDisponibilidadProducto } from './availability-actions';

function parseDates(value: string) {
  return Array.from(new Set(String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item))))
    .sort();
}

export function AvailabilityDatesEditor({
  productId,
  initialValue,
}: {
  productId: string;
  initialValue: string;
}) {
  const [dates, setDates] = useState<string[]>(() => parseDates(initialValue));
  const [nextDate, setNextDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const labels = useMemo(() => dates.map((date) => ({
    date,
    label: new Date(`${date}T12:00:00`).toLocaleDateString('es-CL', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }),
  })), [dates]);

  const addDate = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDate)) return;
    setDates((current) => Array.from(new Set([...current, nextDate])).sort());
    setNextDate('');
    setMessage('');
  };

  const save = async () => {
    setSaving(true);
    setMessage('');
    try {
      const result = await guardarDisponibilidadProducto(productId, dates);
      setDates(parseDates(result.disponibilidad));
      setMessage('✓ Fechas de entrega actualizadas. El checkout usará estas fechas.');
    } catch (error) {
      setMessage(`⚠ ${error instanceof Error ? error.message : 'No se pudieron guardar las fechas.'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="my-6 rounded-2xl border border-neon/20 bg-white/[0.02] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display font-bold text-white">Fechas disponibles para entrega</h2>
          <p className="mt-1 text-xs text-muted">Solo estas fechas aparecerán en el checkout cuando este producto esté en el carrito.</p>
        </div>
        <button type="button" onClick={() => void save()} disabled={saving} className="rounded-lg bg-neon px-4 py-2 text-xs font-bold text-[#020705] disabled:opacity-50">
          {saving ? 'Guardando…' : 'Guardar fechas'}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {labels.length === 0 ? <span className="text-xs text-amber-200">Sin fechas configuradas: este producto no ofrecerá fechas válidas en checkout.</span> : labels.map(({ date, label }) => (
          <span key={date} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white">
            {label}
            <button type="button" onClick={() => setDates((current) => current.filter((item) => item !== date))} className="font-bold text-red-300" aria-label={`Quitar ${date}`}>×</button>
          </span>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <label className="text-xs text-muted">
          Agregar fecha
          <input type="date" value={nextDate} onChange={(event) => setNextDate(event.target.value)} className="mt-1 block rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" />
        </label>
        <button type="button" onClick={addDate} disabled={!nextDate} className="rounded-lg border border-neon/30 px-3 py-2 text-xs font-bold text-neon disabled:opacity-40">+ Agregar</button>
      </div>
      {message && <p className="mt-3 text-xs text-neon">{message}</p>}
    </section>
  );
}
