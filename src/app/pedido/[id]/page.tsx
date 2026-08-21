import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SiteShell } from '@/components/layout/SiteShell';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { processPaidPurchaseConversion } from '@/lib/analytics/server-conversions';
import { PurchaseTracking } from './PurchaseTracking';

export default async function PedidoConfirmacionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string; tracking?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;

  const supabase = createSupabaseServiceClient();
  const { data: pedido } = await supabase
    .from('pedidos')
    .select('id,total,estado,payment_status,nombre_cliente,tracking_number')
    .eq('id', id)
    .maybeSingle();

  if (!pedido) notFound();

  // El estado de pago en BD es la fuente de verdad; un ?status=success no basta
  // para presentar el pedido como pagado.
  const esExito = pedido.payment_status === 'paid'
    || ['Pagado', 'Procesando', 'Despachado', 'Completado'].includes(String(pedido.estado || ''));
  const suppliedTracking = String(query.tracking || '').trim().toUpperCase();
  const trackingAuthorized = Boolean(
    pedido.tracking_number
    && suppliedTracking
    && suppliedTracking === String(pedido.tracking_number).toUpperCase(),
  );

  // Recuperación idempotente: si el webhook financiero ya dejó el pedido pagado
  // pero la entrega de analytics quedó pendiente, el enlace privado de confirmación
  // vuelve a intentarla. Nunca se ejecuta desde un ID público sin el tracking privado.
  if (esExito && trackingAuthorized) {
    try {
      await processPaidPurchaseConversion(supabase, Number(pedido.id));
    } catch (conversionError) {
      console.error('purchase_confirmation_conversion_failed', {
        pedidoId: pedido.id,
        reason: conversionError instanceof Error ? conversionError.message : 'unknown',
      });
    }
  }

  return (
    <SiteShell>
      {esExito && trackingAuthorized && <PurchaseTracking pedidoId={String(pedido.id)} total={Number(pedido.total || 0)} />}
      <main className="pt-[100px] px-4 pb-16 max-w-[480px] mx-auto text-center">
        <span className="text-5xl mb-4 block">{esExito ? '✅' : '⏳'}</span>
        <h1 className="font-display font-bold text-xl text-white mb-2">
          {esExito ? '¡Pedido confirmado!' : 'Pedido en proceso'}
        </h1>
        <p className="text-sm text-muted mb-6">
          {esExito
            ? trackingAuthorized && pedido.nombre_cliente
              ? `Gracias ${pedido.nombre_cliente}, tu pedido fue recibido correctamente.`
              : 'Tu pedido fue recibido correctamente.'
            : 'Estamos confirmando el estado de tu pago. Esto puede tomar unos segundos.'}
        </p>

        <div className="glass rounded-2xl p-5 mb-6 text-left">
          <p className="text-[10px] uppercase text-muted font-bold tracking-wider">Pedido</p>
          <p className="font-serif italic font-bold text-lg text-white mb-3">#{pedido.id}</p>

          {trackingAuthorized ? (
            <>
              <p className="text-[10px] uppercase text-muted font-bold tracking-wider">Código de seguimiento</p>
              <p className="font-mono font-bold text-lg text-neon mb-3">{pedido.tracking_number}</p>
              <p className="text-sm text-neon font-bold">Total: ${Number(pedido.total || 0).toLocaleString('es-CL')}</p>
            </>
          ) : (
            <p className="text-xs text-muted leading-relaxed">
              Por seguridad, el detalle y código de seguimiento sólo se muestran desde el enlace privado asociado al pedido.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {trackingAuthorized && pedido.tracking_number ? (
            <Link
              href={`/seguimiento?tracking=${encodeURIComponent(pedido.tracking_number)}`}
              className="bg-neon text-[#020705] font-bold py-3 rounded-full text-sm hover:bg-white transition-all"
            >
              📍 Rastrear mi pedido
            </Link>
          ) : (
            <Link
              href="/seguimiento"
              className="bg-neon text-[#020705] font-bold py-3 rounded-full text-sm hover:bg-white transition-all"
            >
              📍 Ingresar código de seguimiento
            </Link>
          )}
          <Link href="/" className="text-sm text-white/60 underline py-2">
            Volver a la tienda
          </Link>
        </div>
      </main>
    </SiteShell>
  );
}
