'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseAuthBrowserClient } from '@/lib/supabase/auth-client';

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    setLoading(true);
    setError(null);

    const supabase = createSupabaseAuthBrowserClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(`Error: ${updateError.message}`);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setTimeout(() => router.push('/admin/login'), 2000);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-fondo px-4">
      <form onSubmit={handleSubmit} className="glass rounded-2xl p-8 w-full max-w-[380px]">
        <div className="text-center mb-6">
          <span className="inline-flex w-12 h-12 rounded-full bg-[rgba(0,255,179,0.15)] border border-[rgba(0,255,179,0.3)] items-center justify-center text-2xl mb-3">
            🌱
          </span>
          <h1 className="font-display font-bold text-lg text-white">Nueva Contraseña</h1>
          <p className="text-xs text-muted">La Manito Del Vegano</p>
        </div>

        {success && (
          <div className="bg-[rgba(0,255,179,0.1)] border border-[rgba(0,255,179,0.3)] text-neon text-xs rounded-lg p-3 mb-4">
            ✅ Contraseña actualizada. Redirigiendo al login...
          </div>
        )}

        {error && (
          <div className="bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.3)] text-rojo text-xs rounded-lg p-3 mb-4">
            {error}
          </div>
        )}

        <label className="block text-xs text-muted mb-1.5">Nueva contraseña</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white mb-4"
          placeholder="••••••••"
        />

        <label className="block text-xs text-muted mb-1.5">Confirmar contraseña</label>
        <input
          type="password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white mb-5"
          placeholder="••••••••"
        />

        <button
          type="submit"
          disabled={loading || success}
          className="w-full bg-neon text-[#020705] font-bold py-3 rounded-full text-sm shadow-[0_0_15px_rgba(0,255,179,0.4)] transition-all hover:bg-white disabled:opacity-50"
        >
          {loading ? 'Actualizando...' : 'Guardar contraseña'}
        </button>
      </form>
    </div>
  );
}
