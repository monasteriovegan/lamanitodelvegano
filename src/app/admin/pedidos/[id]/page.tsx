import { notFound } from 'next/navigation';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/supabase/require-role';
import { PageHeader, SectionCard, Badge, EmptyState } from '../../_ui/AdminUI';
import { OrderGestionForm } from './OrderGestionForm';
import type { EstadoPedido, ItemCarrito } from '@/types/domain';

export const dynamic = 'force-dynamic';

const ESTADO_TONO: Record<EstadoPedido, 'neutro' | 'neon' | 'rojo' | 'am'> = {
  Pendiente: 'am',
  Pagado: 'neon',
  Despachado: 'neon',
  Completado: 'neutro',
  Cancelado: 'rojo',
  WhatsApp: 'neutro',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminPedidoDetailPage({ params }: PageProps) {
  await requireRole(['admin', 'soporte', 'bodega']);
  const { id } = await params;

  const supabase = createSupabaseServiceClient();

  // Cargar pedido
  const { data: o } = await supabase.from('pedidos').select('*').eq('id', id).maybeSingle();
  if (!o) notFound();

  // Cargar historial de cambios de estado
  const { data: history } = await supabase
    .from('order_status_history')
    .select('*')
    .eq('pedido_id', id)
    .order('changed_at', { ascending: false });

  const client = o.cliente || {};
  const items = (o.items || []) as ItemCarrito[];

  // Formatear dirección para desplegar
  const direccionCompleta = [client.direccion, o.zonaEnvio].filter(Boolean).join(', ');

  // Crear enlace de WhatsApp para responderle al cliente directamente
  const telefonoLimpio = client.telefono ? client.telefono.replace(/\D/g, '') : '';
  const waUrl = telefonoLimpio
    ? `https://wa.me/${telefonoLimpio}?text=Hola%20${encodeURIComponent(
        client.nombre || ''
      )}%20🌱%20te%20escribimos%20de%20La%20Manito%20del%20Vegano%20sobre%20tu%20pedido%20%23${id.substring(
        0,
        6
      ).toUpperCase()}`
    : null;

  return (
    <div className="max-w-[1000px]">
      <PageHeader
        eyebrow={`Pedido #${id.substring(0, 8).toUpperCase()}`}
        title="Ficha Detallada"
        action={<Badge tono={ESTADO_TONO[o.status as EstadoPedido] || 'neutro'}>{o.status}</Badge>}
      />

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Columna Izquierda (Fichas del pedido e items) */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Información del Cliente */}
          <SectionCard title="👤 Información del Cliente">
            <div className="grid sm:grid-cols-2 gap-4 text-sm mt-2">
              <div>
                <p className="text-xs text-muted uppercase tracking-wider font-semibold">Nombre Completo</p>
                <p className="text-white font-medium mt-0.5">{client.nombre || '—'}</p>
              </div>

              <div>
                <p className="text-xs text-muted uppercase tracking-wider font-semibold">Dirección & Despacho</p>
                <p className="text-white font-medium mt-0.5">{direccionCompleta || 'Retiro en taller / No especificado'}</p>
              </div>

              <div>
                <p className="text-xs text-muted uppercase tracking-wider font-semibold">Email</p>
                <p className="text-white font-medium mt-0.5">{client.email || '—'}</p>
              </div>

              <div>
                <p className="text-xs text-muted uppercase tracking-wider font-semibold">Teléfono de Contacto</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-white font-medium">{client.telefono || '—'}</span>
                  {waUrl && (
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 px-2 py-0.5 rounded text-[10px] font-bold transition-colors"
                    >
                      💬 WhatsApp
                    </a>
                  )}
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Desglose de Productos */}
          <SectionCard title="🛍️ Productos en el Pedido">
            <div className="overflow-x-auto mt-2">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-[11px] uppercase tracking-wider text-muted font-bold">
                    <th className="py-2.5">Producto</th>
                    <th className="py-2.5 text-center">Formato/Sabor</th>
                    <th className="py-2.5 text-center">Cant.</th>
                    <th className="py-2.5 text-right">Precio Unit.</th>
                    <th className="py-2.5 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx} className="border-b border-white/5 text-texto">
                      <td className="py-3 font-medium text-white">
                        {item.emoji} {item.nombre}
                      </td>
                      <td className="py-3 text-center text-xs text-muted">
                        {[item.formato, item.variedad].filter(Boolean).join(' / ') || '—'}
                      </td>
                      <td className="py-3 text-center font-semibold">{item.qty}</td>
                      <td className="py-3 text-right">${item.precio.toLocaleString('es-CL')}</td>
                      <td className="py-3 text-right font-semibold text-white">
                        ${(item.qty * item.precio).toLocaleString('es-CL')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Resumen Financiero */}
            <div className="mt-5 pt-4 border-t border-white/5 flex flex-col gap-2.5 text-sm">
              <div className="flex justify-between text-muted">
                <span>Subtotal productos</span>
                <span className="font-semibold text-white">
                  ${items.reduce((s, i) => s + i.qty * i.precio, 0).toLocaleString('es-CL')}
                </span>
              </div>

              {o.descuentoFidelidad > 0 && (
                <div className="flex justify-between text-[#52b788]">
                  <span>Puntos Canjeados ({o.puntosCanjeados} pts)</span>
                  <span className="font-semibold">-${o.descuentoFidelidad.toLocaleString('es-CL')}</span>
                </div>
              )}

              {o.costoEnvio > 0 && (
                <div className="flex justify-between text-muted">
                  <span>Costo de envío</span>
                  <span className="font-semibold text-white">${o.costoEnvio.toLocaleString('es-CL')}</span>
                </div>
              )}

              <div className="flex justify-between text-white text-base font-bold pt-1.5 border-t border-white/5">
                <span>Total final</span>
                <span className="text-neon font-display">${o.total.toLocaleString('es-CL')}</span>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* Columna Derecha (Acciones de gestión e historial) */}
        <div className="flex flex-col gap-6">
          {/* Formulario de Gestión */}
          <OrderGestionForm
            orderId={id}
            currentStatus={o.status as EstadoPedido}
            currentTracking={o.tracking_number || ''}
            currentNotes={o.admin_notes || ''}
          />

          {/* Historial de Cambios */}
          <SectionCard title="📜 Historial de Cambios">
            {!history || history.length === 0 ? (
              <EmptyState emoji="📝" texto="No hay registros de cambios de estado." />
            ) : (
              <div className="flex flex-col gap-3 mt-2">
                {history.map((log) => (
                  <div
                    key={log.id}
                    className="bg-white/[0.01] border border-white/5 rounded-xl p-3 text-xs"
                  >
                    <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                      <span className="text-muted">
                        {new Date(log.changed_at).toLocaleString('es-CL')}
                      </span>
                      <span className="bg-white/5 border border-white/5 px-2 py-0.5 rounded text-[10px] font-semibold text-white/80">
                        {log.old_status || 'Inicial'} → {log.new_status}
                      </span>
                    </div>
                    {log.notes && <p className="text-white/70 italic font-medium">{log.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
