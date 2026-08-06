'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { guardarPedidoGestion } from '../actions';
import type { EstadoPedido } from '@/types/domain';

const ESTADOS: EstadoPedido[] = ['Pendiente', 'Pagado', 'Despachado', 'Completado', 'Cancelado', 'WhatsApp'];

export function OrderGestionForm({
  orderId,
  currentStatus,
  currentTracking,
  currentNotes,
}: {
  orderId: string;
  currentStatus: EstadoPedido;
  currentTracking: string;
  currentNotes: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<EstadoPedido>(currentStatus);
  const [tracking, setTracking] = useState(currentTracking);
  const [notes, setNotes] = useState(currentNotes);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      await guardarPedidoGestion(orderId, status, tracking, notes);
      setMessage({ text: '✓ Pedido gestionado y actualizado con éxito', error: false });
      router.refresh();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'desconocido';
      setMessage({ text: `⚠ Error al guardar: ${errorMsg}`, error: true });
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(null), 3500);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white/[0.02] border border-[rgba(0,255,179,0.1)] rounded-2xl p-5 md:p-6 flex flex-col gap-4"
    >
      <h2 className="font-display font-bold text-base text-white border-b border-white/5 pb-2.5">
        ⚙️ Gestión Operativa
      </h2>

      {message && (
        <div
          className={`text-xs px-3.5 py-2.5 rounded-lg border ${
            message.error
              ? 'bg-[rgba(239,68,68,0.1)] text-rojo border-[rgba(239,68,68,0.25)]'
              : 'bg-[rgba(0,255,179,0.1)] text-neon border-[rgba(0,255,179,0.25)]'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-muted mb-1.5 font-semibold uppercase tracking-wider">
            Estado Operacional
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as EstadoPedido)}
            className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-neon"
          >
            {ESTADOS.map((e) => (
              <option key={e} value={e} className="bg-[#030907]">
                {e}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-muted mb-1.5 font-semibold uppercase tracking-wider">
            Código de Seguimiento
          </label>
          <input
            value={tracking}
            onChange={(e) => setTracking(e.target.value)}
            placeholder="Ej: Starken / Chilexpress"
            className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-neon"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs text-muted mb-1.5 font-semibold uppercase tracking-wider">
            Notas Administrativas Internas
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Detalles sobre despacho, contacto, entrega o incidencias..."
            className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-neon resize-vertical"
          />
        </div>
      </div>

      <div className="flex gap-2.5 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="bg-neon hover:bg-white text-[#020705] font-bold px-6 py-2.5 rounded-lg text-sm transition-all shadow-[0_0_12px_rgba(0,255,179,0.3)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {loading ? 'Guardando...' : 'Guardar Cambios ✦'}
        </button>
        <Link
          href="/admin/pedidos"
          className="border border-white/10 hover:border-white/20 text-muted px-4 py-2.5 rounded-lg text-sm flex items-center hover:text-white transition-colors"
        >
          Volver
        </Link>
      </div>
    </form>
  );
}
