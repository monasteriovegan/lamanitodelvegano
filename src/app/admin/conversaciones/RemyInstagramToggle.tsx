'use client';

import { useCallback, useEffect, useState } from 'react';

export default function RemyInstagramToggle() {
  const [instagramRemyEnabled, setInstagramRemyEnabled] = useState<boolean | null>(null);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadState = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/conversations/remy-instagram', { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'No se pudo consultar Remy Instagram');
      setInstagramRemyEnabled(body.enabled === true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo consultar Remy Instagram');
    }
  }, []);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  const toggle = async () => {
    if (updating || instagramRemyEnabled === null) return;
    const next = !instagramRemyEnabled;

    if (next && !window.confirm('Al encenderlo, Remy volverá a responder automáticamente los nuevos DM de Instagram. ¿Continuar?')) {
      return;
    }

    setUpdating(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/conversations/remy-instagram', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'No se pudo cambiar Remy Instagram');
      setInstagramRemyEnabled(body.enabled === true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar Remy Instagram');
    } finally {
      setUpdating(false);
    }
  };

  const enabled = instagramRemyEnabled === true;

  return (
    <div className={`w-[min(92vw,290px)] rounded-2xl border px-3 py-2.5 shadow-2xl backdrop-blur-xl ${
      enabled
        ? 'border-neon/35 bg-[#071b13]/95'
        : 'border-amber-300/30 bg-[#171108]/95'
    }`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-white/45">Control global</div>
          <div className={`mt-0.5 text-xs font-black ${enabled ? 'text-neon' : 'text-amber-200'}`}>
            🟣 Remy Instagram {instagramRemyEnabled === null ? '…' : enabled ? 'ON' : 'OFF'}
          </div>
        </div>
        <button
          type="button"
          aria-pressed={enabled}
          disabled={updating || instagramRemyEnabled === null}
          onClick={() => void toggle()}
          className={`shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-black transition-colors disabled:cursor-wait disabled:opacity-50 ${
            enabled
              ? 'border-amber-300/30 bg-amber-300/10 text-amber-100 hover:bg-amber-300/20'
              : 'border-neon/35 bg-neon/10 text-neon hover:bg-neon/20'
          }`}
        >
          {updating ? 'Guardando…' : enabled ? 'Apagar' : 'Encender'}
        </button>
      </div>
      <p className="mt-1.5 text-[9px] leading-4 text-white/40">
        Los DM siguen entrando al CRM; solo controla la respuesta automática. WhatsApp no cambia.
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
