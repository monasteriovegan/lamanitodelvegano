import Link from 'next/link';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/supabase/require-role';
import { Badge, EmptyState } from '../_ui/AdminUI';
import { CustomerRepository } from '@/lib/repositories/customers-repository';

export const dynamic = 'force-dynamic';

const CRM_ESTADOS = [
  { key: 'new', label: 'Nuevo', tono: 'am' as const },
  { key: 'contacted', label: 'Contactado', tono: 'neutro' as const },
  { key: 'interested', label: 'Interesado', tono: 'neutro' as const },
  { key: 'order_started', label: 'Pedido Iniciado', tono: 'neutro' as const },
  { key: 'payment_pending', label: 'Pago Pendiente', tono: 'am' as const },
  { key: 'customer', label: 'Cliente', tono: 'neon' as const },
  { key: 'follow_up', label: 'Seguimiento', tono: 'neutro' as const },
  { key: 'repeat_customer', label: 'Frecuente', tono: 'neon' as const },
  { key: 'inactive', label: 'Inactivo', tono: 'neutro' as const },
  { key: 'lost', label: 'Perdido', tono: 'rojo' as const },
];

const ESTADO_CRM_MAP = CRM_ESTADOS.reduce(
  (acc, x) => ({ ...acc, [x.key]: x }),
  {} as Record<string, (typeof CRM_ESTADOS)[number]>
);

interface PageProps {
  searchParams: Promise<{ buscar?: string; estado?: string }>;
}

