'use client';

import { useEffect } from 'react';
import { trackPurchase } from '@/lib/analytics/client';

type PurchaseItem = {
  sku?: string;
  variantSku?: string;
  variant_sku?: string;
  productoId?: string;
  producto_id?: string;
  nombre?: string;
  name?: string;
  precio?: number;
  qty?: number;
};

export function PurchaseTracking({ pedidoId, total, items }: { pedidoId: string; total: number; items: PurchaseItem[] }) {
  useEffect(() => {
    const clave = `purchase-trackeado-${pedidoId}`;
    if (typeof window === 'undefined' || sessionStorage.getItem(clave)) return;

    trackPurchase(pedidoId, {
      value: total,
      items: items.map((item, index) => ({
        id: item.sku || item.variantSku || item.variant_sku || item.productoId || item.producto_id || `${pedidoId}_${index}`,
        name: item.nombre || item.name || 'Producto',
        price: item.precio,
        quantity: item.qty,
      })),
    });

    sessionStorage.setItem(clave, '1');
  }, [items, pedidoId, total]);

  return null;
}
