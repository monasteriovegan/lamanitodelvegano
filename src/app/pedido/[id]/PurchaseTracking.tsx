'use client';

import { useEffect } from 'react';

export function PurchaseTracking({ pedidoId, total }: { pedidoId: string; total: number }) {
  useEffect(() => {
    const clave = `purchase-trackeado-${pedidoId}`;
    if (typeof window === 'undefined' || sessionStorage.getItem(clave)) return;

    if (window.fbq) {
      window.fbq('track', 'Purchase', { value: total, currency: 'CLP', content_ids: [pedidoId] });
    }
    if (window.gtag) {
      window.gtag('event', 'purchase', { transaction_id: pedidoId, value: total, currency: 'CLP' });
    }

    sessionStorage.setItem(clave, '1');
  }, [pedidoId, total]);

  return null;
}
