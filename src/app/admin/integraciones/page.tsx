import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/supabase/require-role';
import { guardarIntegraciones } from './actions';

export default async function AdminIntegracionesPage() {
  await requireRole(['admin']);

  const supabase = createSupabaseServiceClient();
  const { data: integraciones } = await supabase
    .from('integraciones_secretas')
    .select('*')
    .eq('id', 'global')
    .maybeSingle();

  return (
    <div className="max-w-[640px]">
      <h1 className="font-display font-bold text-xl text-white mb-2">🔌 Integraciones</h1>
      <p className="text-xs text-muted mb-6">
        Estas claves se guardan en una tabla aislada que solo el servidor puede leer — nunca se envían al
        navegador, ni siquiera al tuyo cuando estás en este panel. Si cambiaste de Flow/Mercado Pago/Gemini/WhatsApp
        recientemente, puedes pegar las nuevas claves aquí con confianza.
      </p>

      <form action={guardarIntegraciones} className="flex flex-col gap-6">
        <fieldset className="bg-white/[0.03] border border-[rgba(0,255,179,0.1)] rounded-xl p-4">
          <legend className="text-sm font-bold text-white px-1">💳 Flow</legend>
          <label className="flex items-center gap-2 text-sm text-white mb-3 mt-2">
            <input type="checkbox" name="flow_enabled" defaultChecked={integraciones?.flow_enabled} />
            Habilitar Flow como método de pago
          </label>
          <label className="flex items-center gap-2 text-sm text-white mb-3">
            <input type="checkbox" name="flow_sandbox" defaultChecked={integraciones?.flow_sandbox ?? true} />
            Modo sandbox (pruebas, sin cobros reales)
          </label>
          <div className="mb-3">
            <label className="block text-xs text-muted mb-1.5">API Key</label>
            <input
              name="flow_api_key"
              type="password"
              defaultValue={integraciones?.flow_api_key || ''}
              className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1.5">Secret Key</label>
            <input
              name="flow_secret_key"
              type="password"
              defaultValue={integraciones?.flow_secret_key || ''}
              className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white"
            />
          </div>
        </fieldset>

        <fieldset className="bg-white/[0.03] border border-[rgba(0,255,179,0.1)] rounded-xl p-4">
          <legend className="text-sm font-bold text-white px-1">🟦 Mercado Pago</legend>
          <div className="mt-2">
            <label className="block text-xs text-muted mb-1.5">Access Token</label>
            <input
              name="mp_access_token"
              type="password"
              defaultValue={integraciones?.mp_access_token || ''}
              className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white"
            />
          </div>
        </fieldset>

        <fieldset className="bg-white/[0.03] border border-[rgba(0,255,179,0.1)] rounded-xl p-4">
          <legend className="text-sm font-bold text-white px-1">✨ Gemini (Chef Remy)</legend>
          <div className="mt-2">
            <label className="block text-xs text-muted mb-1.5">API Key</label>
            <input
              name="gemini_api_key"
              type="password"
              defaultValue={integraciones?.gemini_api_key || ''}
              className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white"
            />
          </div>
        </fieldset>

        <fieldset className="bg-white/[0.03] border border-[rgba(0,255,179,0.1)] rounded-xl p-4">
          <legend className="text-sm font-bold text-white px-1">💬 WhatsApp Business</legend>
          <p className="text-[11px] text-muted mb-3">
            URL del webhook a pegar en Meta: <code className="text-neon">tu-dominio.cl/api/whatsapp</code>
          </p>
          <div className="mt-2 mb-3">
            <label className="block text-xs text-muted mb-1.5">Access Token</label>
            <input
              name="wa_access_token"
              type="password"
              defaultValue={integraciones?.wa_access_token || ''}
              className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white"
            />
          </div>
          <div className="mb-3">
            <label className="block text-xs text-muted mb-1.5">Phone Number ID</label>
            <input
              name="wa_phone_number_id"
              defaultValue={integraciones?.wa_phone_number_id || ''}
              className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white"
            />
            <p className="text-[10px] text-muted mt-1">Necesario para poder ENVIAR mensajes, no solo recibirlos.</p>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1.5">Verify Token (webhook)</label>
            <input
              name="wa_verify_token"
              defaultValue={integraciones?.wa_verify_token || ''}
              className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white"
            />
          </div>
        </fieldset>

        <fieldset className="bg-white/[0.03] border border-[rgba(0,255,179,0.1)] rounded-xl p-4">
          <legend className="text-sm font-bold text-white px-1">📧 Emails transaccionales (Resend)</legend>
          <p className="text-[11px] text-muted mb-3">
            Necesitas un dominio verificado en Resend para que los emails lleguen de forma confiable.
          </p>
          <div className="mt-2 mb-3">
            <label className="block text-xs text-muted mb-1.5">API Key</label>
            <input
              name="resend_api_key"
              type="password"
              defaultValue={integraciones?.resend_api_key || ''}
              className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1.5">Email remitente</label>
            <input
              name="resend_from_email"
              type="email"
              placeholder="pedidos@lamanitodelvegano.cl"
              defaultValue={integraciones?.resend_from_email || ''}
              className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white"
            />
          </div>
        </fieldset>

        <fieldset className="bg-white/[0.03] border border-[rgba(0,255,179,0.1)] rounded-xl p-4">
          <legend className="text-sm font-bold text-white px-1">📈 Analítica y anuncios</legend>
          <p className="text-[11px] text-muted mb-3">
            Con esto, cada página de producto queda lista para campañas personalizadas de Meta/Google Ads —
            se registran las vistas de producto, agregados al carrito y compras.
          </p>
          <div className="mt-2 mb-3">
            <label className="block text-xs text-muted mb-1.5">Meta Pixel ID</label>
            <input
              name="meta_pixel_id"
              placeholder="1234567890123456"
              defaultValue={integraciones?.meta_pixel_id || ''}
              className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1.5">Google Analytics 4 — Measurement ID</label>
            <input
              name="ga4_measurement_id"
              placeholder="G-XXXXXXXXXX"
              defaultValue={integraciones?.ga4_measurement_id || ''}
              className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white"
            />
          </div>
        </fieldset>

        <button
          type="submit"
          className="bg-neon text-[#020705] font-bold py-3 rounded-full text-sm shadow-[0_0_15px_rgba(0,255,179,0.4)] hover:bg-white transition-all w-fit px-8"
        >
          Guardar integraciones
        </button>
      </form>
    </div>
  );
}
