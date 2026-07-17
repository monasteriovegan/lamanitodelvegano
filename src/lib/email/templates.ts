import type { Pedido, ItemCarrito } from '@/types/domain';

/**
 * Plantillas de email. A propósito con fondo claro (no el verde bosque
 * oscuro del sitio) — los clientes de email (Gmail, Outlook, etc.) rendean
 * mal el dark mode custom y el contraste falla en muchos de ellos. El
 * acento neón de la marca se usa como color de detalle, no de fondo.
 */

const ESTILOS_BASE = `
  font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  color: #1a1a1a;
  max-width: 480px;
  margin: 0 auto;
  padding: 32px 24px;
`;

function envoltorio(contenido: string): string {
  return `
    <div style="background:#f5f7f5; padding:24px 0;">
      <div style="${ESTILOS_BASE} background:#ffffff; border-radius:16px; border:1px solid #e5e5e5;">
        <p style="font-size:12px; letter-spacing:0.08em; text-transform:uppercase; color:#059669; font-weight:700; margin:0 0 16px;">
          La Manito Del Vegano
        </p>
        ${contenido}
        <p style="margin-top:32px; padding-top:16px; border-top:1px solid #eee; font-size:12px; color:#888;">
          100% plant-based · Santiago y Pucón
        </p>
      </div>
    </div>
  `;
}

function listaItems(items: ItemCarrito[]): string {
  return items
    .map(
      (it) => `
      <tr>
        <td style="padding:6px 0; font-size:14px;">${it.emoji ?? ''} ${it.nombre} × ${it.qty}</td>
        <td style="padding:6px 0; font-size:14px; text-align:right;">$${(it.precio * it.qty).toLocaleString('es-CL')}</td>
      </tr>`
    )
    .join('');
}

export function plantillaConfirmacionPedido(pedido: Pedido): string {
  return envoltorio(`
    <h1 style="font-size:20px; margin:0 0 8px;">¡Gracias por tu pedido, ${pedido.cliente.nombre.split(' ')[0]}! 🌱</h1>
    <p style="font-size:14px; color:#444; margin:0 0 20px;">
      Recibimos tu pedido <strong>#${pedido.id.slice(0, 8)}</strong>. Te avisamos apenas esté despachado.
    </p>
    <table style="width:100%; border-collapse:collapse;">
      ${listaItems(pedido.items)}
    </table>
    <div style="margin-top:16px; padding-top:12px; border-top:1px solid #eee; display:flex; justify-content:space-between; font-weight:700;">
      <table style="width:100%;"><tr>
        <td style="font-size:15px;">Total</td>
        <td style="font-size:15px; text-align:right;">$${pedido.total.toLocaleString('es-CL')}</td>
      </tr></table>
    </div>
    ${
      pedido.zonaEnvio
        ? `<p style="font-size:13px; color:#666; margin-top:12px;">📍 Envío a ${pedido.zonaEnvio}</p>`
        : ''
    }
  `);
}

export function plantillaPedidoDespachado(pedido: Pedido): string {
  return envoltorio(`
    <h1 style="font-size:20px; margin:0 0 8px;">Tu pedido va en camino 🚚</h1>
    <p style="font-size:14px; color:#444; margin:0 0 20px;">
      Hola ${pedido.cliente.nombre.split(' ')[0]}, tu pedido <strong>#${pedido.id.slice(0, 8)}</strong> fue despachado.
    </p>
    <table style="width:100%; border-collapse:collapse;">
      ${listaItems(pedido.items)}
    </table>
  `);
}

export function plantillaCarritoAbandonado(nombre: string, items: ItemCarrito[], subtotal: number): string {
  return envoltorio(`
    <h1 style="font-size:20px; margin:0 0 8px;">${nombre ? `${nombre}, ` : ''}dejaste algo en tu carrito 🌿</h1>
    <p style="font-size:14px; color:#444; margin:0 0 20px;">
      Todavía te lo guardamos — termina tu pedido cuando quieras.
    </p>
    <table style="width:100%; border-collapse:collapse;">
      ${listaItems(items)}
    </table>
    <div style="margin-top:16px; padding-top:12px; border-top:1px solid #eee;">
      <table style="width:100%;"><tr>
        <td style="font-size:15px; font-weight:700;">Subtotal</td>
        <td style="font-size:15px; text-align:right; font-weight:700;">$${subtotal.toLocaleString('es-CL')}</td>
      </tr></table>
    </div>
    <a href="https://lamanitodelvegano.cl" style="display:inline-block; margin-top:20px; background:#059669; color:#fff; text-decoration:none; padding:12px 24px; border-radius:9999px; font-size:14px; font-weight:600;">
      Terminar mi pedido
    </a>
  `);
}
