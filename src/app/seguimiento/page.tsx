'use client';

import { useEffect, useState } from 'react';
import { SiteShell } from '@/components/layout/SiteShell';

interface TrackingData {
  id: string;
  trackingNumber: string | null;
  nombreCliente: string;
  direccion: string;
  zonaEnvio: string | null;
  fechaDespacho: string | null;
  metodoPago: string | null;
  paymentStatus: string;
  status: string;
  total: number;
  createdAt: string;
}

const STEPS = [
  { label: 'Recibido', icon: '📝' },
  { label: 'En Cocina', icon: '👨‍🍳' },
  { label: 'En Camino', icon: '🚚' },
  { label: 'Entregado', icon: '🌱' },
];

function getProgress(status: string): { progress: number; completed: boolean[] } {
  if (status === 'Pendiente' || status === 'WhatsApp') return { progress: 0, completed: [false, false, false, false] };
  if (status === 'Pagado' || status === 'Confirmado' || status === 'Procesando') return { progress: 33, completed: [true, false, false, false] };
  if (status === 'Despachado') return { progress: 66, completed: [true, true, true, false] };
  if (status === 'Completado') return { progress: 100, completed: [true, true, true, true] };
  return { progress: 0, completed: [false, false, false, false] };
}

function paymentMethodLabel(value: string | null) {
  const method = String(value || '').toLowerCase();
  if (method === 'mercadopago') return 'Mercado Pago';
  if (method === 'flow') return 'Flow';
  if (method === 'transfer') return 'Transferencia';
  if (method === 'whatsapp') return 'WhatsApp / coordinación';
  return value || 'No especificado';
}

function paymentStatusLabel(value: string) {
  const status = String(value || 'pending').toLowerCase();
  if (status === 'paid') return 'Pagado';
  if (status === 'failed') return 'Fallido';
  if (status === 'refunded') return 'Reembolsado';
  if (status === 'partial') return 'Parcial';
  return 'Pendiente';
}

export default function SeguimientoPage() {
  const [inputId, setInputId] = useState('');
  const [resultado, setResultado] = useState<TrackingData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function buscar(value?: string) {
    const code = String(value ?? inputId).trim();
    if (!code) return;
    setLoading(true);
    setError(null);
    setResultado(null);

    try {
      const res = await fetch(`/api/tracking?id=${encodeURIComponent(code)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'No se pudo encontrar el pedido.');
      } else {
        setResultado(data);
      }
    } catch {
      setError('Error de conexión. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialTracking = params.get('tracking') || params.get('id') || '';
    if (initialTracking) {
      setInputId(initialTracking.toUpperCase());
      void buscar(initialTracking);
    }
    // Sólo se ejecuta al abrir la página con un código en la URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SiteShell>
      <main className="pt-[100px] px-4 pb-16 max-w-[480px] mx-auto">
        <h1 className="font-display font-bold text-xl text-white mb-2">📍 Rastrea tu pedido</h1>
        <p className="text-sm text-muted mb-5">Ingresa el código de seguimiento que recibiste al confirmar tu pedido.</p>

        <div className="flex gap-2 mb-6">
          <input
            value={inputId}
            onChange={(e) => setInputId(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && buscar()}
            placeholder="Ej: LMV-7F3A91C2D8"
            className="flex-1 bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-full px-4 py-2.5 text-sm text-white font-mono"
          />
          <button
            onClick={() => buscar()}
            disabled={loading}
            className="bg-neon text-[#020705] px-5 rounded-full text-sm font-bold disabled:opacity-50"
          >
            {loading ? '...' : 'Buscar'}
          </button>
        </div>

        {error && (
          <div className="bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.3)] text-rojo text-sm rounded-xl p-4 text-center">
            {error}
          </div>
        )}

        {resultado && (
          <div className="glass rounded-2xl p-5">
            {resultado.status === 'Cancelado' ? (
              <div className="text-center">
                <p className="text-3xl mb-2">❌</p>
                <p className="font-display font-bold text-white">Pedido Cancelado</p>
                <p className="text-xs text-muted mt-1">
                  El pedido {resultado.trackingNumber || `#${resultado.id}`} fue cancelado.
                </p>
              </div>
            ) : (
              <>
                <p className="text-[10px] uppercase text-muted font-bold tracking-wider">Código de seguimiento</p>
                <p className="font-mono font-bold text-lg text-neon mb-1">
                  {resultado.trackingNumber || '—'}
                </p>
                <p className="text-xs text-muted mb-5">
                  Pedido #{resultado.id} · {new Date(resultado.createdAt).toLocaleDateString('es-CL', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>

                <div className="relative mb-6">
                  <div className="absolute top-3 left-3 right-3 h-0.5 bg-white/10" />
                  <div
                    className="absolute top-3 left-3 h-0.5 bg-neon transition-all"
                    style={{ width: `${getProgress(resultado.status).progress}%` }}
                  />
                  <div className="flex justify-between relative">
                    {STEPS.map((step, idx) => {
                      const completed = getProgress(resultado.status).completed[idx];
                      return (
                        <div key={step.label} className="flex flex-col items-center gap-1.5 z-[1]">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                              completed ? 'bg-neon text-[#020705]' : 'bg-white/10 text-white/60'
                            }`}
                          >
                            {completed ? '✓' : step.icon}
                          </div>
                          <span className="text-[9px] text-white/60">{step.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-white/5 rounded-xl p-4 text-xs text-white/80 leading-relaxed">
                  <p>👤 <strong>Cliente:</strong> {resultado.nombreCliente || '—'}</p>
                  <p>📍 <strong>Despacho:</strong> {resultado.direccion || '—'} ({resultado.zonaEnvio || '—'})</p>
                  <p>📅 <strong>Fecha entrega:</strong> {resultado.fechaDespacho || 'Por confirmar'}</p>
                  <p className="mt-2 pt-2 border-t border-white/10">
                    <strong>Medio de pago:</strong> {paymentMethodLabel(resultado.metodoPago)}
                  </p>
                  <p><strong>Estado del pago:</strong> {paymentStatusLabel(resultado.paymentStatus)}</p>
                  <p className="text-base font-bold text-neon mt-1">
                    Total: ${resultado.total.toLocaleString('es-CL')}
                  </p>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </SiteShell>
  );
}
