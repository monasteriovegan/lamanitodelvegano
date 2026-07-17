import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SiteShell } from '@/components/layout/SiteShell';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

export default async function PedidoConfirmacionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { id } = await params;
  const { status } = await searchParams;

  const supabase = createSupabaseServiceClient();
  const { data: pedido } = await supabase
    .from('pedidos')
    .select('id, total, status, cliente')
    .eq('id', id)
    .maybeSingle();

  if (!pedido) notFound();

  const esExito = status === 'success' || pedido.status === 'Pagado';

  return (
    <SiteShell>
      <main className="pt-[100px] px-4 pb-16 max-w-[480px] mx-auto text-center">
        <span className="text-5xl mb-4 block">{esExito ? '✅' : '⏳'}</span>
        <h1 className="font-display font-bold text-xl text-white mb-2">
          {esExito ? '¡Pedido confirmado!' : 'Pedido en proceso'}
        </h1>
        <p className="text-sm text-muted mb-6">
          {esExito
            ? `Gracias ${pedido.cliente?.nombre}, tu pedido fue recibido correctamente.`
            : 'Estamos confirmando el estado de tu pago. Esto puede tomar unos segundos.'}
        </p>

        <div className="glass rounded-2xl p-5 mb-6 text-left">
          <p className="text-[10px] uppercase text-muted font-bold tracking-wider">ID Pedido</p>
          <p className="font-serif italic font-bold text-lg text-white mb-2">#{pedido.id.substring(0, 8).toUpperCase()}</p>
          <p className="text-sm text-neon font-bold">Total: ${pedido.total.toLocaleString('es-CL')}</p>
        </div>

        <div className="flex flex-col gap-2">
          <Link
            href={`/seguimiento?id=${pedido.id.substring(0, 8)}`}
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
