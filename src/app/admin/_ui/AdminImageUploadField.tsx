'use client';

import { useRef, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type SignedUpload = {
  bucket: string;
  path: string;
  token: string;
  publicUrl: string;
};

type Props = {
  name: string;
  label: string;
  value?: string;
  defaultValue?: string;
  onChange?: (url: string) => void;
  helpText?: string;
  manualLabel?: string;
  className?: string;
};

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_SIZE = 12 * 1024 * 1024;

export function AdminImageUploadField({
  name,
  label,
  value,
  defaultValue = '',
  onChange,
  helpText = 'JPG, PNG o WEBP. La imagen se guarda en la biblioteca de Supabase.',
  manualLabel = 'Usar URL manual',
  className = '',
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [manualOpen, setManualOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const currentValue = value !== undefined ? value : internalValue;

  const setCurrentValue = (next: string) => {
    if (value === undefined) setInternalValue(next);
    onChange?.(next);
  };

  const uploadFile = async (file: File) => {
    if (!ALLOWED_TYPES.has(file.type)) {
      setError('Formato no compatible. Usa JPG, PNG o WEBP.');
      return;
    }
    if (file.size <= 0 || file.size > MAX_SIZE) {
      setError('La imagen debe pesar menos de 12 MB.');
      return;
    }

    setUploading(true);
    setError('');
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

      setCurrentValue(signed.publicUrl);
      setManualOpen(false);
      if (fileRef.current) fileRef.current.value = '';
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'No se pudo subir la imagen.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <input type="hidden" name={name} value={currentValue} readOnly />
      <div className="flex items-center justify-between gap-3">
        <label className="text-xs text-muted">{label}</label>
        <button
          type="button"
          onClick={() => setManualOpen((open) => !open)}
          className="text-[11px] font-semibold text-neon/80 hover:text-neon"
        >
          {manualOpen ? 'Ocultar URL' : manualLabel}
        </button>
      </div>

      {currentValue && (
        <div className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={currentValue} alt={`Vista previa: ${label}`} className="max-h-56 w-full object-contain" />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <label className="cursor-pointer rounded-xl bg-neon px-4 py-2.5 text-xs font-extrabold text-[#02100a] transition hover:bg-white">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            disabled={uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadFile(file);
            }}
          />
          {uploading ? 'Subiendo…' : currentValue ? '📁 Reemplazar imagen' : '📁 Subir imagen'}
        </label>
        {currentValue && (
          <button
            type="button"
            onClick={() => {
              setCurrentValue('');
              setError('');
            }}
            className="rounded-xl border border-white/10 px-3 py-2.5 text-xs font-semibold text-white/60 hover:text-white"
          >
            Quitar imagen
          </button>
        )}
      </div>

      {manualOpen && (
        <input
          type="url"
          value={currentValue}
          onChange={(event) => setCurrentValue(event.target.value)}
          placeholder="https://..."
          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white"
        />
      )}

      <p className="text-[11px] text-white/35">{helpText}</p>
      {error && <p className="text-xs text-red-300">{error}</p>}
    </div>
  );
}
