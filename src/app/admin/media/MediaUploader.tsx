'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type SignedUpload = {
  bucket: string;
  path: string;
  token: string;
  publicUrl: string;
};

type MediaItem = {
  path: string;
  publicUrl: string;
  kind: 'image' | 'video';
  contentType: string;
  size: number;
  createdAt: string | null;
};

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm';

function formatBytes(bytes: number) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string | null) {
  if (!value) return 'Fecha no disponible';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible';
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function MediaUploader() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [publicUrl, setPublicUrl] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(true);
  const [libraryError, setLibraryError] = useState('');
  const [copiedPath, setCopiedPath] = useState('');

  const loadLibrary = useCallback(async () => {
    setLoadingLibrary(true);
    setLibraryError('');
    try {
      const response = await fetch('/api/admin/media', { cache: 'no-store' });
      const payload = await response.json() as { items?: MediaItem[]; error?: string };
      if (!response.ok) throw new Error(payload.error || 'No se pudo cargar la biblioteca.');
      setItems(payload.items || []);
    } catch (err) {
      setLibraryError(err instanceof Error ? err.message : 'No se pudo cargar la biblioteca.');
    } finally {
      setLoadingLibrary(false);
    }
  }, []);

  useEffect(() => {
    void loadLibrary();
  }, [loadLibrary]);

  const upload = async () => {
    if (!file || uploading) return;
    setUploading(true);
    setError('');
    setPublicUrl('');
    setCopied(false);

    try {
      const signResponse = await fetch('/api/admin/media/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, contentType: file.type, size: file.size }),
      });
      const signed = await signResponse.json() as SignedUpload & { error?: string };
      if (!signResponse.ok) throw new Error(signed.error || 'No se pudo preparar la subida.');

      const supabase = createSupabaseBrowserClient();
      const { error: uploadError } = await supabase.storage
        .from(signed.bucket)
        .uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type });
      if (uploadError) throw uploadError;

      setPublicUrl(signed.publicUrl);
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
      await loadLibrary();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir el archivo.');
    } finally {
      setUploading(false);
    }
  };

  const copyUrl = async () => {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const copyLibraryUrl = async (item: MediaItem) => {
    await navigator.clipboard.writeText(item.publicUrl);
    setCopiedPath(item.path);
    window.setTimeout(() => setCopiedPath(''), 1800);
  };

  return (
    <div className="space-y-8">
      <div className="space-y-5">
        <label className="block cursor-pointer rounded-2xl border border-dashed border-neon/25 bg-neon/[0.035] p-6 text-center transition hover:border-neon/50 hover:bg-neon/[0.06]">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(event) => {
              const next = event.target.files?.[0] || null;
              setFile(next);
              setPublicUrl('');
              setError('');
            }}
          />
          <div className="text-3xl">⬆️</div>
          <div className="mt-2 text-sm font-bold text-white">Elegir foto o video</div>
          <div className="mt-1 text-[11px] text-white/40">JPG, PNG, WEBP, GIF, MP4, MOV o WEBM</div>
        </label>

        {file && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.035] p-4">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-white">{file.name}</div>
              <div className="mt-1 text-[11px] text-white/40">{file.type || 'archivo'} · {formatBytes(file.size)}</div>
            </div>
            <button
              type="button"
              onClick={() => void upload()}
              disabled={uploading}
              className="rounded-full bg-neon px-5 py-2.5 text-xs font-black text-[#02100a] disabled:opacity-50"
            >
              {uploading ? 'Subiendo…' : 'Subir y crear URL'}
            </button>
          </div>
        )}

        {error && <div className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-xs text-red-100">{error}</div>}

        {publicUrl && (
          <div className="rounded-2xl border border-neon/25 bg-neon/[0.055] p-4">
            <div className="text-xs font-bold text-neon">✓ Archivo público listo</div>
            <div className="mt-3 break-all rounded-xl border border-white/10 bg-black/20 p-3 text-xs leading-5 text-white/70">{publicUrl}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => void copyUrl()} className="rounded-full bg-neon px-4 py-2 text-xs font-bold text-[#02100a]">
                {copied ? '✓ Copiado' : 'Copiar URL'}
              </button>
              <a href={publicUrl} target="_blank" rel="noreferrer" className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-white/70 hover:text-white">
                Abrir archivo
              </a>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-white/10 pt-7">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-black text-white">Biblioteca de creativos</h3>
            <p className="mt-1 text-xs text-white/40">Todo lo que subas aquí queda disponible para volver a copiar su URL.</p>
          </div>
          <button
            type="button"
            onClick={() => void loadLibrary()}
            disabled={loadingLibrary}
            className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-white/70 disabled:opacity-50"
          >
            {loadingLibrary ? 'Actualizando…' : '↻ Actualizar'}
          </button>
        </div>

        {libraryError && <div className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-xs text-red-100">{libraryError}</div>}

        {!loadingLibrary && !libraryError && items.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-7 text-center text-sm text-white/40">
            Todavía no hay creativos subidos.
          </div>
        )}

        {items.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {items.map((item) => (
              <article key={item.path} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
                <div className="flex aspect-video items-center justify-center overflow-hidden bg-black/35">
                  {item.kind === 'video' ? (
                    <video src={item.publicUrl} controls preload="metadata" className="h-full w-full object-contain" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.publicUrl} alt="Creativo publicitario" loading="lazy" className="h-full w-full object-contain" />
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white">{item.kind === 'video' ? '🎬 Video' : '🖼️ Imagen'}</div>
                      <div className="mt-1 text-[10px] text-white/40">
                        {formatDate(item.createdAt)}{item.size ? ` · ${formatBytes(item.size)}` : ''}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 line-clamp-2 break-all text-[10px] leading-4 text-white/35">{item.publicUrl}</div>
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => void copyLibraryUrl(item)}
                      className="flex-1 rounded-full bg-neon px-4 py-2.5 text-xs font-black text-[#02100a]"
                    >
                      {copiedPath === item.path ? '✓ Copiado' : 'Copiar URL'}
                    </button>
                    <a
                      href={item.publicUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-white/15 px-4 py-2.5 text-xs font-semibold text-white/70"
                    >
                      Abrir
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
