import 'server-only';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { BusinessRepository } from '@/lib/repositories/business-repository';
import { parseFormatos } from './formatos';
import type { CheckoutRequest } from '@/types/domain';
import { CatalogRepository } from '@/lib/catalog/catalog-repository';
import { resolveCatalogCheckoutItem, type CatalogCheckoutItemIntent } from '@/lib/catalog/catalog-checkout';
import type { CatalogCartItem } from '@/lib/catalog/catalog-cart';

export type CatalogCheckoutRequest = Omit<CheckoutRequest, 'items'> & {
  items: CatalogCheckoutItemIntent[];
};

export interface ResultadoCalculo {
  ok: boolean;
  error?: string;
  itemsResueltos?: CatalogCartItem[];
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
 *
 * El catálogo se filtra por business_unit_id. Mientras la tienda pública siga
 * siendo La Manito, businessUnitId puede omitirse y se resuelve la unidad canónica.
 */
export async function calcularPedido(req: CatalogCheckoutRequest, businessUnitId?: string | null): Promise<ResultadoCalculo> {
  const supabase = createSupabaseServiceClient();

  if (!req.items || req.items.length === 0) {
    return { ok: false, error: 'El carrito está vacío.' };
  }

  const businessId = businessUnitId || (await new BusinessRepository(supabase).requireDefault()).id;
  const productIds = req.items.map((i) => i.productoId);
  const { data: productos, error: prodErr } = await supabase
    .from('productos')
    .select('*')
    .eq('business_unit_id', businessId)
    .in('id', productIds)
    .eq('activo', true);

  if (prodErr) return { ok: false, error: 'Error consultando productos.' };
  if (!productos || productos.length === 0) {
    return { ok: false, error: 'Ninguno de los productos del carrito está disponible.' };
  }

  const itemsResueltos: CatalogCartItem[] = [];
  const catalogProducts = await new CatalogRepository(supabase).listActive(businessId);
  const catalogById = new Map(catalogProducts.map((product) => [product.id, product]));

  for (const reqItem of req.items) {
    const prod = productos.find((p) => p.id === reqItem.productoId);
    if (!prod) {
      return { ok: false, error: `Producto no disponible: ${reqItem.productoId}` };
    }

    if (reqItem.variantId) {
      const catalogProduct = catalogById.get(reqItem.productoId);
      if (!catalogProduct) return { ok: false, error: `Producto no disponible: ${reqItem.productoId}` };
      const resolved = resolveCatalogCheckoutItem(catalogProduct, reqItem);
      if (!resolved.ok) return { ok: false, error: `Selección inválida para "${prod.nombre}": ${resolved.error}.` };
      itemsResueltos.push(resolved.item);
      continue;
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
      notas: reqItem.notas || null,
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
