'use client';

import { useState } from 'react';

export default function LocalComputerPairing() {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function createToken() {
    setLoading(true);
    setError('');
    setToken('');
    try {
      const response = await fetch('/api/admin/computer/local-token', { method: 'POST' });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error || 'No se pudo generar la clave');
      setToken(String(body.token || ''));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar la clave');
    } finally {
      setLoading(false);
    }
  }

  return <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
    <div className="text-sm font-black text-white">💻 Emparejar este PC con Wonka</div>
    <p className="mt-2 text-xs leading-5 text-white/55">Genera una clave exclusiva para Synthetiq Local Computer. Pégala una sola vez en el instalador de Windows; el instalador la guarda cifrada para tu usuario.</p>
    <button type="button" onClick={createToken} disabled={loading} className="mt-3 inline-flex min-h-11 items-center justify-center rounded-full border border-neon/30 bg-neon/10 px-4 text-xs font-black text-neon disabled:opacity-50">
      {loading ? 'Generando…' : 'Generar clave para este PC'}
    </button>
    {error && <div className="mt-3 rounded-xl bg-red-500/10 p-3 text-xs text-red-300">{error}</div>}
    {token && <div className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/5 p-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-amber-200">Se muestra una sola vez</div>
      <code className="mt-2 block break-all select-all text-xs text-white">{token}</code>
      <p className="mt-2 text-[10px] leading-4 text-white/40">No la pegues en chats ni prompts. Cópiala directamente al instalador local.</p>
    </div>}
  </div>;
}
