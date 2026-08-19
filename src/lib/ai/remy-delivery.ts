import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { businessTodayYmd, formatDeliveryDateLabel, genFechas } from '@/lib/pricing/fechas';

const DATE_INTENT = /fecha|cu[aá]ndo|entrega|despach|env[ií]o|disponibilidad|finaliz|checkout|comprar|hacer.{0,12}pedido|crear.{0,12}pedido/i;
const CHECKOUT_INTENT = /finaliz|checkout|comprar|hacer.{0,12}pedido|crear.{0,12}pedido/i;

function parseAvailability(value: unknown): string[] | null {
  const dates = String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item));
  return dates.length ? dates : null;
}

function ymd(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function loadRemyDeliveryContext(
  db: SupabaseClient,
  input: {
    userText: string;
    businessUnitId: string;
    conversationId?: string | null;
    externalUserId?: string | null;
  },
) {
  if (!DATE_INTENT.test(input.userText)) return '';

  let cart: any = null;
  if (input.conversationId) {
    const result = await db.from('carritos_abandonados')
      .select('items')
      .eq('business_unit_id', input.businessUnitId)
      .eq('conversation_id', input.conversationId)
      .eq('recuperado', false)
      .order('last_activity_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    cart = result.data;
  }
  if (!cart && input.externalUserId) {
    const result = await db.from('carritos_abandonados')
      .select('items')
      .eq('business_unit_id', input.businessUnitId)
      .eq('identificador', input.externalUserId)
      .eq('recuperado', false)
      .order('last_activity_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    cart = result.data;
  }

  const productIds = Array.isArray(cart?.items)
    ? Array.from(new Set(cart.items.map((item: any) => String(item?.productoId || '')).filter(Boolean)))
    : [];
  let products: Array<{ disponibilidad: string[] | null }> = [];
  if (productIds.length) {
    const { data } = await db.from('productos')
      .select('disponibilidad')
      .eq('business_unit_id', input.businessUnitId)
      .in('id', productIds);
    products = (data || []).map((row: any) => ({ disponibilidad: parseAvailability(row.disponibilidad) }));
  }

  const generated = genFechas(products);
  const today = businessTodayYmd();
  const { data: blocked } = await db.from('blocked_delivery_dates')
    .select('date,reason')
    .eq('business_unit_id', input.businessUnitId)
    .gte('date', today)
    .order('date')
    .limit(30);
  const blockedDates = new Set((blocked || []).map((row: any) => String(row.date)));

  const valid = generated
    .filter((item) => item.ok && !blockedDates.has(ymd(item.fecha)))
    .slice(0, 6)
    .map((item) => ymd(item.fecha));
  const hadSpecialRestrictions = products.some((item) => Boolean(item.disponibilidad?.length));

  const { data: settings } = await db.from('delivery_settings')
    .select('min_advance_days,max_advance_days,cutoff_hour,delivery_message,enabled_weekdays')
    .eq('business_unit_id', input.businessUnitId)
    .maybeSingle();

  if (!valid.length && hadSpecialRestrictions) {
    return `FECHAS DE DESPACHO: los productos del carrito tienen fechas especiales registradas, pero no queda una fecha futura válida confirmada. No inventes una fecha; indica que debe confirmarse disponibilidad.${settings?.delivery_message ? ` Mensaje del negocio: ${settings.delivery_message}` : ''}`;
  }

  const readableDates = valid.map((date) => `${formatDeliveryDateLabel(date)}=${date}`).join('; ');
  const parts = [
    `FECHAS DE DESPACHO DISPONIBLES: ${readableDates || 'sin fechas calculadas'}. Muestra al cliente solo la fecha en lenguaje natural; usa YYYY-MM-DD únicamente al llamar checkout_update.`,
    CHECKOUT_INTENT.test(input.userText) ? 'CHECKOUT: revisa primero el estado del checkout y pide solo un dato faltante por turno; cuando toque la fecha, ofrece únicamente fechas disponibles.' : '',
    settings?.delivery_message ? `Mensaje del negocio: ${settings.delivery_message}` : '',
    blocked?.length ? `Fechas bloqueadas próximas: ${(blocked || []).slice(0, 6).map((row: any) => row.date).join(', ')}.` : '',
  ].filter(Boolean);
  return parts.join(' ');
}
