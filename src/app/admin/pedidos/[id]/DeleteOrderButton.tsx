'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type DeleteOrderButtonProps = {
  orderId: string;
  orderNumber: string;
  paymentStatus?: string | null;
  status?: string | null;
};

export default function DeleteOrderButton({
  orderId,
  orderNumber,
  paymentStatus,
  status,
}: DeleteOrderButtonProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedPayment = String(paymentStatus || '').toLowerCase();
  const normalizedStatus = String(status || '').toLowerCase();
  const protectedOrder =
    ['paid', 'partial', 'refunded'].includes(normalizedPayment) ||
    ['shipped', 'delivered', 'pagado', 'despachado', 'completado'].includes(normalizedStatus);

  const deleteOrder = async () => {
    setError(null);

    const firstConfirmation = window.confirm(
      `¿Eliminar el pedido ${orderNumber}?\n\nSolo se pueden eliminar pedidos no pagados y no finalizados. Esta acción devolverá el stock asociado.`,
    );
    if (!firstConfirmation) return;

    const secondConfirmation = window.confirm(
      `Última confirmación: ¿eliminar definitivamente ${orderNumber}?\n\nEl pedido desaparecerá del panel y sus vínculos se limpiarán de forma transaccional.`,
    );
    if (!secondConfirmation) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}`, { method: 'DELETE' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload?.error || 'No se pudo eliminar el pedido.');
        return;
      }

      router.push('/admin/pedidos');
      router.refresh();
    } catch {
      setError('Error de conexión al eliminar el pedido.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/[0.04] p-5">
      <p className="text-[10px] font-display uppercase tracking-[3px] text-red-300">Zona de riesgo</p>
      <p className="mt-2 text-xs leading-relaxed text-white/55">
        Los pedidos pagados, despachados o completados conservan su historial y no pueden eliminarse directamente.
      </p>

      <button
        type="button"
        onClick={deleteOrder}
        disabled={deleting || protectedOrder}
        className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm font-bold text-red-300 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {deleting ? 'Eliminando...' : 'Eliminar pedido'}
      </button>

      {protectedOrder && (
        <p className="mt-2 text-xs text-amber-300/80">
          Este pedido tiene pago o estado final registrado. Usa cancelar/reembolsar para mantener la trazabilidad.
        </p>
      )}

      {error && <p className="mt-2 text-xs font-medium text-red-300">{error}</p>}
    </div>
  );
}
