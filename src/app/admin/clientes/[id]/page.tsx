import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/supabase/require-role';
import { PageHeader, SectionCard, Badge, EmptyState } from '../../_ui/AdminUI';
import {
  cambiarEstadoCrm,
  crearClienteNota,
  eliminarClienteNota,
  agregarClienteTag,
  quitarClienteTag,
} from '../actions';

export const dynamic = 'force-dynamic';

const CRM_ESTADOS = [
  { key: 'new', label: 'Nuevo 🆕' },
  { key: 'contacted', label: 'Contactado 📞' },
  { key: 'interested', label: 'Interesado 🤔' },
  { key: 'order_started', label: 'Pedido Iniciado 🛒' },
  { key: 'payment_pending', label: 'Pago Pendiente 💳' },
  { key: 'customer', label: 'Cliente 👤' },
  { key: 'follow_up', label: 'Seguimiento 🔁' },
  { key: 'repeat_customer', label: 'Frecuente 🔥' },
  { key: 'inactive', label: 'Inactivo 💤' },
  { key: 'lost', label: 'Perdido ❌' },
];

const CRM_TONO: Record<string, 'neutro' | 'neon' | 'rojo' | 'am'> = {
  new: 'am',
  contacted: 'neutro',
  interested: 'neutro',
  order_started: 'neutro',
  payment_pending: 'am',
  customer: 'neon',
  follow_up: 'neutro',
  repeat_customer: 'neon',
  inactive: 'neutro',
  lost: 'rojo',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminClienteDetailPage({ params }: PageProps) {
  await requireRole(['admin', 'soporte']);
  const { id } = await params;

  const supabase = createSupabaseServiceClient();

  // 1. Obtener cliente
  const { data: c } = await supabase.from('customers').select('*').eq('id', id).maybeSingle();
  if (!c) notFound();

  // 2. Obtener notas
  const { data: notes } = await supabase
    .from('customer_notes')
    .select('*')
    .eq('customer_id', id)
    .order('created_at', { ascending: false });

  // 3. Obtener todas las etiquetas y las asignadas
  const [{ data: allTags }, { data: assignedTagRows }] = await Promise.all([
    supabase.from('customer_tags').select('*'),
    supabase.from('customer_tag_assignments').select('tag_id').eq('customer_id', id),
  ]);

  const assignedTagIds = new Set((assignedTagRows || []).map((t) => t.tag_id));
  const assignedTags = (allTags || []).filter((tag) => assignedTagIds.has(tag.id));
  const unassignedTags = (allTags || []).filter((tag) => !assignedTagIds.has(tag.id));

  // 4. Obtener pedidos
  const { data: orders } = await supabase
    .from('pedidos')
    .select('id, total, status, createdAt, metodoPago')
    .eq('customer_id', id)
    .order('createdAt', { ascending: false });

  // 5. Obtener actividades
  const { data: activities } = await supabase
    .from('crm_activities')
    .select('*')
    .eq('customer_id', id)
    .order('created_at', { ascending: false });

  const ticketPromedio = c.total_orders > 0 ? Math.round(c.total_spent / c.total_orders) : 0;
  const initial = (c.nombre?.[0] || c.email?.[0] || '?').toUpperCase();
  const cleanPhone = c.phone ? c.phone.replace(/\D/g, '') : '';
  const waUrl = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=Hola%20${encodeURIComponent(c.nombre || '')}%20🌱%20te%20escribimos%20de%20La%20Manito%20del%20Vegano`
    : null;

  return (
    <div className="max-w-[1000px]">
      <PageHeader
        eyebrow="Ficha de Cliente CRM"
        title={c.nombre || 'Sin nombre'}
        action={
          <div className="flex items-center gap-3">
            <Link
              href="/admin/clientes"
              className="text-xs border border-white/10 hover:border-white/20 text-muted px-3.5 py-1.5 rounded-lg font-semibold hover:text-white transition-colors"
            >
              ← Volver al listado
            </Link>
            <Badge tono={CRM_TONO[c.crm_status] || 'neutro'}>
              {CRM_ESTADOS.find((e) => e.key === c.crm_status)?.label || c.crm_status}
            </Badge>
          </div>
        }
      />

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Columna Izquierda (Info, Pedidos, Actividades) */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Ficha de Información */}
          <SectionCard title="👤 Ficha de Datos">
            <div className="flex items-start gap-4 flex-col sm:flex-row mt-2">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-v2 to-v4 flex items-center justify-center font-bold text-[#020705] text-2xl shrink-0 shadow-[0_0_15px_rgba(45,106,79,0.3)]">
                {initial}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3.5 text-sm flex-1">
                <div>
                  <p className="text-xs text-muted uppercase tracking-wider font-semibold">Correo Electrónico</p>
                  <p className="text-white font-medium mt-0.5">{c.email || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted uppercase tracking-wider font-semibold">Teléfono</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-white font-medium">{c.phone || '—'}</span>
                    {waUrl && (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 px-2.5 py-0.5 rounded text-[10px] font-bold transition-colors"
                      >
                        💬 WhatsApp
                      </a>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted uppercase tracking-wider font-semibold">Dirección Habitual</p>
                  <p className="text-white font-medium mt-0.5">{c.direccion || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted uppercase tracking-wider font-semibold">Miembro Desde</p>
                  <p className="text-white font-medium mt-0.5">
                    {new Date(c.created_at).toLocaleDateString('es-CL', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            </div>

            {/* Estadisticas CRM */}
            <div className="grid grid-cols-3 gap-3 border-t border-white/5 mt-5 pt-4 text-center">
              <div className="bg-white/[0.01] border border-white/5 rounded-xl p-3">
                <p className="text-[10px] uppercase text-muted tracking-wider">Compras Realizadas</p>
                <p className="text-lg font-bold text-white mt-0.5">{c.total_orders}</p>
              </div>
              <div className="bg-white/[0.01] border border-white/5 rounded-xl p-3">
                <p className="text-[10px] uppercase text-muted tracking-wider">Total Invertido</p>
                <p className="text-lg font-bold text-neon font-display mt-0.5">${Math.round(c.total_spent).toLocaleString('es-CL')}</p>
              </div>
              <div className="bg-white/[0.01] border border-white/5 rounded-xl p-3">
                <p className="text-[10px] uppercase text-muted tracking-wider">Ticket Promedio</p>
                <p className="text-lg font-bold text-gold font-display mt-0.5">${ticketPromedio.toLocaleString('es-CL')}</p>
              </div>
            </div>
          </SectionCard>

          {/* Historial de Compras */}
          <SectionCard title="📦 Historial de Pedidos">
            {!orders || orders.length === 0 ? (
              <EmptyState emoji="🛍️" texto="Este cliente aún no registra pedidos." />
            ) : (
              <div className="flex flex-col gap-2.5 mt-2">
                {orders.map((o) => (
                  <Link
                    key={o.id}
                    href={`/admin/pedidos/${o.id}`}
                    className="flex items-center justify-between gap-3 bg-white/[0.01] hover:bg-white/[0.03] border border-white/5 rounded-xl px-4 py-2.5 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white">
                        #{o.id.substring(0, 8).toUpperCase()}
                      </p>
                      <p className="text-[10px] text-muted">
                        {new Date(o.createdAt).toLocaleDateString('es-CL')} · Pago: {o.metodoPago || '—'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs font-bold text-neon">${Math.round(o.total).toLocaleString('es-CL')}</span>
                      <span className="text-[10px] font-semibold text-muted">{o.status}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Actividades del CRM */}
          <SectionCard title="🕒 Historial de Actividades">
            {!activities || activities.length === 0 ? (
              <EmptyState emoji="📋" texto="No hay registros de actividades en el CRM." />
            ) : (
              <div className="flex flex-col gap-2.5 mt-2 max-h-[300px] overflow-y-auto pr-1">
                {activities.map((act) => (
                  <div
                    key={act.id}
                    className="bg-white/[0.01] border border-white/5 rounded-xl p-3 text-xs flex justify-between gap-3"
                  >
                    <div>
                      <p className="text-white/80 font-medium">{act.description}</p>
                      <p className="text-[10px] text-muted mt-1">
                        Tipo: {act.type} · {new Date(act.created_at).toLocaleString('es-CL')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        {/* Columna Derecha (CRM, Tags, Notas) */}
        <div className="flex flex-col gap-6">
          {/* Cambiar Estado CRM */}
          <SectionCard title="⚙️ Etapa del CRM">
            <form
              action={async (formData) => {
                'use server';
                await cambiarEstadoCrm(id, formData.get('crm_status') as string);
              }}
              className="flex flex-col gap-3 mt-2"
            >
              <select
                name="crm_status"
                defaultValue={c.crm_status}
                className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-neon"
              >
                {CRM_ESTADOS.map((e) => (
                  <option key={e.key} value={e.key} className="bg-[#030907]">
                    {e.label}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="bg-neon hover:bg-white text-[#020705] font-bold py-2 rounded-lg text-xs transition-colors cursor-pointer"
              >
                Cambiar Etapa ✦
              </button>
            </form>
          </SectionCard>

          {/* Gestión de Etiquetas */}
          <SectionCard title="🏷️ Etiquetas">
            <div className="flex flex-wrap gap-1.5 mb-4 mt-2">
              {assignedTags.map((tag) => (
                <div
                  key={tag.id}
                  className="inline-flex items-center gap-1 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full text-xs text-white"
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }} />
                  {tag.name}
                  <form
                    action={async () => {
                      'use server';
                      await quitarClienteTag(id, tag.id);
                    }}
                    className="inline-flex"
                  >
                    <button
                      type="submit"
                      className="text-rojo hover:text-white font-bold ml-1 cursor-pointer"
                      title="Quitar etiqueta"
                    >
                      ×
                    </button>
                  </form>
                </div>
              ))}
              {assignedTags.length === 0 && <p className="text-xs text-muted">Sin etiquetas asignadas.</p>}
            </div>

            {unassignedTags.length > 0 && (
              <form
                action={async (formData) => {
                  'use server';
                  const tagId = formData.get('tag_id') as string;
                  if (tagId) await agregarClienteTag(id, tagId);
                }}
                className="flex gap-2"
              >
                <select
                  name="tag_id"
                  className="flex-1 bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
                >
                  <option value="" className="bg-[#030907]">Asignar etiqueta...</option>
                  {unassignedTags.map((t) => (
                    <option key={t.id} value={t.id} className="bg-[#030907]">
                      {t.name}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="bg-white/5 border border-white/10 hover:bg-neon hover:text-[#020705] text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  +
                </button>
              </form>
            )}
          </SectionCard>

          {/* Notas de Seguimiento */}
          <SectionCard title="📝 Notas de Seguimiento">
            <form
              action={async (formData) => {
                'use server';
                const content = formData.get('content') as string;
                if (content && content.trim()) {
                  await crearClienteNota(id, content);
                }
              }}
              className="flex flex-col gap-2.5 mb-4 mt-2"
            >
              <textarea
                name="content"
                required
                rows={2}
                placeholder="Añadir nota de seguimiento o contacto..."
                className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2 text-xs text-white focus:outline-none resize-none"
              />
              <button
                type="submit"
                className="bg-neon hover:bg-white text-[#020705] font-bold py-2 rounded-lg text-xs transition-colors cursor-pointer"
              >
                Guardar Nota ✦
              </button>
            </form>

            <div className="flex flex-col gap-2.5 max-h-[250px] overflow-y-auto pr-1">
              {notes?.map((n) => (
                <div
                  key={n.id}
                  className="bg-white/[0.01] border border-white/5 rounded-xl p-3 text-xs relative group"
                >
                  <p className="text-white/80 pr-6 whitespace-pre-wrap">{n.content}</p>
                  <p className="text-[10px] text-muted mt-1.5">
                    {new Date(n.created_at).toLocaleString('es-CL')}
                  </p>
                  <form
                    action={async () => {
                      'use server';
                      await eliminarClienteNota(n.id, id);
                    }}
                    className="absolute top-2.5 right-2.5"
                  >
                    <button
                      type="submit"
                      className="text-rojo hover:text-white cursor-pointer opacity-50 group-hover:opacity-100 transition-opacity"
                      title="Eliminar nota"
                    >
                      ✕
                    </button>
                  </form>
                </div>
              ))}
              {(!notes || notes.length === 0) && (
                <p className="text-xs text-muted text-center py-4">No hay notas registradas.</p>
              )}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
