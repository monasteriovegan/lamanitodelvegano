import 'server-only';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { parseFormatos } from './formatos';
import type { CheckoutRequest, ItemCarrito } from '@/types/domain';

export interface ResultadoCalculo {
  ok: boolean;
  error?: string;
  itemsResueltos?: ItemCarrito[];
  subtotal?: number;
  costoEnvio?: number;
  descuentoCupon?: number;
  cuponValido?: { code: string; tipo: string } | null;
  descuentoFidelidad?: number;
  total?: number;
  zonaNombre?: string | null;
}

/**
 * Recalcula TODO el pedido desde cero usando los precios y reglas reales
 * de la base de datos. El frontend solo manda IDs y cantidades — nunca precios.
 * Esto es lo que cierra la vulnerabilidad de manipulación de precios del sitio viejo.
 *
 * Nota: usa la estructura REAL de la BD compartida con el sitio viejo
 * (id de producto es text, no uuid; cupones.minMonto en camelCase).
 */
export async function calcularPedido(req: CheckoutRequest): Promise<ResultadoCalculo> {
  const supabase = createSupabaseServiceClient();

  if (!req.items || req.items.length === 0) {
    return { ok: false, error: 'El carrito está vacío.' };
  }

  const productIds = req.items.map((i) => i.productoId);
  const { data: productos, error: prodErr } = await supabase
    .from('productos')
    .select('*')
    .in('id', productIds)
    .eq('activo', true);

  if (prodErr) return { ok: false, error: 'Error consultando productos.' };
  if (!productos || productos.length === 0) {
    return { ok: false, error: 'Ninguno de los productos del carrito está disponible.' };
  }

  const itemsResueltos: ItemCarrito[] = [];

  for (const reqItem of req.items) {
    const prod = productos.find((p) => p.id === reqItem.productoId);
    if (!prod) {
      return { ok: false, error: `Producto no disponible: ${reqItem.productoId}` };
    }

    if (reqItem.qty <= 0 || !Number.isInteger(reqItem.qty)) {
      return { ok: false, error: 'Cantidad inválida en el carrito.' };
    }

    if (prod.maneja_stock && (prod.stock ?? 0) < reqItem.qty) {
      return { ok: false, error: `Stock insuficiente para "${prod.nombre}". Disponible: ${prod.stock}.` };
    }

    const formatos = parseFormatos(prod.gramaje, prod.precio);
    let precioUnitario = prod.precio;
    if (reqItem.formato) {
      const formatoMatch = formatos.find((f) => f.label === reqItem.formato);
      if (!formatoMatch) {
        return { ok: false, error: `Formato inválido para "${prod.nombre}".` };
      }
      precioUnitario = formatoMatch.precio;
    }

    itemsResueltos.push({
      productoId: prod.id,
      nombre: prod.nombre,
      precio: precioUnitario,
      qty: reqItem.qty,
      emoji: prod.emoji || '🌱',
      formato: reqItem.formato || null,
      variedad: reqItem.variedad || null,
    });
  }

  const subtotal = itemsResueltos.reduce((sum, i) => sum + i.precio * i.qty, 0);

  let costoEnvio = 0;
  let zonaNombre: string | null = null;
  if (req.zonaId) {
    const { data: zona } = await supabase.from('zonas').select('*').eq('id', req.zonaId).maybeSingle();
    if (zona) {
      costoEnvio = zona.precio;
      zonaNombre = zona.nombre;
    }
  }

  let descuentoCupon = 0;
  let cuponValido: { code: string; tipo: string } | null = null;
  if (req.cuponCode) {
    const { data: cupon } = await supabase
      .from('cupones')
      .select('*')
      .eq('id', req.cuponCode.toUpperCase())
      .eq('activo', true)
      .maybeSingle();

    if (cupon && subtotal >= (cupon.minMonto || 0)) {
      if (cupon.tipo === 'fijo') {
        descuentoCupon = Math.min(subtotal, parseInt(cupon.valor, 10));
      } else if (cupon.tipo === 'porcentaje') {
        descuentoCupon = Math.round(subtotal * (parseInt(cupon.valor, 10) / 100));
      } else if (cupon.tipo === 'bogo') {
        descuentoCupon = itemsResueltos
          .filter(
            (item) =>
              item.nombre.toLowerCase().includes(cupon.valor.toLowerCase()) || item.productoId === cupon.valor
          )
          .reduce((sum, item) => sum + Math.floor(item.qty / 2) * item.precio, 0);
      }
      cuponValido = { code: cupon.id, tipo: cupon.tipo };
    }
  }

  const descuentoFidelidad = req.canjearPuntos ? 0 : 0; // se resuelve en checkout con verificación de PIN

  const total = Math.max(0, subtotal + costoEnvio - descuentoCupon - descuentoFidelidad);

  return {
    ok: true,
    itemsResueltos,
    subtotal,
    costoEnvio,
    descuentoCupon,
    cuponValido,
    descuentoFidelidad,
    total,
    zonaNombre,
  };
}
