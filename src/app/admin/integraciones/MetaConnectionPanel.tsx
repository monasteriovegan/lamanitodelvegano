'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export type MetaConnectionAssetView = { id: string; asset_type: string; external_id: string; display_name: string | null; selected: boolean };
export type MetaConnectionView = { id: string; status: string; token_expires_at: string | null; last_error_code: string | null; assets: MetaConnectionAssetView[] };

const labels: Record<string, string> = {
  page: 'Facebook Page', instagram_account: 'Instagram', whatsapp_business_account: 'WhatsApp Business',
  whatsapp_phone_number: 'WhatsApp', ad_account: 'Meta Ads', business: 'Business Portfolio', dataset: 'Dataset',
};

export function MetaConnectionPanel({ businessUnitId, businessName, connection }: {
  businessUnitId: string; businessName: string; connection: MetaConnectionView | null;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(connection?.assets.filter((a) => a.selected).map((a) => a.id) || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [verified, setVerified] = useState(false);
  const needsSelection = connection?.status === 'pending';
  const connectUrl = `/api/meta/oauth/start?business_unit_id=${encodeURIComponent(businessUnitId)}`;
  const instagramLoginUrl = `/api/meta/instagram/oauth/start?business_unit_id=${encodeURIComponent(businessUnitId)}`;

  async function saveSelection() {
    if (!connection || !selected.length) return setError('Selecciona al menos un activo autorizado.');
    setSaving(true); setError('');
    const response = await fetch('/api/meta/assets/select', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connectionId: connection.id, assetIds: selected }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) setError(body.error || 'No fue posible guardar la selección.');
    else {
      setVerified(true);
      router.refresh();
    }
    setSaving(false);
  }

  return (
    <section className="mb-6 rounded-xl border border-blue-400/20 bg-blue-400/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-white">Meta · {businessName}</h2>
          <p className="mt-1 text-xs text-white/60">
            Estado: <span className="font-semibold text-white">{connection?.status || 'disconnected'}</span>
            {connection?.last_error_code ? ` · ${connection.last_error_code}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!connection || ['disconnected', 'expired', 'revoked', 'degraded'].includes(connection.status) ? (
            <a href={connectUrl} className="rounded-full bg-blue-500 px-4 py-2 text-xs font-bold text-white">
              {connection ? 'Reconectar / reautorizar' : 'Conectar con Meta'}
            </a>
          ) : null}
          <a href={instagramLoginUrl} className="rounded-full border border-fuchsia-300/40 bg-fuchsia-400/10 px-4 py-2 text-xs font-bold text-fuchsia-100">
            Autorizar Instagram Login
          </a>
        </div>
      </div>

      <p className="mt-3 text-[11px] text-white/55">
        Instagram Login usa la credencial propia de Instagram para responder DMs reales; la conexión Meta/Facebook se conserva para Page, Ads y WhatsApp.
      </p>

      {connection?.assets?.length ? (
        <div className="mt-4 grid gap-2">
          {connection.assets.map((asset) => (
            <label key={asset.id} className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-white">
              <input type="checkbox" checked={selected.includes(asset.id)} disabled={!needsSelection}
                onChange={(event) => setSelected((current) => event.target.checked ? [...current, asset.id] : current.filter((id) => id !== asset.id))} />
              <span><strong>{labels[asset.asset_type] || asset.asset_type}</strong> · {asset.display_name || asset.external_id}</span>
            </label>
          ))}
          {needsSelection ? <button type="button" disabled={saving} onClick={saveSelection}
            className="mt-2 w-fit rounded-full bg-neon px-5 py-2 text-xs font-bold text-black disabled:opacity-50">
            {saving ? 'Guardando…' : 'Guardar activos seleccionados'}
          </button> : null}
          {!needsSelection && selected.length ? <button type="button" disabled={saving} onClick={saveSelection}
            className="mt-2 w-fit rounded-full border border-blue-300/40 px-5 py-2 text-xs font-bold text-blue-100 disabled:opacity-50">
            {saving ? 'Verificando…' : 'Verificar conexión y webhooks'}
          </button> : null}
        </div>
      ) : null}
      {verified ? <p className="mt-3 text-xs text-emerald-300">Conexión y suscripción de webhooks verificadas.</p> : null}
      {error ? <p className="mt-3 text-xs text-red-300">{error}</p> : null}
      {connection && connection.status !== 'disconnected' ? (
        <form action="/api/meta/connections/disconnect" method="post" className="mt-4">
          <input type="hidden" name="connection_id" value={connection.id} />
          <button className="text-xs text-red-300 underline">Desconectar sin borrar historial</button>
        </form>
      ) : null}
    </section>
  );
}