export default async function AdminClientesPage({ searchParams }: PageProps) {
  await requireRole(['admin', 'soporte']);
  const { buscar = '', estado = 'Todos' } = await searchParams;

  const supabase = createSupabaseServiceClient();
  const customers = await new CustomerRepository(supabase).list({ crmStatus: estado });

  const buscarLower = buscar.toLowerCase().trim().replace(/^@/, '');
  const clientesFiltrados = customers.filter((c: any) => {
    if (!buscarLower) return true;
    const name = c.full_name || c.nombre || `${c.first_name || ''} ${c.last_name || ''}`;
    const nameMatch = name.toLowerCase().includes(buscarLower);
    const emailMatch = (c.email || '').toLowerCase().includes(buscarLower);
    const phoneMatch = (c.phone || c.whatsapp || '').toLowerCase().includes(buscarLower);
    const instagramMatch = (c.instagram_username || '').toLowerCase().includes(buscarLower)
      || (c.instagram_name || '').toLowerCase().includes(buscarLower);
    const labelMatch = (c.conversation_labels || []).some((label: string) => label.toLowerCase().includes(buscarLower));
    return nameMatch || emailMatch || phoneMatch || instagramMatch || labelMatch;
  });

  return (
    <div className="max-w-[1100px] w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-[11px] tracking-[4px] text-neon uppercase font-display mb-1">
            ✦ Gestión CRM & Trazabilidad
          </p>
          <h1 className="font-display font-bold text-3xl text-white">Clientes</h1>
        </div>
        <Badge tono="neon">{clientesFiltrados.length} clientes registrados</Badge>
      </div>

      <form method="GET" action="/admin/clientes" className="flex flex-wrap gap-2.5 mb-6">
        <input
          name="buscar"
          defaultValue={buscar}
          placeholder="Buscar nombre, teléfono, @Instagram o etiqueta…"
          className="flex-1 min-w-[240px] bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-neon focus:ring-1 focus:ring-neon"
        />

        <select
          name="estado"
          defaultValue={estado}
          className="bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-neon"
        >
          <option value="Todos" className="bg-[#030907]">Todos los estados CRM</option>
          {CRM_ESTADOS.map((e) => (
            <option key={e.key} value={e.key} className="bg-[#030907]">
              {e.label}
            </option>
          ))}
        </select>

        <button
          type="submit"
          className="bg-neon hover:bg-white text-[#020705] px-5 py-2 rounded-lg text-sm font-bold transition-all shadow-[0_0_10px_rgba(0,255,179,0.2)] cursor-pointer"
        >
          Filtrar
        </button>

        {(buscar || estado !== 'Todos') && (
          <Link
            href="/admin/clientes"
            className="border border-white/10 hover:border-white/20 text-muted px-4 py-2 rounded-lg text-sm flex items-center hover:text-white transition-colors"
          >
            Limpiar filtros
          </Link>
        )}
      </form>

      <div className="bg-white/[0.02] border border-[rgba(0,255,179,0.12)] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="border-b border-[rgba(0,255,179,0.12)] text-[11px] uppercase tracking-wider text-neon font-display bg-white/[0.02]">
                <th className="px-5 py-3.5">Cliente</th>
                <th className="px-5 py-3.5">Contacto</th>
                <th className="px-5 py-3.5 text-center">Pedidos</th>
                <th className="px-5 py-3.5 text-right">Total Gastado</th>
                <th className="px-5 py-3.5 text-center">Etapa CRM</th>
                <th className="px-5 py-3.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {clientesFiltrados.map((c: any) => {
                const crmStage = c.stage || c.crm_status || 'new';
                const est = ESTADO_CRM_MAP[crmStage] || { label: crmStage, tono: 'neutro' };
                const fullName = c.full_name || c.nombre || `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Sin nombre';
                const inicial = (fullName[0] || c.email?.[0] || '?').toUpperCase();
                const cleanPhone = (c.phone || c.whatsapp || '').replace(/\D/g, '');
                const labels = Array.isArray(c.conversation_labels) ? c.conversation_labels : [];

                return (
                  <tr key={c.id} className="hover:bg-white/[0.03] transition-colors text-texto">
                    <td className="px-5 py-3.5">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-neon/20 border border-neon/40 flex items-center justify-center font-bold text-neon text-xs font-mono">
                          {inicial}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-white text-sm">{fullName}</p>
                          {c.instagram_username && (
                            <p className="text-[11px] text-fuchsia-300 font-mono">@{c.instagram_username}</p>
                          )}
                          {c.instagram_name && c.instagram_name !== fullName && (
                            <p className="text-[10px] text-white/50">Instagram: {c.instagram_name}</p>
                          )}
                          <p className="text-[10px] text-muted">
                            Creado: {c.created_at ? new Date(c.created_at).toLocaleDateString('es-CL') : '—'}
                          </p>
                          {labels.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {labels.map((label: string) => (
                                <span key={label} className="text-[9px] rounded-full border border-neon/20 bg-neon/10 text-neon px-1.5 py-0.5">
                                  {label}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col gap-0.5 text-xs">
                        {c.email && <span className="text-white/80">{c.email}</span>}
                        {c.phone && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-muted">{c.phone}</span>
                            {cleanPhone && (
                              <a
                                href={`https://wa.me/${cleanPhone}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-neon hover:underline text-[10px] font-bold"
                              >
                                💬 WhatsApp
                              </a>
                            )}
                          </div>
                        )}
                        {c.instagram_username && <span className="text-fuchsia-300">🟣 Instagram · @{c.instagram_username}</span>}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-center font-semibold text-white/80 font-mono">
                      {c.total_orders || 0}
                    </td>
                    <td className="px-5 py-3.5 text-right font-bold text-neon font-display">
                      ${Math.round(c.total_spent || 0).toLocaleString('es-CL')}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <Badge tono={est.tono}>{est.label}</Badge>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/admin/conversaciones?customer=${encodeURIComponent(c.id)}`}
                          className="bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all inline-block"
                        >
                          💬 Conversación
                        </Link>
                        <Link
                          href={`/admin/clientes/${c.id}`}
                          className="bg-white/5 hover:bg-neon hover:text-[#020705] border border-white/10 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white transition-all inline-block"
                        >
                          Ver Ficha →
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {clientesFiltrados.length === 0 && (
          <EmptyState emoji="👥" texto="No se encontraron clientes registrados." />
        )}
      </div>
    </div>
  );
}
