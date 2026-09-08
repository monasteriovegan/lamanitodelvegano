export type DeliveryDateLike = {
  delivery_date?: string | null;
};

const WEEKDAYS_LONG = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'] as const;
const WEEKDAYS_SHORT = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'] as const;
const MONTHS_LONG = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
] as const;
const MONTHS_SHORT = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEPT', 'OCT', 'NOV', 'DIC'] as const;

function parseCalendarDate(value: unknown): { ymd: string; year: number; month: number; day: number; weekday: number } | null {
  const raw = String(value ?? '').trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));

  if (
    utc.getUTCFullYear() !== year
    || utc.getUTCMonth() !== month - 1
    || utc.getUTCDate() !== day
  ) return null;

  return {
    ymd: `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    year,
    month,
    day,
    weekday: utc.getUTCDay(),
  };
}

export function normalizeDeliveryDate(value: unknown): string | null {
  return parseCalendarDate(value)?.ymd ?? null;
}

export function formatDeliveryDateLong(value: unknown, fallback = 'Fecha de entrega pendiente'): string {
  const parsed = parseCalendarDate(value);
  if (!parsed) return fallback;
  return `${WEEKDAYS_LONG[parsed.weekday]} ${parsed.day} de ${MONTHS_LONG[parsed.month - 1]} de ${parsed.year}`;
}

export function formatDeliveryDateShort(value: unknown, fallback = 'SIN FECHA'): string {
  const parsed = parseCalendarDate(value);
  if (!parsed) return fallback;
  return `${WEEKDAYS_SHORT[parsed.weekday]}, ${String(parsed.day).padStart(2, '0')} ${MONTHS_SHORT[parsed.month - 1]}`;
}

export function formatDeliveryDateChip(value: unknown, fallback = 'SIN FECHA'): string {
  const parsed = parseCalendarDate(value);
  if (!parsed) return fallback;
  return `${String(parsed.day).padStart(2, '0')} ${MONTHS_SHORT[parsed.month - 1]}`;
}

export function compareDeliveryDates(a: DeliveryDateLike, b: DeliveryDateLike): number {
  const dateA = normalizeDeliveryDate(a.delivery_date);
  const dateB = normalizeDeliveryDate(b.delivery_date);
  if (dateA && dateB) return dateA.localeCompare(dateB);
  if (dateA) return -1;
  if (dateB) return 1;
  return 0;
}

export function summarizeDeliveryDates(orders: DeliveryDateLike[]): Array<{ date: string | null; count: number }> {
  const counts = new Map<string | null, number>();
  for (const order of orders) {
    const date = normalizeDeliveryDate(order.delivery_date);
    counts.set(date, (counts.get(date) || 0) + 1);
  }

  const dated = [...counts.entries()]
    .filter(([date]) => date !== null)
    .sort(([a], [b]) => String(a).localeCompare(String(b)))
    .map(([date, count]) => ({ date, count }));
  const missing = counts.get(null);
  if (missing) dated.push({ date: null, count: missing });
  return dated;
}
