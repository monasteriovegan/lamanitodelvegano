import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { DeliveryRepository } from '@/lib/repositories/delivery-repository';
import { requireRole } from '@/lib/supabase/require-role';
import { PageHeader, SectionCard } from '../_ui/AdminUI';
import {
  guardarConfiguracionEntregas,
  bloquearFechaEntrega,
  desbloquearFechaEntrega,
} from './actions';

export const dynamic = 'force-dynamic';

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export default async function AdminEntregasPage() {
  await requireRole(['admin']);

  const supabase = createSupabaseServiceClient();
  const deliveryRepository = new DeliveryRepository(supabase);
  const [settingsRow, blocked] = await Promise.all([
    deliveryRepository.getSettings(),
    deliveryRepository.listBlockedDates(),
  ]);

  const settings = settingsRow || {
    enabled_weekdays: [1, 2, 3, 4, 5, 6],
    min_advance_days: 3,
    max_advance_days: 21,
    cutoff_hour: 12,
    delivery_message: 'Elige tu fecha de entrega preferida ✦',
    max_orders_per_day: 0,
  };

  const blockedList = blocked || [];

  // 4. Generar preview de slots de entrega
  const getPreviewDates = () => {
    const dates: Date[] = [];
    const now = new Date();
    const extra = now.getHours() >= (settings.cutoff_hour || 12) ? 1 : 0;
    
    // Mínimo de anticipación
    const minD = new Date(now);
    minD.setDate(now.getDate() + (settings.min_advance_days || 3) + extra);
    minD.setHours(0, 0, 0, 0);

    // Límite de días hacia adelante
    const maxD = new Date(now);
    maxD.setDate(now.getDate() + Math.min(settings.max_advance_days || 21, 45));

    const blockedSet = new Set(blockedList.map((b) => b.date));
    const cur = new Date(minD);

    while (cur <= maxD && dates.length < 12) {
      const ds = cur.toISOString().split('T')[0];
      const dayOfWeek = cur.getDay();
      
      if (settings.enabled_weekdays.includes(dayOfWeek) && !blockedSet.has(ds)) {
        dates.push(new Date(cur));
      }
      cur.setDate(cur.getDate() + 1);
    }
    return dates;
  };

  const previewDates = getPreviewDates();

  return (
    <div className="max-w-[1000px]">
      <PageHeader
        eyebrow="Logística & Operaciones"
        title="Días de Entrega y Despacho"
      />

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Columna Izquierda (Configuración general de slots) */}
        <div className="flex flex-col gap-6">
          <SectionCard title="⚙️ Configuración de Despacho">
            <form action={guardarConfiguracionEntregas} className="flex flex-col gap-4 mt-2">
              <div>
                <label className="block text-xs text-muted mb-2 font-semibold uppercase tracking-wider">
                  Días de la Semana Activos
                </label>
                <div className="grid grid-cols-7 gap-1">
                  {DAYS.map((day, idx) => {
                    const active = settings.enabled_weekdays.includes(idx);
                    return (
                      <label
                        key={idx}
                        className={`flex flex-col items-center justify-center border rounded-lg py-2.5 text-center cursor-pointer transition-all ${
                          active
                            ? 'bg-neon/15 border-neon text-white font-bold'
                            : 'bg-white/[0.01] border-white/5 text-muted hover:border-white/10'
                        }`}
                      >
                        <input
                          type="checkbox"
                          name={`day_${idx}`}
                          defaultChecked={active}
                          className="hidden"
                        />
                        <span className="text-[10px] uppercase font-semibold">{DS[idx]}</span>
                      </label>
                    );
                  })}
                </div>
                <p className="text-[11px] text-muted mt-2">
                  Días activos actuales: {(settings.enabled_weekdays || []).map((d: number) => DAYS[d]).join(', ') || 'Ninguno'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-muted mb-1.5 font-semibold uppercase tracking-wider">
                    Días de anticipación mínimos
                  </label>
                  <input
                    type="number"
                    name="min_advance_days"
                    min="0"
                    defaultValue={settings.min_advance_days}
                    className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2 text-sm text-white"
                  />
                  <p className="text-[10px] text-muted mt-1">Cálculo de margen previo al despacho.</p>
                </div>

                <div>
                  <label className="block text-xs text-muted mb-1.5 font-semibold uppercase tracking-wider">
                    Días máximos a futuro
                  </label>
                  <input
                    type="number"
                    name="max_advance_days"
                    min="1"
                    defaultValue={settings.max_advance_days}
                    className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-muted mb-1.5 font-semibold uppercase tracking-wider">
                    Hora de Corte (0–23 hs)
                  </label>
                  <input
                    type="number"
                    name="cutoff_hour"
                    min="0"
                    max="23"
                    defaultValue={settings.cutoff_hour}
                    className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2 text-sm text-white"
                  />
                  <p className="text-[10px] text-muted mt-1">Hora límite; posterior a esta, suma +1 día.</p>
                </div>

                <div>
                  <label className="block text-xs text-muted mb-1.5 font-semibold uppercase tracking-wider">
                    Cupo de pedidos por día
                  </label>
                  <input
                    type="number"
                    name="max_orders_per_day"
                    min="0"
                    defaultValue={settings.max_orders_per_day}
                    className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2 text-sm text-white"
                  />
                  <p className="text-[10px] text-muted mt-1">0 = Sin límites.</p>
                </div>
              </div>

              <div>
                <label className="block text-xs text-muted mb-1.5 font-semibold uppercase tracking-wider">
                  Mensaje en Checkout (Calendario)
                </label>
                <input
                  name="delivery_message"
                  defaultValue={settings.delivery_message}
                  className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3.5 py-2 text-sm text-white"
                />
              </div>

              <button
                type="submit"
                className="bg-neon hover:bg-white text-[#020705] font-bold py-3 rounded-xl text-sm transition-all shadow-[0_0_15px_rgba(0,255,179,0.4)] cursor-pointer mt-2"
              >
                Guardar Configuración ✦
              </button>
            </form>
          </SectionCard>
        </div>

        {/* Columna Derecha (Preview y fechas bloqueadas) */}
        <div className="flex flex-col gap-6">
          {/* Vista Previa */}
          <SectionCard title="📅 Vista Previa (Próximos 12 Días Habilitados)">
            <div className="flex flex-wrap gap-2 mt-2">
              {previewDates.map((date, idx) => (
                <div
                  key={idx}
                  className="bg-neon/10 border border-neon/30 px-3 py-2 rounded-xl text-xs text-neon font-medium"
                >
                  <span className="capitalize">{DS[date.getDay()]}</span> {date.getDate()}{' '}
                  <span className="capitalize">{MONTHS[date.getMonth()]}</span>
                </div>
              ))}
              {previewDates.length === 0 && (
                <p className="text-xs text-muted py-2">
                  No hay fechas disponibles según la configuración de días.
                </p>
              )}
            </div>
          </SectionCard>

          {/* Fechas Bloqueadas */}
          <SectionCard title="🛑 Bloquear Fechas Específicas">
            <p className="text-xs text-muted mb-4">
              Bloquea feriados, vacaciones o días especiales en los que la cocina esté cerrada.
            </p>

            <form action={bloquearFechaEntrega} className="flex gap-2.5 mb-4">
              <input
                type="date"
                name="date"
                required
                className="bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2 text-sm text-white flex-1 focus:outline-none"
              />
              <input
                name="reason"
                placeholder="Motivo (ej: Año Nuevo)"
                className="bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2 text-sm text-white flex-2 focus:outline-none"
              />
              <button
                type="submit"
                className="bg-rojo text-white hover:bg-white hover:text-[#020705] font-bold px-4 rounded-lg text-sm transition-all cursor-pointer"
              >
                +
              </button>
            </form>

            <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
              {blockedList.map((b) => (
                <div
                  key={b.id}
                  className="bg-white/[0.01] border border-white/5 rounded-xl p-3 text-xs flex items-center justify-between gap-3"
                >
                  <div>
                    <span className="font-semibold text-white">
                      {new Date(b.date + 'T12:00:00').toLocaleDateString('es-CL', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                    {b.reason && <span className="text-muted ml-2">({b.reason})</span>}
                  </div>
                  <form
                    action={async () => {
                      'use server';
                      await desbloquearFechaEntrega(b.id);
                    }}
                  >
                    <button
                      type="submit"
                      className="text-rojo hover:text-white cursor-pointer font-bold text-sm"
                      title="Desbloquear fecha"
                    >
                      ✕
                    </button>
                  </form>
                </div>
              ))}
              {blockedList.length === 0 && (
                <p className="text-xs text-muted text-center py-4">No hay fechas bloqueadas activas.</p>
              )}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
