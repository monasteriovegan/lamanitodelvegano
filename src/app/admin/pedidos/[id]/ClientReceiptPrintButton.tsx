'use client';

import { useRouter } from 'next/navigation';
import { brandConfig } from '@/config/brand';

type ClientReceiptPrintButtonProps = {
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

const dateLabel = (value: unknown, fallback = 'Por coordinar') => {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  const date = new Date(`${raw.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' });
};

const itemDetailLines = (item: any): string[] => {
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
      const label = String(selection?.label || selection?.name || '').trim();
      if (!label) return;
      lines.push(`${Number(selection?.quantity || 1)} × ${label}`);
    });
  }

  return lines;
};

const isReviewOnlyItem = (item: any) => {
  const name = String(item?.product_name || item?.nombre || '');
  const price = Number(item?.unit_price || item?.precio || 0);
  return Boolean(item?.custom) && price === 0 && /PRECIO POR REVISAR/i.test(name);
};

export default function ClientReceiptPrintButton({ order }: ClientReceiptPrintButtonProps) {
  const router = useRouter();

  const printReceipt = () => {
    const allItems = Array.isArray(order.items || order.order_items) ? (order.items || order.order_items) : [];
    const visibleItems = allItems.filter((item: any) => !isReviewOnlyItem(item));

    const itemsHtml = visibleItems
      .map((item: any) => {
        const qty = Number(item.quantity || item.qty || 1);
        const unitPrice = Number(item.unit_price || item.precio || 0);
        const subtotal = Number(item.subtotal || unitPrice * qty);
        const details = itemDetailLines(item);
        const detailsHtml = details.length
          ? `<div class="item-detail">${details.map((line) => `<div>${escapeHtml(line)}</div>`).join('')}</div>`
          : '';
        const itemNote = item.notas
          ? `<div class="item-note">${escapeHtml(item.notas)}</div>`
          : '';

        return `
          <tr class="receipt-item">
            <td class="qty">${qty}</td>
            <td class="product">
              <div class="product-name">${escapeHtml(item.product_name || item.nombre || 'Producto')}</div>
              ${detailsHtml}
              ${itemNote}
            </td>
            <td class="money">${money(unitPrice)}</td>
            <td class="money strong">${money(subtotal)}</td>
          </tr>
        `;
      })
      .join('');

    let address: any = order.shipping_address || {};
    if (typeof address === 'string') {
      try {
        address = JSON.parse(address);
      } catch {
        address = { direccion: address };
      }
    }

    const orderNumber = escapeHtml(order.order_number || `MAN-${String(order.id).slice(0, 8)}`);
    const customerName = escapeHtml(order.customer_name || 'Cliente');
    const customerPhone = escapeHtml(order.customer_phone || '—');
    const customerEmail = escapeHtml(order.customer_email || '—');
    const deliveryAddress = escapeHtml(
      [address?.direccion || address?.address_line1, address?.comuna || order.comuna, order.shipping_zone_name]
        .filter(Boolean)
        .join(', ') || 'Retiro / dirección por coordinar',
    );
    const paymentStatus = String(order.payment_status || 'pending').toLowerCase();
    const paymentLabel = paymentStatus === 'paid'
      ? 'PAGADO'
      : paymentStatus === 'pending'
        ? 'PENDIENTE DE PAGO'
        : paymentStatus.toUpperCase();
    const paymentMethod = escapeHtml(order.payment_method || order.metodopago || '—');
    const createdLabel = new Date(order.created_at).toLocaleDateString('es-CL', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
    const productSubtotal = Number(order.subtotal || visibleItems.reduce((sum: number, item: any) => {
      const qty = Number(item.quantity || item.qty || 1);
      const unitPrice = Number(item.unit_price || item.precio || 0);
      return sum + Number(item.subtotal || unitPrice * qty);
    }, 0));

    const printWin = window.open('', '_blank', 'width=900,height=1100');
    if (!printWin) return;

    printWin.document.write(`
      <!DOCTYPE html>
      <html lang="es">
        <head>
          <meta charset="utf-8" />
          <title>Comprobante ${orderNumber}</title>
          <style>
            @page { size: A4; margin: 12mm; }
            * { box-sizing: border-box; }
            body {
              margin: 0;
              background: #fff;
              color: #17211d;
              font-family: Arial, Helvetica, sans-serif;
              font-size: 10.5pt;
              line-height: 1.38;
            }
            .sheet { width: 100%; max-width: 186mm; margin: 0 auto; }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              gap: 10mm;
              padding-bottom: 5mm;
              border-bottom: 2px solid #1b4332;
              page-break-inside: avoid;
            }
            .brand { font-size: 17pt; font-weight: 900; color: #1b4332; }
            .brand-sub { margin-top: 1mm; font-size: 8pt; text-transform: uppercase; letter-spacing: 1.1px; color: #5d6f66; font-weight: 700; }
            .document-title { text-align: right; }
            .document-title .label { font-size: 8pt; font-weight: 800; letter-spacing: 1.2px; color: #5d6f66; }
            .document-title .number { margin-top: 1mm; font-size: 19pt; font-weight: 900; color: #17211d; }
            .document-title .created { margin-top: 1.5mm; font-size: 8.5pt; color: #6b7280; }
            .status-row {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 4mm;
              margin: 5mm 0;
              page-break-inside: avoid;
            }
            .status-card { border: 1px solid #cfd8d3; border-radius: 3mm; padding: 3mm 4mm; }
            .status-label { font-size: 7.5pt; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; font-weight: 800; }
            .status-value { margin-top: 1mm; font-size: 12pt; font-weight: 900; color: #1b4332; }
            .info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 4mm;
              margin-bottom: 5mm;
              page-break-inside: avoid;
            }
            .info-card { border: 1px solid #d8e0dc; border-radius: 3mm; padding: 4mm; }
            .section-label { margin-bottom: 2mm; font-size: 8pt; text-transform: uppercase; letter-spacing: 1px; color: #1b4332; font-weight: 900; }
            .info-line { margin: 1mm 0; font-size: 9.5pt; }
            .items-section { margin-top: 2mm; }
            .items-title { margin-bottom: 2.5mm; font-size: 10pt; font-weight: 900; letter-spacing: .8px; color: #1b4332; }
            table { width: 100%; border-collapse: collapse; }
            th {
              padding: 2.5mm 2mm;
              border-bottom: 1.5px solid #1b4332;
              font-size: 7.5pt;
              text-transform: uppercase;
              letter-spacing: .7px;
              color: #6b7280;
              text-align: left;
            }
            th.money, td.money { text-align: right; }
            th.qty, td.qty { width: 12mm; text-align: center; }
            .receipt-item { page-break-inside: avoid; }
            .receipt-item td { padding: 3.5mm 2mm; border-bottom: 1px solid #e5e9e7; vertical-align: top; }
            .product-name { font-size: 10.5pt; font-weight: 800; }
            .item-detail { margin-top: 1mm; font-size: 8.8pt; color: #59665f; }
            .item-note { margin-top: 1.5mm; font-size: 8.8pt; font-style: italic; color: #8a4d08; }
            .strong { font-weight: 800; }
            .customer-note {
              margin-top: 5mm;
              padding: 4mm;
              border: 1.5px solid #d9a441;
              border-radius: 3mm;
              background: #fffaf0;
              page-break-inside: avoid;
            }
            .customer-note .note-text { white-space: pre-wrap; font-size: 10pt; font-weight: 600; }
            .summary {
              width: 78mm;
              margin: 5mm 0 0 auto;
              padding: 4mm;
              border: 1px solid #d8e0dc;
              border-radius: 3mm;
              page-break-inside: avoid;
            }
            .summary-row { display: flex; justify-content: space-between; gap: 8mm; margin: 1.2mm 0; font-size: 9.5pt; }
            .summary-total { margin-top: 2mm; padding-top: 2.5mm; border-top: 2px solid #1b4332; font-size: 14pt; font-weight: 900; color: #1b4332; }
            .payment-meta { margin-top: 2.5mm; padding-top: 2mm; border-top: 1px solid #e5e9e7; font-size: 8.5pt; color: #5f6d66; }
            .footer { margin-top: 7mm; padding-top: 3mm; border-top: 1px solid #d8e0dc; font-size: 8pt; color: #738078; text-align: center; }
            @media print {
              .header, .status-row, .info-grid, .receipt-item, .customer-note, .summary { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <main class="sheet">
            <header class="header">
              <div>
                <div class="brand">${escapeHtml(brandConfig.printHeader.title)}</div>
                <div class="brand-sub">${escapeHtml(brandConfig.printHeader.subtitle)}</div>
              </div>
              <div class="document-title">
                <div class="label">COMPROBANTE DE PEDIDO</div>
                <div class="number">${orderNumber}</div>
                <div class="created">Emitido: ${escapeHtml(createdLabel)}</div>
              </div>
            </header>

            <section class="status-row">
              <div class="status-card">
                <div class="status-label">Fecha de entrega</div>
                <div class="status-value">${escapeHtml(dateLabel(order.delivery_date))}</div>
              </div>
              <div class="status-card">
                <div class="status-label">Estado del pago</div>
                <div class="status-value">${escapeHtml(paymentLabel)}</div>
              </div>
            </section>

            <section class="info-grid">
              <div class="info-card">
                <div class="section-label">DATOS DEL CLIENTE</div>
                <div class="info-line"><strong>${customerName}</strong></div>
                <div class="info-line">Teléfono: ${customerPhone}</div>
                <div class="info-line">Email: ${customerEmail}</div>
              </div>
              <div class="info-card">
                <div class="section-label">DATOS DE ENTREGA</div>
                <div class="info-line">${deliveryAddress}</div>
                <div class="info-line">Entrega: <strong>${escapeHtml(dateLabel(order.delivery_date))}</strong></div>
              </div>
            </section>

            <section class="items-section">
              <div class="items-title">DETALLE DEL PEDIDO</div>
              <table>
                <thead>
                  <tr>
                    <th class="qty">Cant.</th>
                    <th>Producto / detalle</th>
                    <th class="money">Precio unit.</th>
                    <th class="money">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml || '<tr class="receipt-item"><td colspan="4">Sin productos registrados.</td></tr>'}
                </tbody>
              </table>
            </section>

            ${order.notes ? `
              <section class="customer-note">
                <div class="section-label">NOTA DE TU PEDIDO</div>
                <div class="note-text">${escapeHtml(order.notes)}</div>
              </section>
            ` : ''}

            <section class="summary">
              <div class="section-label">RESUMEN</div>
              <div class="summary-row"><span>SUBTOTAL</span><strong>${money(productSubtotal)}</strong></div>
              ${Number(order.discount_amount || 0) > 0 ? `<div class="summary-row"><span>Descuento</span><strong>−${money(order.discount_amount)}</strong></div>` : ''}
              <div class="summary-row"><span>Envío</span><strong>${money(order.shipping_amount || 0)}</strong></div>
              <div class="summary-row summary-total"><span>TOTAL</span><span>${money(order.total)}</span></div>
              <div class="payment-meta">Método de pago: <strong>${paymentMethod}</strong> · Estado: <strong>${escapeHtml(paymentLabel)}</strong></div>
            </section>

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
    })
      .then((response) => {
        if (response.ok) router.refresh();
      })
      .catch(() => {});
  };

  return (
    <div className="rounded-2xl border border-white/15 bg-white/[0.035] p-5">
      <p className="text-[10px] font-display font-bold uppercase tracking-[3px] text-white/55">Cliente / Administración</p>
      <h3 className="mt-1.5 text-base font-bold text-white">Comprobante claro y profesional</h3>
      <p className="mt-1.5 text-xs leading-relaxed text-white/55">
        Resume productos, precios, despacho, pago y la nota del cliente. No incluye información interna de producción.
      </p>
      <button
        type="button"
        onClick={printReceipt}
        className="mt-4 w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-extrabold text-white transition hover:border-neon/50 hover:bg-white/15"
      >
        🧾 Comprobante / detalle del pedido
      </button>
    </div>
  );
}
