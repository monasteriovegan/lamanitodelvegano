'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function OpportunityActions({ id, initialMessage }: { id: string; initialMessage: string }) {
  const router = useRouter();
  const [message, setMessage] = useState(initialMessage);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function patch(body: Record<string, unknown>) {
    const res = await fetch(`/api/admin/sales-opportunities/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'No se pudo actualizar.');
    return data;
  }

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setFeedback(null);
    try { await action(); router.refresh(); }
    catch (error) { setFeedback(error instanceof Error ? error.message : 'Ocurrió un error.'); }
    finally { setBusy(false); }
  }

  const sendNow = () => run(async () => {
    const res = await fetch(`/api/admin/sales-opportunities/${id}/send`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'No se pudo enviar.');
    setFeedback(data.persisted === false ? 'Enviado; el CRM debe reconciliar el historial.' : '✅ Mensaje enviado');
  });

  const saveMessage = () => run(async () => {
    await patch({ action: 'update_message', message });
    setEditing(false);
    setFeedback('✅ Mensaje actualizado');
  });

  const snooze = () => {
    const raw = window.prompt('¿En cuántas horas quieres volver a verlo?', '24');
    if (!raw) return;
    const hours = Number(raw);
    if (!Number.isFinite(hours) || hours <= 0 || hours > 720) return setFeedback('Ingresa entre 1 y 720 horas.');
    void run(async () => {
      const until = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
      await patch({ action: 'snooze', until });
    });
  };

  const dismiss = () => {
    if (!window.confirm('¿Descartar esta oportunidad? Remy no la seguirá automáticamente.')) return;
    void run(async () => { await patch({ action: 'dismiss' }); });
  };

  return (
    <div className="mt-3">
      {editing ? (
        <div className="space-y-2">
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1500} rows={3}
            className="w-full rounded-lg border border-white/15 bg-black/20 p-2.5 text-sm text-white outline-none focus:border-neon" />
          <div className="flex gap-2">
            <button disabled={busy} onClick={saveMessage} className="rounded-lg bg-neon px-3 py-2 text-xs font-bold text-black disabled:opacity-50">Guardar mensaje</button>
            <button disabled={busy} onClick={() => { setEditing(false); setMessage(initialMessage); }} className="rounded-lg border border-white/15 px-3 py-2 text-xs text-white/70">Cancelar</button>
          </div>
        </div>
      ) : (
        <p className="rounded-lg border border-white/10 bg-black/15 p-2.5 text-sm text-white/75">{message}</p>
      )}

      <div className="mt-2 flex flex-wrap gap-2">
        <button disabled={busy || !message.trim()} onClick={sendNow} className="rounded-lg bg-neon px-3 py-2 text-xs font-bold text-black disabled:opacity-50">Enviar ahora</button>
        <button disabled={busy} onClick={() => setEditing(true)} className="rounded-lg border border-white/15 px-3 py-2 text-xs text-white/80">Editar mensaje</button>
        <button disabled={busy} onClick={snooze} className="rounded-lg border border-amber-400/25 px-3 py-2 text-xs text-amber-200">Recordarme después</button>
        <button disabled={busy} onClick={dismiss} className="rounded-lg border border-red-400/25 px-3 py-2 text-xs text-red-300">Descartar</button>
      </div>
      {feedback && <p className="mt-2 text-xs text-white/65">{feedback}</p>}
    </div>
  );
}
