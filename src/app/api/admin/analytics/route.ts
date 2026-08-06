import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { getCurrentAdminUser } from '@/lib/supabase/server-auth';

const EVENT_LABELS: Record<string, string> = {
  pageview: 'Visitas a páginas',
  click_pedir_whatsapp: 'Clic en WhatsApp / Pedir',
  abrir_catalogo: 'Apertura de catálogo',
  consultar_producto_whatsapp: 'Consulta de producto por WhatsApp',
};

export async function GET() {
  const admin = await getCurrentAdminUser();
  if (!admin || !['admin'].includes(admin.rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const db = createSupabaseServiceClient();
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const { data, error } = await db
    .from('analytics_events')
    .select('event_name, event_params, page_path, created_at')
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const events = data || [];

  // Totals by event type
  const totals: Record<string, number> = {};
  events.forEach(e => {
    totals[e.event_name] = (totals[e.event_name] || 0) + 1;
  });

  // Daily series (last 7 days)
  const days: { label: string; date: string; counts: Record<string, number> }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    days.push({
      label: d.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric' }),
      date: dateStr,
      counts: {},
    });
  }
  events.forEach(e => {
    const dateStr = e.created_at.split('T')[0];
    const day = days.find(d => d.date === dateStr);
    if (day) day.counts[e.event_name] = (day.counts[e.event_name] || 0) + 1;
  });

  // Raw recent events list
  const recent = events.slice(0, 20);

  return NextResponse.json({
    totals,
    labels: EVENT_LABELS,
    days,
    recent,
    total_events: events.length,
  });
}
