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

  const close = () => {
    if (sending) return;
    setOpen(false);
    setError(null);
  };

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
        aria-label="Adjuntar imagen para Flow"
        title="Imagen para Flow"
        onClick={() => setOpen(true)}
        className="fixed bottom-[78px] right-3 z-[58] grid h-11 w-11 place-items-center rounded-full border border-neon/30 bg-[#07150f] text-lg text-neon shadow-2xl md:bottom-6 md:right-6 md:h-auto md:w-auto md:px-4 md:py-3 md:text-xs md:font-black"
      >
        <span className="md:hidden">📎</span>
        <span className="hidden md:inline">📎 Imagen para Flow</span>
      </button>

      {open && (
        <div className="fixed inset-x-0 top-0 bottom-[68px] z-[80] flex items-end justify-center bg-black/75 backdrop-blur-sm md:inset-0 md:items-center md:p-4">
          <div className="max-h-[calc(100dvh-68px)] w-full overflow-y-auto rounded-t-2xl border border-white/10 bg-[#07110d] p-3 shadow-2xl md:max-h-[90vh] md:max-w-lg md:rounded-2xl md:p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-black text-white">🎩 Imagen → Flow</div>
                <div className="mt-0.5 text-[10px] text-white/45">JPG, PNG o WEBP · máximo 15 MB</div>
              </div>
              <button onClick={close} disabled={sending} className="shrink-0 rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/55 disabled:opacity-40">Cerrar</button>
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
              className="mt-3 w-full rounded-xl border border-dashed border-neon/30 bg-neon/[0.04] px-3 py-3 text-sm font-bold text-neon"
            >
              {file ? `✓ ${file.name}` : '📷 Elegir foto'}
            </button>

            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={3}
              maxLength={4000}
              className="mt-3 min-h-[92px] w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white outline-none focus:border-neon/50"
              placeholder="Describe el video que quieres crear…"
            />

            {error && <div className="mt-2 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">{error}</div>}

            <button
              type="button"
              disabled={!file || !prompt.trim() || sending}
              onClick={() => void send()}
              className="mt-3 w-full rounded-xl bg-neon px-4 py-3 text-sm font-black text-black disabled:opacity-40"
            >
              {sending ? 'Enviando…' : 'Enviar a Wonka'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
