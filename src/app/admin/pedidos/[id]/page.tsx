import { notFound } from 'next/navigation';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/supabase/require-role';
import OrderActions from './OrderActions';
import { OrderRepository } from '@/lib/repositories/orders-repository';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminPedidoDetailPage({ params }: PageProps) {
  await requireRole(['admin', 'soporte', 'bodega']);
  const { id } = await params;

  const supabase = createSupabaseServiceClient();
  const order = await new OrderRepository(supabase).getById(id);

  if (!order) notFound();

  const fmtCLP = (val: number) => `$${(val || 0).toLocaleString('es-CL')}`;
  const address = typeof order.shipping_address === 'string' ? JSON.parse(order.shipping_address) : order.shipping_address;

  return (
    <div className="max-w-[1100px] w-full">
      {/* Encabezado Principal */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <p className="text-[11px] tracking-[4px] text-neon uppercase font-display mb-1">
            ✦ Detalle de Pedido Comercial
          </p>
          <h1 className="font-display font-bold text-3xl text-white">
            {order.order_number || `MAN-${order.id.substring(0, 8)}`}
          </h1>
          <p className="text-xs text-muted mt-1 font-mono">
            Registrado el {new Date(order.created_at).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white font-semibold">
            Canal: {order.source || 'web'}
          </span>
          <span className="text-xs font-mono px-3 py-1 rounded-full bg-neon/15 border border-neon/30 text-neon font-semibold">
            Pago: {order.payment_status || 'pending'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna Izquierda: Información de Cliente, Despacho y Lista de Productos */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Ficha del Cliente */}
          <div className="bg-white/[0.02] border border-[rgba(0,255,179,0.12)] rounded-2xl p-5">
            <h2 className="text-xs font-display font-bold text-neon uppercase tracking-widest mb-4">
              👤 Datos del Cliente
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted uppercase font-semibold">Nombre Completo</p>
                <p className="text-white font-medium mt-0.5">{order.customer_name || 'Sin nombre registrado'}</p>
              </div>
              <div>
                <p className="text-xs text-muted uppercase font-semibold">Correo Electrónico</p>
                <p className="text-white font-medium mt-0.5">{order.customer_email || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted uppercase font-semibold">Teléfono</p>
                <p className="text-white font-medium mt-0.5">{order.customer_phone || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted uppercase font-semibold">Dirección & Zona</p>
                <p className="text-white font-medium mt-0.5">
                  {[address?.direccion || address?.address_line1, order.shipping_zone_name].filter(Boolean).join(', ') || 'Retiro en Taller'}
                </p>
              </div>
            </div>
          </div>

          {/* Desglose de Productos */}
          <div className="bg-white/[0.02] border border-[rgba(0,255,179,0.12)] rounded-2xl p-5">
            <h2 className="text-xs font-display font-bold text-neon uppercase tracking-widest mb-4">
              🛍️ Ítems del Pedido
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] text-muted uppercase tracking-wider">
                    <th className="py-2.5">Producto</th>
                    <th className="py-2.5 text-center">Cant.</th>
                    <th className="py-2.5 text-right">Precio Unit.</th>
                    <th className="py-2.5 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {(order.order_items || []).map((item: any, idx: number) => (
                    <tr key={idx}>
                      <td className="py-3 text-white font-medium">{item.product_name}</td>
                      <td className="py-3 text-center text-muted font-mono">{item.quantity}</td>
                      <td className="py-3 text-right text-muted">{fmtCLP(item.unit_price)}</td>
                      <td className="py-3 text-right text-white font-bold">{fmtCLP(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totales */}
            <div className="mt-5 pt-4 border-t border-white/10 flex flex-col gap-2 text-sm">
              <div className="flex justify-between text-muted">
                <span>Subtotal</span>
                <span className="text-white font-medium">{fmtCLP(order.subtotal || order.total)}</span>
              </div>
              {order.discount_amount > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>Descuento</span>
                  <span>−{fmtCLP(order.discount_amount)}</span>
                </div>
              )}
              {order.shipping_amount > 0 && (
                <div className="flex justify-between text-muted">
                  <span>Costo de envío</span>
                  <span className="text-white font-medium">{fmtCLP(order.shipping_amount)}</span>
                </div>
              )}
              <div className="flex justify-between text-white text-base font-bold pt-2 border-t border-white/10">
                <span>TOTAL</span>
                <span className="text-neon font-display">{fmtCLP(order.total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Columna Derecha: Acciones Interactivas y Flujo Operacional */}
        <div>
          <OrderActions order={order} />
        </div>
      </div>
    </div>
  );
}
