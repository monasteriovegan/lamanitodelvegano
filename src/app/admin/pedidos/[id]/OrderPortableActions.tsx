'use client';

import { useState } from 'react';

type OrderPortableActionsProps = {
  order: any;
};

function money(value: unknown) {
  return `$${Number(value || 0).toLocaleString('es-CL')}`;
}

function orderNumber(order: any) {
  return String(order.order_number || `MAN-${String(order.id || '').slice(0, 8)}`);
}

function deliveryLabel(value: unknown) {
  const raw = String(value || '').trim();
  if (!raw) return 'Fecha de entrega pendiente';
  const parsed = new Date(`${raw.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleDateString('es-CL', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function addressLabel(order: any) {
  let address: any = order.shipping_address || {};
  if (typeof address === 'string') {
    try {
      address = JSON.parse(address);
    } catch {
      address = { direccion: address };
    }
  }
  return [
    address?.direccion || address?.address_line1,
    address?.comuna || order.comuna,
    order.shipping_zone_name,
  ].filter(Boolean).join(', ') || 'Retiro / dirección no registrada';
}

function itemLines(item: any) {
  const qty = Number(item.quantity || item.qty || 1);
  const name = String(item.product_name || item.nombre || 'Producto');
  const lines = [`${qty}× ${name}`];
  if (item.formato) lines.push(`   Formato: ${String(item.formato)}`);
  if (item.variedad) {
    lines.push(`   Composición: ${String(item.variedad)}`);
  } else if (Array.isArray(item.selections) && item.selections.length) {
    const selections = item.selections
      .map((selection: any) => `${Number(selection?.quantity || 1)}× ${String(selection?.label || selection?.name || '').trim()}`)
      .filter((value: string) => !value.endsWith('× '));
    if (selections.length) lines.push(`   Composición: ${selections.join(', ')}`);
  }
  if (item.notas) lines.push(`   OBS: ${String(item.notas)}`);
  return lines;
}

export function buildPortableOrderText(order: any) {
  const items = Array.isArray(order.items || order.order_items) ? (order.items || order.order_items) : [];
  const paymentStatus = String(order.payment_status || 'pending').toLowerCase() === 'paid' ? 'PAGADO' : String(order.payment_status || 'PENDIENTE').toUpperCase();
  const method = String(order.payment_method || order.metodopago || 'Sin registrar');
  const source = String(order.source || order.source_channel || 'web').toUpperCase();
  const itemText = items.flatMap((item: any) => [...itemLines(item), '']).join('\n').trim();

  return [
    'LA MANITO DEL VEGANO · ORDEN DE PRODUCCIÓN',
    `PEDIDO ${orderNumber(order)}`,
    '----------------------------------------',
    `Entrega: ${deliveryLabel(order.delivery_date)}`,
    `Canal: ${source}`,
    `Pago: ${paymentStatus} · ${method}`,
    '',
    'CLIENTE',
    `Nombre: ${String(order.customer_name || 'Sin nombre')}`,
    `Teléfono: ${String(order.customer_phone || '—')}`,
    `Dirección: ${addressLabel(order)}`,
    '',
    'QUÉ PREPARAR',
    itemText || 'Sin ítems registrados.',
    order.notes ? `\nNOTA CLIENTE\n${String(order.notes)}` : '',
    order.admin_notes ? `\nNOTA INTERNA · EQUIPO\n${String(order.admin_notes)}` : '',
    '',
    `Productos: ${money(order.subtotal || Number(order.total || 0) - Number(order.shipping_amount || 0))}`,
    Number(order.shipping_amount || 0) > 0 ? `Envío: ${money(order.shipping_amount)}` : '',
    Number(order.discount_amount || 0) > 0 ? `Descuento: -${money(order.discount_amount)}` : '',
    `TOTAL: ${money(order.total)}`,
    '',
    'Documento de respaldo para uso interno. No depende de la impresora ni publica datos en internet.',
  ].filter((line) => line !== '').join('\n');
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function buildPortableOrderHtml(order: any) {
  const text = buildPortableOrderText(order);
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Pedido ${escapeHtml(orderNumber(order))}</title>
<style>
  @page { size: A4; margin: 12mm; }
  body { margin: 0; padding: 24px; font-family: Arial, Helvetica, sans-serif; background: #fff; color: #111827; }
  main { max-width: 760px; margin: 0 auto; }
  h1 { font-size: 20px; margin: 0 0 16px; }
  pre { white-space: pre-wrap; overflow-wrap: anywhere; font: 14px/1.55 Arial, Helvetica, sans-serif; border: 1px solid #d1d5db; border-radius: 12px; padding: 18px; }
  .hint { margin-top: 14px; color: #6b7280; font-size: 12px; }
  @media print { body { padding: 0; } pre { border: 0; padding: 0; } .hint { display: none; } }
</style>
</head>
<body>
<main>
  <h1>Pedido ${escapeHtml(orderNumber(order))}</h1>
  <pre>${escapeHtml(text)}</pre>
  <p class="hint">Puedes imprimir este archivo desde cualquier navegador o guardarlo nuevamente como PDF.</p>
</main>
</body>
</html>`;
}

export default function OrderPortableActions({ order }: OrderPortableActionsProps) {
  const [message, setMessage] = useState<string | null>(null);

  const flash = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(null), 3500);
  };

  const downloadOrder = () => {
    const html = buildPortableOrderHtml(order);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `pedido-${orderNumber(order).replace(/[^a-zA-Z0-9_-]+/g, '-')}.html`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    flash('Pedido descargado. Puedes abrirlo e imprimirlo desde cualquier equipo.');
  };

  const shareOrder = async () => {
    const text = buildPortableOrderText(order);
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({
          title: `Pedido ${orderNumber(order)}`,
          text,
        });
        flash('Pedido enviado desde el menú de compartir.');
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        flash('Pedido copiado al portapapeles para pegarlo en WhatsApp, correo u otra app.');
        return;
      }

      downloadOrder();
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      try {
        await navigator.clipboard?.writeText(text);
        flash('No se pudo abrir Compartir; el pedido quedó copiado al portapapeles.');
      } catch {
        downloadOrder();
      }
    }
  };

  return (
    <div className="rounded-2xl border border-sky-400/25 bg-sky-400/[0.06] p-5">
      <p className="text-[10px] font-display font-bold uppercase tracking-[3px] text-sky-200">Respaldo sin impresora</p>
      <h3 className="mt-1.5 text-base font-bold text-white">Descargar o enviar este pedido</h3>
      <p className="mt-1.5 text-xs leading-relaxed text-white/55">
        Crea una copia local del pedido o abre el menú de compartir del teléfono. No sube la información del cliente a una URL pública.
      </p>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={downloadOrder}
          className="rounded-xl border border-white/15 bg-white/8 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/15"
        >
          ⬇ Descargar pedido
        </button>
        <button
          type="button"
          onClick={() => void shareOrder()}
          className="rounded-xl bg-sky-300 px-4 py-3 text-sm font-extrabold text-slate-950 transition hover:bg-white"
        >
          ↗ Compartir pedido
        </button>
      </div>

      {message && (
        <p className="mt-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-[11px] text-white/75">
          {message}
        </p>
      )}
    </div>
  );
}
