'use client';

import { brandConfig } from '@/config/brand';

type KitchenPrintButtonProps = {
  order: any;
};

const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const money = (value: unknown) => `$${Number(value || 0).toLocaleString('es-CL')}`;

const dateLabel = (value: unknown) => {
  const raw = String(value || '').trim();
  if (!raw) return 'SIN FECHA';
  const date = new Date(`${raw.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString('es-CL', { weekday: 'short', day: '2-digit', month: 'short' }).toUpperCase();
};

function detailLines(item: any): string[] {
  const lines: string[] = [];
  if (item.formato) lines.push(`Formato: ${String(item.formato)}`);

  if (item.variedad) {
    String(item.variedad)
      .split(/[,;]+/)
      .map((value) => value.trim())
      .filter(Boolean)
      .forEach((value) => lines.push(value));
  } else if (Array.isArray(item.selections)) {
    item.selections.forEach((selection: any) => {
      const qty = Number(selection?.quantity || 1);
      const label = String(selection?.label || selection?.name || '').trim();
      if (label) lines.push(`${qty} × ${label}`);
    });
  }

  return lines;
}

export default function KitchenPrintButton({ order }: KitchenPrintButtonProps) {
  const printKitchenOrder = () => {
    const allItems = Array.isArray(order.items || order.order_items) ? (order.items || order.order_items) : [];
    const reviewItems = allItems.filter((item: any) =>
      Boolean(item.custom) && Number(item.unit_price || item.precio || 0) === 0 && /PRECIO POR REVISAR/i.test(String(item.nombre || item.product_name || '')),
    );
    const productionItems = allItems.filter((item: any) => !reviewItems.includes(item));

    const itemsHtml = productionItems
      .map((item: any) => {
        const qty = Number(item.quantity || item.qty || 1);
        const name = escapeHtml(item.product_name || item.nombre || 'Producto');
        const lines = detailLines(item);
        const details = lines.length
          ? `<ul class="production-detail">${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>`
          : '';
        const itemNotes = item.notas
          ? `<div class="item-note"><strong>OBS:</strong> ${escapeHtml(item.notas)}</div>`
          : '';

        return `
          <article class="production-item">
            <div class="qty-badge">${qty}×</div>
            <div class="production-copy">
              <div class="product-name">${name}</div>
              ${details}
              ${itemNotes}
            </div>
          </article>
        `;
      })
      .join('');

    const reviewHtml = reviewItems.length
      ? `
        <section class="review-warning">
          <div class="section-label">DATOS POR REVISAR · NO PRODUCIR COMO LÍNEA ADICIONAL</div>
          ${reviewItems.map((item: any) => `<div>${Number(item.qty || item.quantity || 1)}× ${escapeHtml(String(item.nombre || '').replace(/\s*\[PRECIO POR REVISAR\]\s*/i, ''))}</div>`).join('')}
        </section>
      `
      : '';

    let address: any = order.shipping_address || {};
    if (typeof address === 'string') {
      try {
        address = JSON.parse(address);
      } catch {
        address = { direccion: address };
      }
    }

    const orderNumber = escapeHtml(order.order_number || `MAN-${String(order.id).slice(0, 8)}`);
    const customerName = escapeHtml(order.customer_name || 'Sin nombre');
    const phone = escapeHtml(order.customer_phone || '—');
    const deliveryAddress = escapeHtml(
      [address?.direccion || address?.address_line1, address?.comuna || order.comuna, order.shipping_zone_name]
        .filter(Boolean)
        .join(', ') || 'Retiro / dirección no registrada',
    );
    const paymentStatus = String(order.payment_status || 'pending').toLowerCase();
    const paymentLabel = paymentStatus === 'paid' ? 'PAGADO' : paymentStatus === 'pending' ? 'PAGO PENDIENTE' : paymentStatus.toUpperCase();
    const paymentMethod = escapeHtml(order.payment_method || order.metodopago || '—');

    const printWin = window.open('', '_blank', 'width=900,height=1100');
    if (!printWin) return;

    printWin.document.write(`
      <!DOCTYPE html>
      <html lang="es">
        <head>
          <meta charset="utf-8" />
          <title>Orden de cocina ${orderNumber}</title>
          <style>
            @page { size: A4; margin: 10mm; }
            * { box-sizing: border-box; }
            body {
              margin: 0;
              color: #111827;
              background: #fff;
              font-family: Arial, Helvetica, sans-serif;
              font-size: 11pt;
              line-height: 1.35;
            }
            .sheet { width: 100%; max-width: 190mm; margin: 0 auto; }
            .header {
              display: flex;
              justify-content: space-between;
              gap: 12mm;
              align-items: flex-start;
              border-bottom: 2.5px solid #111827;
              padding-bottom: 4mm;
              margin-bottom: 4mm;
              page-break-inside: avoid;
            }
            .brand { font-size: 15pt; font-weight: 800; letter-spacing: .4px; }
            .brand-sub { margin-top: 1mm; font-size: 8pt; font-weight: 700; letter-spacing: 1.2px; color: #4b5563; text-transform: uppercase; }
            .order-title { text-align: right; }
            .order-title .eyebrow { font-size: 8pt; font-weight: 800; letter-spacing: 1.4px; color: #4b5563; }
            .order-title .number { margin-top: 1mm; font-size: 20pt; line-height: 1; font-weight: 900; }
            .priority-strip {
              display: grid;
              grid-template-columns: 1.35fr .75fr .75fr;
              gap: 3mm;
              margin-bottom: 5mm;
              page-break-inside: avoid;
            }
            .priority-card { border: 1.5px solid #111827; border-radius: 3mm; padding: 3mm 4mm; }
            .priority-label { font-size: 7.5pt; font-weight: 800; letter-spacing: 1px; color: #4b5563; text-transform: uppercase; }
            .priority-value { margin-top: 1mm; font-size: 14pt; font-weight: 900; }
            .section { margin-top: 5mm; }
            .section-title {
              border-bottom: 1.5px solid #111827;
              padding-bottom: 1.5mm;
              margin-bottom: 3mm;
              font-size: 11pt;
              font-weight: 900;
              letter-spacing: .9px;
            }
            .production-item {
              display: grid;
              grid-template-columns: 20mm 1fr;
              gap: 4mm;
              padding: 4mm 0;
              border-bottom: 1px solid #d1d5db;
              page-break-inside: avoid;
            }
            .production-item:first-of-type { padding-top: 1mm; }
            .qty-badge {
              align-self: start;
              border: 2px solid #111827;
              border-radius: 3mm;
              padding: 2mm 1mm;
              text-align: center;
              font-size: 20pt;
              line-height: 1;
              font-weight: 900;
            }
            .product-name { font-size: 14pt; font-weight: 900; line-height: 1.15; }
            .production-detail { margin: 2mm 0 0; padding-left: 5mm; font-size: 10.5pt; }
            .production-detail li { margin: .8mm 0; }
            .item-note { margin-top: 2mm; padding: 2mm 3mm; border-left: 3px solid #b45309; background: #fffbeb; font-size: 10pt; }
            .customer-note, .admin-note, .review-warning {
              margin-top: 4mm;
              border: 2px solid #111827;
              border-radius: 3mm;
              padding: 3.5mm 4mm;
              page-break-inside: avoid;
            }
            .customer-note { border-width: 2.5px; background: #fff7ed; }
            .admin-note { border-style: dashed; background: #f9fafb; }
            .review-warning { border-color: #b45309; background: #fffbeb; font-size: 9.5pt; }
            .section-label { margin-bottom: 1.5mm; font-size: 8pt; font-weight: 900; letter-spacing: 1.1px; text-transform: uppercase; }
            .note-text { font-size: 11.5pt; font-weight: 700; white-space: pre-wrap; }
            .info-grid {
              display: grid;
              grid-template-columns: 1.4fr .8fr;
              gap: 4mm;
              margin-top: 5mm;
              page-break-inside: avoid;
            }
            .info-card { border: 1px solid #d1d5db; border-radius: 3mm; padding: 3.5mm 4mm; }
            .info-title { margin-bottom: 2mm; font-size: 8pt; font-weight: 900; letter-spacing: 1.1px; color: #4b5563; }
            .info-row { margin: 1mm 0; font-size: 9.5pt; }
            .totals { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
            .totals td { padding: 1mm 0; }
            .totals td:last-child { text-align: right; font-weight: 700; }
            .totals .grand td { border-top: 1.5px solid #111827; padding-top: 2mm; font-size: 11pt; font-weight: 900; }
            .footer { margin-top: 5mm; padding-top: 2mm; border-top: 1px solid #d1d5db; font-size: 7.5pt; color: #6b7280; text-align: center; }
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .production-item, .customer-note, .admin-note, .info-grid, .priority-strip, .header { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <main class="sheet">
            <header class="header">
              <div>
                <div class="brand">${escapeHtml(brandConfig.printHeader.title)}</div>
                <div class="brand-sub">${escapeHtml(brandConfig.printHeader.subtitle)} · ORDEN DE PRODUCCIÓN</div>
              </div>
              <div class="order-title">
                <div class="eyebrow">PEDIDO</div>
                <div class="number">${orderNumber}</div>
              </div>
            </header>

            <section class="priority-strip">
              <div class="priority-card">
                <div class="priority-label">FECHA DE ENTREGA</div>
                <div class="priority-value">${escapeHtml(dateLabel(order.delivery_date))}</div>
              </div>
              <div class="priority-card">
                <div class="priority-label">ESTADO PAGO</div>
                <div class="priority-value">${escapeHtml(paymentLabel)}</div>
              </div>
              <div class="priority-card">
                <div class="priority-label">CANAL</div>
                <div class="priority-value">${escapeHtml(String(order.source || order.source_channel || 'web').toUpperCase())}</div>
              </div>
            </section>

            <section class="section">
              <div class="section-title">QUÉ HAY QUE PREPARAR</div>
              ${itemsHtml || '<div>Sin ítems registrados.</div>'}
            </section>

            ${order.notes ? `
              <section class="customer-note">
                <div class="section-label">⚠ NOTA DEL CLIENTE</div>
                <div class="note-text">${escapeHtml(order.notes)}</div>
              </section>
            ` : ''}

            ${reviewHtml}

            <section class="info-grid">
              <div class="info-card">
                <div class="info-title">DATOS DE ENTREGA</div>
                <div class="info-row"><strong>Cliente:</strong> ${customerName}</div>
                <div class="info-row"><strong>Teléfono:</strong> ${phone}</div>
                <div class="info-row"><strong>Dirección:</strong> ${deliveryAddress}</div>
                <div class="info-row"><strong>Entrega:</strong> ${escapeHtml(dateLabel(order.delivery_date))}</div>
              </div>
              <div class="info-card">
                <div class="info-title">PAGO Y TOTALES</div>
                <table class="totals">
                  <tr><td>Productos</td><td>${money(order.subtotal || Number(order.total || 0) - Number(order.shipping_amount || 0))}</td></tr>
                  ${Number(order.shipping_amount || 0) > 0 ? `<tr><td>Envío</td><td>${money(order.shipping_amount)}</td></tr>` : ''}
                  ${Number(order.discount_amount || 0) > 0 ? `<tr><td>Descuento</td><td>−${money(order.discount_amount)}</td></tr>` : ''}
                  <tr><td>Método</td><td>${paymentMethod}</td></tr>
                  <tr class="grand"><td>TOTAL</td><td>${money(order.total)}</td></tr>
                </table>
              </div>
            </section>

            ${order.admin_notes ? `
              <section class="admin-note">
                <div class="section-label">NOTA INTERNA · EQUIPO</div>
                <div class="note-text">${escapeHtml(order.admin_notes)}</div>
              </section>
            ` : ''}

            <footer class="footer">${escapeHtml(brandConfig.printHeader.footer)}</footer>
          </main>
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `);
    printWin.document.close();

    void fetch(`/api/admin/orders/${order.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ print_action: 'mark_printed' }),
    }).catch(() => {});
  };

  return (
    <div className="rounded-2xl border border-neon/30 bg-neon/[0.06] p-5 shadow-[0_0_24px_rgba(0,255,179,0.06)]">
      <p className="text-[10px] font-display font-bold uppercase tracking-[3px] text-neon">Producción / Cocina</p>
      <h3 className="mt-1.5 text-base font-bold text-white">Orden de producción clara y lista para A4</h3>
      <p className="mt-1.5 text-xs leading-relaxed text-white/55">
        Prioriza cantidades, composición, notas del cliente y fecha de entrega. Pago y datos administrativos quedan en segundo plano.
      </p>
      <button
        type="button"
        onClick={printKitchenOrder}
        className="mt-4 w-full rounded-xl bg-neon px-4 py-3 text-sm font-extrabold text-[#020705] transition hover:bg-white"
      >
        🖨️ Imprimir orden de cocina
      </button>
    </div>
  );
}
