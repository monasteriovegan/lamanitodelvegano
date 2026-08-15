'use client';

import { useRef, useState } from 'react';

type UploadedAttachment = { path: string; name: string; mime: string };

export default function WonkaImageFlowComposer() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState('Haz un video en Flow usando esta imagen como referencia.');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (!file || !prompt.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const uploadResponse = await fetch('/api/admin/wonka/attachments', { method: 'POST', body: form });
      const uploadBody = await uploadResponse.json();
      if (!uploadResponse.ok) throw new Error(uploadBody.error || 'No se pudo subir la imagen');
      const uploaded = uploadBody.attachment as UploadedAttachment;

      const chatResponse = await fetch('/api/admin/wonka/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: prompt.trim(),
          attachments: [{ path: uploaded.path, name: uploaded.name, mime: uploaded.mime }],
        }),
      });
      const chatBody = await chatResponse.json();
      if (!chatResponse.ok) throw new Error(chatBody.error || 'Wonka no pudo procesar la imagen');
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar');
      setSending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-[78px] right-3 z-[58] rounded-full border border-neon/30 bg-[#07150f] px-4 py-3 text-xs font-black text-neon shadow-2xl md:bottom-6 md:right-6"
      >
        📎 Imagen para Flow
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm md:items-center">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#07110d] p-4 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-black text-white">🎩 Wonka · Imagen → Flow</div>
                <div className="mt-1 text-[10px] text-white/45">1 imagen · JPG/PNG/WEBP · hasta 15 MB</div>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/55">Cerrar</button>
            </div>

            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="mt-4 w-full rounded-xl border border-dashed border-neon/30 bg-neon/[0.04] px-4 py-5 text-sm font-bold text-neon"
            >
              {file ? `✓ ${file.name}` : '📷 Elegir foto del teléfono'}
            </button>

            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={4}
              maxLength={4000}
              className="mt-3 w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white outline-none focus:border-neon/50"
              placeholder="Ej: Haz un video vertical de 8 segundos con movimiento cinematográfico…"
            />

            {error && <div className="mt-3 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">{error}</div>}

            <button
              type="button"
              disabled={!file || !prompt.trim() || sending}
              onClick={() => void send()}
              className="mt-3 w-full rounded-xl bg-neon px-4 py-3 text-sm font-black text-black disabled:opacity-40"
            >
              {sending ? 'Enviando a Wonka…' : 'Enviar a Wonka y usar Flow'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
