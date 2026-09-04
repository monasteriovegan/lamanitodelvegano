import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SiteShell } from '@/components/layout/SiteShell';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { PurchaseTracking } from './PurchaseTracking';

export default async function PedidoConfirmacionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) notFound();

  const supabase = createSupabaseServiceClient();
  const { data: pedido, error } = await supabase
    .from('pedidos')
    .select('id,total,estado,payment_status,nombre_cliente,items,tracking_number')
    .eq('id', numericId)
    .maybeSingle();

  if (error || !pedido) notFound();

  const esExito = pedido.estado === 'Pagado' && pedido.payment_status === 'paid';
  const orderId = String(pedido.id);
  const trackingId = String(pedido.tracking_number || pedido.id);

  return (
    <SiteShell>
      {esExito && <PurchaseTracking pedidoId={orderId} total={Number(pedido.total || 0)} items={pedido.items || []} />}
      <main className="pt-[100px] px-4 pb-16 max-w-[480px] mx-auto text-center">
        <span className="text-5xl mb-4 block">{esExito ? '✅' : '⏳'}</span>
        <h1 className="font-display font-bold text-xl text-white mb-2">
          {esExito ? '¡Pedido confirmado!' : 'Pedido en proceso'}
        </h1>
        <p className="text-sm text-muted mb-6">
          {esExito
            ? `Gracias ${pedido.nombre_cliente || 'por tu compra'}, tu pedido fue recibido correctamente.`
            : 'Estamos confirmando el estado de tu pago. Puedes volver a esta página; el pedido se actualizará desde el webhook de pago.'}
        </p>

        <div className="glass rounded-2xl p-5 mb-6 text-left">
          <p className="text-[10px] uppercase text-muted font-bold tracking-wider">ID Pedido</p>
          <p className="font-serif italic font-bold text-lg text-white mb-2">#{orderId.toUpperCase()}</p>
          <p className="text-sm text-neon font-bold">Total: ${Number(pedido.total || 0).toLocaleString('es-CL')}</p>
        </div>

        <div className="flex flex-col gap-2">
          <Link
            href={`/seguimiento?id=${encodeURIComponent(trackingId)}`}
            className="bg-neon text-[#020705] font-bold py-3 rounded-full text-sm hover:bg-white transition-all"
          >
            📍 Rastrear mi pedido
          </Link>
          <Link href="/" className="text-sm text-white/60 underline py-2">
            Volver a la tienda
          </Link>
        </div>
      </main>
    </SiteShell>
  );
}
