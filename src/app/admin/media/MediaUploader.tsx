'use client';

import { useRef, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type SignedUpload = {
  bucket: string;
  path: string;
  token: string;
  publicUrl: string;
};

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm';

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MediaUploader() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [publicUrl, setPublicUrl] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

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

  return (
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
          <p className="mt-3 text-[10px] leading-4 text-white/35">Este enlace es público y estable. Puedes pegarlo directamente donde necesites el URL del creativo.</p>
        </div>
      )}
    </div>
  );
}
