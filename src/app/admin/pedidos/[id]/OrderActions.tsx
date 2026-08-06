'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { brandConfig } from '@/config/brand';

const STATUSES = [
  ['pending', 'Pendiente', '#f59e0b'],
  ['confirmed', 'Confirmado', '#34d399'],
  ['processing', 'Procesando', '#a78bfa'],
  ['shipped', 'Enviado', '#38bdf8'],
  ['delivered', 'Entregado', '#00ffb3'],
  ['cancelled', 'Cancelado', '#ef4444'],
] as const;

export default function OrderActions({ order }: { order: any }) {
  const router = useRouter();
  const [status, setStatus] = useState(order.status || 'pending');
  const [tracking, setTracking] = useState(order.tracking_number || '');
  const [notes, setNotes] = useState(order.admin_notes || '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [confirmingPayment, setConfirmingPayment] = useState(false);

  const toast = (text: string, ok = true) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 3500);
  };

  const confirmPayment = async () => {
    setConfirmingPayment(true);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_status: 'paid',
          paid_at: new Date().toISOString(),
        }),
      });
      if (res.ok) {
        toast('✦ Pago por transferencia verificado con éxito');
        router.refresh();
      } else {
        toast('⚠ Error al confirmar el pago', false);
      }
    } catch {
      toast('⚠ Error de conexión', false);
    } finally {
      setConfirmingPayment(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          tracking_number: tracking,
          admin_notes: notes,
        }),
      });
      if (res.ok) {
        toast('✦ Estado del pedido actualizado');
        router.refresh();
      } else {
        toast('⚠ Error al guardar los cambios', false);
      }
    } catch {
      toast('⚠ Error de red al guardar', false);
    } finally {
      setSaving(false);
    }
  };

  const printOrder = () => {
    const fmt = (n: number) => `$${(n || 0).toLocaleString('es-CL')}`;
    const itemsHtml =
      order.order_items
        ?.map(
          (i: any) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${i.product_name}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">×${i.quantity}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">${fmt(i.unit_price)}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold;">${fmt(i.subtotal)}</td>
      </tr>
    `
        )
        .join('') || '';

    const addr = typeof order.shipping_address === 'string' ? JSON.parse(order.shipping_address) : order.shipping_address;

    const printWin = window.open('', '_blank', 'width=750,height=950');
    if (!printWin) return;

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Orden ${order.order_number || order.id}</title>
          <style>
            * { margin:0; padding:0; box-sizing:border-box; }
            body { font-family: 'Space Grotesk', system-ui, sans-serif; padding: 40px; color: #1a1a1a; background: #ffffff; max-width: 720px; margin: 0 auto; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 3px solid #1b4332; }
            .brand { font-size: 24px; font-weight: 800; letter-spacing: 2px; color: #1b4332; }
            .subtitle { font-size: 11px; letter-spacing: 3px; color: #52b788; margin-top: 4px; text-transform: uppercase; }
            .order-num { font-size: 26px; font-weight: 700; color: #111; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
            .box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px; border-radius: 8px; }
            .box-title { font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: #1b4332; font-weight: 700; margin-bottom: 8px; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; }
            th { font-size: 10px; letter-spacing: 1px; text-transform: uppercase; color: #64748b; padding: 8px 10px; text-align: left; border-bottom: 2px solid #cbd5e1; }
            .total-row { font-size: 16px; font-weight: 800; color: #1b4332; }
            .footer { margin-top: 40px; text-align: center; font-size: 10px; color: #94a3b8; letter-spacing: 2px; border-top: 1px dashed #cbd5e1; padding-top: 16px; }
            @media print { body { padding: 20px; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="brand">${brandConfig.printHeader.title}</div>
              <div class="subtitle">${brandConfig.printHeader.subtitle}</div>
            </div>
            <div style="text-align: right;">
              <div class="order-num">${order.order_number || `MAN-${order.id.substring(0, 8)}`}</div>
              <div style="font-size: 12px; color: #64748b; margin-top: 4px;">
                ${new Date(order.created_at).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </div>
          </div>

          <div class="grid">
            <div class="box">
              <div class="box-title">Datos del Cliente</div>
              <div style="font-size: 14px; font-weight: bold;">${order.customer_name || 'Sin nombre'}</div>
              <div style="font-size: 12px; color: #475569; margin-top: 2px;">${order.customer_email || ''}</div>
              <div style="font-size: 12px; color: #475569;">${order.customer_phone || ''}</div>
            </div>
            <div class="box">
              <div class="box-title">Detalles de Despacho / Retiro</div>
              ${order.delivery_date ? `<div style="font-size: 13px; font-weight: bold;">📅 Fecha: ${new Date(order.delivery_date + 'T12:00:00').toLocaleDateString('es-CL')}</div>` : ''}
              ${addr?.direccion || addr?.address_line1 ? `<div style="font-size: 12px; color: #475569; margin-top: 4px;">📍 ${addr.direccion || addr.address_line1}</div>` : ''}
              ${order.shipping_zone_name ? `<div style="font-size: 11px; color: #64748b; margin-top: 2px;">Zona: ${order.shipping_zone_name}</div>` : ''}
            </div>
          </div>

          <div class="box" style="margin-bottom: 20px;">
            <div class="box-title">Productos Solicitados</div>
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th style="text-align: center;">Cant.</th>
                  <th style="text-align: right;">Precio</th>
                  <th style="text-align: right;">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>

            <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid #cbd5e1;">
              ${order.discount_amount > 0 ? `<div style="display:flex; justify-content:space-between; font-size:13px; color:#059669; margin-bottom:4px;"><span>Descuento</span><span>−${fmt(order.discount_amount)}</span></div>` : ''}
              ${order.shipping_amount > 0 ? `<div style="display:flex; justify-content:space-between; font-size:13px; color:#475569; margin-bottom:4px;"><span>Envío</span><span>${fmt(order.shipping_amount)}</span></div>` : ''}
              <div style="display:flex; justify-content:space-between; margin-top: 8px;" class="total-row">
                <span>TOTAL A PAGAR</span>
                <span>${fmt(order.total)}</span>
              </div>
            </div>
          </div>

          ${order.notes ? `<div class="box"><div class="box-title">Notas del Cliente</div><div style="font-size:12px; color:#334155;">${order.notes}</div></div>` : ''}

          <div class="footer">${brandConfig.printHeader.footer}</div>
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `);
    printWin.document.close();
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Toast Notificación */}
      {msg && (
        <div
          className={`p-3.5 rounded-xl border text-sm font-semibold transition-all ${
            msg.ok
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* Alerta de Pago por Transferencia Pendiente */}
      {order.payment_method === 'transfer' && order.payment_status !== 'paid' && (
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-2xl p-5">
          <p className="text-xs font-mono font-bold text-purple-300 uppercase tracking-widest mb-1.5">
            🏦 Pago por Transferencia — Pendiente de Confirmación
          </p>
          <p className="text-sm text-white/80 mb-4 leading-relaxed">
            Este pedido fue realizado mediante transferencia bancaria. Por favor revisa el comprobante antes de validar.
          </p>
          <button
            onClick={confirmPayment}
            disabled={confirmingPayment}
            className="bg-neon hover:bg-white text-[#020705] font-bold px-5 py-2.5 rounded-xl text-sm transition-all shadow-[0_0_12px_rgba(0,255,179,0.3)] disabled:opacity-50"
          >
            {confirmingPayment ? 'Confirmando...' : '✓ Confirmar Pago Recibido'}
          </button>
        </div>
      )}

      {/* Stepper de Progreso del Pedido */}
      <div className="bg-white/[0.02] border border-[rgba(0,255,179,0.12)] rounded-2xl p-5">
        <p className="text-[10px] tracking-[3px] text-neon uppercase font-display mb-4">
          Progreso del Pedido Operacional
        </p>

        <div className="flex items-center justify-between gap-1 overflow-x-auto pb-2">
          {STATUSES.filter((s) => s[0] !== 'cancelled').map(([s, label, color], idx, arr) => {
            const currentIdx = STATUSES.findIndex((x) => x[0] === status);
            const stepIdx = STATUSES.findIndex((x) => x[0] === s);
            const isDone = currentIdx >= stepIdx && status !== 'cancelled';

            return (
              <div key={s} className="flex items-center flex-1 min-w-[90px]">
                <div className="flex flex-col items-center gap-1.5 w-full">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all border"
                    style={{
                      backgroundColor: isDone ? color : 'rgba(255,255,255,0.03)',
                      borderColor: isDone ? color : 'rgba(255,255,255,0.15)',
                      color: isDone ? '#020705' : '#888888',
                    }}
                  >
                    {isDone ? '✓' : idx + 1}
                  </div>
                  <span
                    className="text-[10px] font-mono text-center font-semibold"
                    style={{ color: isDone ? color : '#888888' }}
                  >
                    {label}
                  </span>
                </div>
                {idx < arr.length - 1 && (
                  <div
                    className="h-0.5 flex-1 min-w-[15px] mx-1 transition-all"
                    style={{
                      backgroundColor: isDone && currentIdx > stepIdx ? color : 'rgba(255,255,255,0.1)',
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Controles Formulario */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
          <div>
            <label className="block text-xs text-muted mb-1.5 font-medium">Cambiar Estado Operacional</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-neon"
            >
              {STATUSES.map(([val, lbl]) => (
                <option key={val} value={val} className="bg-[#030907]">
                  {lbl}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-muted mb-1.5 font-medium">Número de Seguimiento (Tracking)</label>
            <input
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
              placeholder="Ej: CHI-987654321"
              className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-neon"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs text-muted mb-1.5 font-medium">Notas Internas (Solo equipo)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Anotaciones internas del taller..."
              className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-neon resize-y"
            />
          </div>
        </div>
      </div>

      {/* Historial de Timestamps */}
      {(order.created_at || order.paid_at || order.shipped_at || order.delivered_at) && (
        <div className="bg-white/[0.02] border border-[rgba(0,255,179,0.12)] rounded-2xl p-5">
          <p className="text-[10px] tracking-[3px] text-neon uppercase font-display mb-3">
            Historial del Pedido
          </p>
          <div className="flex flex-col gap-2.5 text-xs">
            {[
              { label: 'Pedido Creado', date: order.created_at, icon: '◈' },
              { label: 'Pago Verificado', date: order.paid_at, icon: '✦' },
              { label: 'Despachado / Enviado', date: order.shipped_at, icon: '🚚' },
              { label: 'Entregado al Cliente', date: order.delivered_at, icon: '✓' },
            ]
              .filter((item) => item.date)
              .map((item) => (
                <div key={item.label} className="flex items-center justify-between py-1 border-b border-white/5 last:border-0">
                  <span className="text-white/90 font-medium flex items-center gap-2">
                    <span className="text-neon">{item.icon}</span> {item.label}
                  </span>
                  <span className="text-muted font-mono">
                    {new Date(item.date).toLocaleDateString('es-CL', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Botones de Acción */}
      <div className="flex flex-wrap gap-3 pt-2">
        <button
          onClick={save}
          disabled={saving}
          className="bg-neon hover:bg-white text-[#020705] font-bold px-6 py-2.5 rounded-xl text-sm transition-all shadow-[0_0_12px_rgba(0,255,179,0.3)] disabled:opacity-50"
        >
          {saving ? 'Guardando...' : 'Guardar Cambios ✦'}
        </button>

        <button
          onClick={printOrder}
          className="bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-all flex items-center gap-2"
        >
          🖨 Imprimir Orden
        </button>

        {order.customer_phone && (
          <a
            href={`https://wa.me/${order.customer_phone.replace(/\D/g, '')}?text=Hola+${encodeURIComponent(
              order.customer_name || ''
            )}+✦+de+La+Manito+del+Vegano.+Tu+pedido+${order.order_number || order.id}+está+${status}`}
            target="_blank"
            rel="noreferrer"
            className="bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-semibold px-4 py-2.5 rounded-xl text-sm transition-all flex items-center gap-2"
          >
            💬 Contactar WhatsApp
          </a>
        )}

        {order.customer_email && (
          <a
            href={`mailto:${order.customer_email}?subject=Tu pedido ${order.order_number || order.id} · La Manito del Vegano`}
            className="bg-white/5 hover:bg-white/10 border border-white/10 text-muted hover:text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-all flex items-center gap-2"
          >
            ✉ Enviar Email
          </a>
        )}

        <a
          href="/admin/pedidos"
          className="ml-auto border border-white/10 hover:border-white/20 text-muted hover:text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-all flex items-center gap-1"
        >
          ← Volver
        </a>
      </div>
    </div>
  );
}
