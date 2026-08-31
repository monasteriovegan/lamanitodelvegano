import { requireRole } from '@/lib/supabase/require-role';

export const dynamic = 'force-dynamic';

export default async function WhatsAppSystemTokenHandoffPage() {
  await requireRole(['admin']);

  return (
    <main className="mx-auto max-w-lg p-8 text-white">
      <h1 className="mb-3 text-xl font-bold">Credencial de servicio WhatsApp</h1>
      <p className="mb-6 text-sm text-white/70">
        Uso administrativo temporal. El servidor validará tipo, app y permisos antes de reemplazar la credencial.
      </p>
      <form method="post" action="/api/admin/whatsapp/system-user-token" className="space-y-4">
        <label className="block text-sm font-medium" htmlFor="token">System User Access Token</label>
        <input
          id="token"
          name="token"
          type="password"
          autoComplete="off"
          required
          className="w-full rounded-lg border border-white/20 bg-black/30 px-3 py-2"
        />
        <button type="submit" className="rounded-lg bg-emerald-400 px-4 py-2 font-semibold text-black">
          Validar y guardar
        </button>
      </form>
    </main>
  );
}
