'use client';

import { useCallback, useEffect, useState } from 'react';

export default function RemyGlobalToggle() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadState = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/conversations/remy-global', { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'No se pudo consultar Remy global');
      setEnabled(body.enabled === true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo consultar Remy global');
    }
  }, []);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  const toggle = async () => {
    if (updating || enabled === null) return;
    const next = !enabled;
    if (next && !window.confirm('Esto encenderá el corte global de Remy. Los canales que además estén habilitados podrán volver a responder automáticamente. ¿Continuar?')) {
      return;
    }

    setUpdating(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/conversations/remy-global', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'No se pudo cambiar Remy global');
      setEnabled(body.enabled === true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar Remy global');
    } finally {
      setUpdating(false);
    }
  };

  const active = enabled === true;

  return (
    <div className={`w-[min(92vw,290px)] rounded-2xl border px-3 py-2.5 shadow-2xl backdrop-blur-xl ${
      active
        ? 'border-neon/35 bg-[#071b13]/95'
        : 'border-red-300/30 bg-[#190b0b]/95'
    }`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-white/45">Corte maestro real</div>
          <div className={`mt-0.5 text-xs font-black ${active ? 'text-neon' : 'text-red-200'}`}>
            🤖 Remy global {enabled === null ? '…' : active ? 'ON' : 'OFF'}
          </div>
        </div>
        <button
          type="button"
          aria-pressed={active}
          disabled={updating || enabled === null}
          onClick={() => void toggle()}
          className={`shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-black transition-colors disabled:cursor-wait disabled:opacity-50 ${
            active
              ? 'border-red-300/30 bg-red-300/10 text-red-100 hover:bg-red-300/20'
              : 'border-neon/35 bg-neon/10 text-neon hover:bg-neon/20'
          }`}
        >
          {updating ? 'Guardando…' : active ? 'Apagar todo' : 'Encender'}
        </button>
      </div>
      <p className="mt-1.5 text-[9px] leading-4 text-white/45">
        OFF bloquea las respuestas automáticas de Remy en WhatsApp e Instagram aunque un chat individual siga marcado como Remy.
      </p>
      {error && (
        <div className="mt-1.5 flex items-center justify-between gap-2 text-[9px] text-red-300">
          <span className="truncate">{error}</span>
          <button type="button" onClick={() => void loadState()} className="shrink-0 underline">Reintentar</button>
        </div>
      )}
    </div>
  );
}
