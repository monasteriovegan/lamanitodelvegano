'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createSupabaseAuthBrowserClient } from '@/lib/supabase/auth-client';

function LoginForm() {
  const searchParams = useSearchParams();
  const errorParam = searchParams.get('error');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    errorParam === 'sin-permiso'
      ? 'Tu cuenta no tiene permisos de administrador.'
      : errorParam === 'callback-failed'
        ? 'Error al verificar la sesión. Intenta de nuevo.'
        : null
  );
  const [resetSent, setResetSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      setError("Error de configuración: Faltan las variables NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en el navegador.");
      setLoading(false);
      return;
    }

    try {
      const supabase = createSupabaseAuthBrowserClient();
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

      if (authError) {
        setError(`Error de autenticación: ${authError.message}`);
        setLoading(false);
        return;
      }

      // Usar window.location.href para forzar una recarga completa del servidor
      // y que las cookies de sesión se lean correctamente en el Server Component del layout
      window.location.href = '/admin/productos';
    } catch (err: any) {
      console.error("Error en login:", err);
      setError(`Error inesperado al ingresar: ${err?.message || err || 'Desconocido'}`);
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    if (!email) {
      setError('Ingresa tu email primero para recuperar la contraseña.');
      return;
    }
    const supabase = createSupabaseAuthBrowserClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/admin/callback?next=/admin/update-password`,
    });
    if (resetError) {
      setError(`Error al enviar el email: ${resetError.message}`);
    } else {
      setResetSent(true);
      setError(null);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-fondo px-4">
      <form onSubmit={handleSubmit} className="glass rounded-2xl p-8 w-full max-w-[380px]">
        <div className="text-center mb-6">
          <span className="inline-flex w-12 h-12 rounded-full bg-[rgba(0,255,179,0.15)] border border-[rgba(0,255,179,0.3)] items-center justify-center text-2xl mb-3">
            🌱
          </span>
          <h1 className="font-display font-bold text-lg text-white">Panel Admin</h1>
          <p className="text-xs text-muted">La Manito Del Vegano</p>
        </div>

        {resetSent && (
          <div className="bg-[rgba(0,255,179,0.1)] border border-[rgba(0,255,179,0.3)] text-neon text-xs rounded-lg p-3 mb-4">
            ✅ Email de recuperación enviado a {email}. Revisa tu bandeja.
          </div>
        )}

        {error && (
          <div className="bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.3)] text-rojo text-xs rounded-lg p-3 mb-4">
            {error}
          </div>
        )}

        <label className="block text-xs text-muted mb-1.5">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white mb-4"
          placeholder="tu@email.com"
        />

        <label className="block text-xs text-muted mb-1.5">Contraseña</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white mb-5"
          placeholder="••••••••"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-neon text-[#020705] font-bold py-3 rounded-full text-sm shadow-[0_0_15px_rgba(0,255,179,0.4)] transition-all hover:bg-white disabled:opacity-50 mb-3"
        >
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>

        <button
          type="button"
          onClick={handleResetPassword}
          className="w-full text-muted text-xs hover:text-neon transition-colors"
        >
          ¿Olvidaste tu contraseña? Recuperar acceso
        </button>
      </form>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-fondo" />}>
      <LoginForm />
    </Suspense>
  );
}
