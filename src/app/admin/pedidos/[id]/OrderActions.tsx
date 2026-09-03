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
  const [adminNotes, setAdminNotes] = useState(order.admin_notes || '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  
  // Estado para modal de edición manual
  const [editingModal, setEditingModal] = useState(false);
  const [editCustomerName, setEditCustomerName] = useState(order.customer_name || '');
  const [editCustomerPhone, setEditCustomerPhone] = useState(order.customer_phone || '');
  const [editCustomerEmail, setEditCustomerEmail] = useState(order.customer_email || '');
  const [editAddress, setEditAddress] = useState(
    (typeof order.shipping_address === 'object' ? order.shipping_address?.direccion || order.shipping_address?.address_line1 : '') || ''
  );
  const [editComuna, setEditComuna] = useState(
    (typeof order.shipping_address === 'object' ? order.shipping_address?.comuna : '') || ''
  );
  const [editDeliveryDate, setEditDeliveryDate] = useState(order.delivery_date || '');
  const [editCustomerNotes, setEditCustomerNotes] = useState(order.notes || '');
  const [editAdminNotes, setEditAdminNotes] = useState(order.admin_notes || '');
  const [updateCrm, setUpdateCrm] = useState(false);

  // Estado de impresión local
  const [printCount, setPrintCount] = useState<number>(order.print_count || 0);
  const [lastPrintedAt, setLastPrintedAt] = useState<string | null>(order.last_printed_at || null);

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
          admin_notes: adminNotes,
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

  const saveManualEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: editCustomerName,
          customer_phone: editCustomerPhone,
          customer_email: editCustomerEmail,
          address: editAddress,
          comuna: editComuna,
          delivery_date: editDeliveryDate,
          notes: editCustomerNotes,
          admin_notes: editAdminNotes,
          update_crm: updateCrm,
        }),
      });
      if (res.ok) {
        toast('✦ Datos del pedido actualizados con éxito');
        setEditingModal(false);
        router.refresh();
      } else {
        const errData = await res.json();
        toast(`⚠ Error: ${errData.error || 'No se pudo actualizar el pedido'}`, false);
      }
    } catch {
      toast('⚠ Error de red al guardar', false);
    } finally {
      setSaving(false);
    }
  };

  const trackPrint = async (action: 'mark_printed' | 'reset_print') => {
    try {
      const res = await fetch(`/api/admin/orders/${order.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ print_action: action }),
      });
      if (res.ok) {
        const data = await res.json();
        if (action === 'mark_printed') {
          const nextCount = (printCount || 0) + 1;
          setPrintCount(nextCount);
          setLastPrintedAt(new Date().toISOString());
          toast('✓ Orden marcada como impresa');
        } else {
          setPrintCount(0);
          setLastPrintedAt(null);
          toast('✦ Estado de impresión restablecido');
        }
        router.refresh();
      }
    } catch {
      // no-op silencioso para no bloquear el diálogo de impresión
    }
  };

  const printOrder = () => {
    const fmt = (n: number) => `$${(n || 0).toLocaleString('es-CL')}`;
    const itemsHtml =
      (order.items || order.order_items)
        ?.map((i: any) => {
          const variedad = i.variedad || (Array.isArray(i.selections) ? i.selections.map((s: any) => `${s.quantity}× ${s.label}`).join(', ') : null);
          const itemNotas = i.notas;
          return `
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">
                <div style="font-weight: 700; font-size: 13px;">${i.product_name || i.nombre}</div>
                ${i.formato ? `<div style="font-size: 11px; color: #15803d; font-weight: 600;">Formato: ${i.formato}</div>` : ''}
                ${variedad ? `<div style="font-size: 11px; color: #475569; margin-top: 3px; font-family: monospace;">Composición: ${variedad}</div>` : ''}
                ${itemNotas ? `<div style="font-size: 11px; color: #b45309; font-style: italic; margin-top: 2px;">Obs: ${itemNotas}</div>` : ''}
              </td>
              <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center; font-family: monospace;">×${i.quantity || i.qty || 1}</td>
              <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #64748b;">${fmt(i.unit_price || i.precio)}</td>
              <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold;">${fmt(i.subtotal || ((i.unit_price || i.precio) * (i.quantity || i.qty || 1)))}</td>
            </tr>
          `;
        })
        .join('') || '';

    const addr = typeof order.shipping_address === 'string' ? JSON.parse(order.shipping_address) : order.shipping_address;

    const printWin = window.open('', '_blank', 'width=780,height=950');
    if (!printWin) return;

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Orden ${order.order_number || order.id}</title>
          <style>
            * { margin:0; padding:0; box-sizing:border-box; }
            body { font-family: 'Space Grotesk', system-ui, -apple-system, sans-serif; padding: 36px; color: #0f172a; background: #ffffff; max-width: 720px; margin: 0 auto; }
            .customer-zone { page-break-inside: avoid; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 3px solid #1b4332; }
            .brand { font-size: 22px; font-weight: 800; letter-spacing: 1.5px; color: #1b4332; }
            .subtitle { font-size: 10px; letter-spacing: 2.5px; color: #15803d; margin-top: 3px; text-transform: uppercase; font-weight: 700; }
            .order-num { font-size: 24px; font-weight: 800; color: #111; font-family: monospace; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 16px; }
            .box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 14px; border-radius: 8px; }
            .box-title { font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase; color: #1b4332; font-weight: 800; margin-bottom: 6px; }
            table { width: 100%; border-collapse: collapse; margin-top: 6px; }
            th { font-size: 10px; letter-spacing: 1px; text-transform: uppercase; color: #64748b; padding: 8px 10px; text-align: left; border-bottom: 2px solid #cbd5e1; }
            .total-row { font-size: 16px; font-weight: 800; color: #1b4332; }
            
            /* LÍNEA DE CORTE PARA SEPARAR COPIA CLIENTE DE USO INTERNO */
            .cut-off-line {
              margin: 28px 0 20px 0;
              border-top: 2px dashed #94a3b8;
              text-align: center;
              position: relative;
              page-break-before: auto;
            }
            .cut-off-label {
              background: #ffffff;
              padding: 0 14px;
              font-size: 10px;
              font-weight: 800;
              color: #475569;
              letter-spacing: 1.5px;
              position: relative;
              top: -8px;
              text-transform: uppercase;
            }
            .internal-zone {
              page-break-inside: avoid;
              background: #fdfaf4;
              border: 1.5px solid #fed7aa;
              border-radius: 8px;
              padding: 16px;
              margin-top: 10px;
            }
            .internal-header {
              font-size: 11px;
              font-weight: 800;
              letter-spacing: 1.5px;
              text-transform: uppercase;
              color: #c2410c;
              margin-bottom: 8px;
              display: flex;
              justify-content: space-between;
            }
            .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #94a3b8; letter-spacing: 1.5px; border-top: 1px dashed #cbd5e1; padding-top: 14px; }
            @media print {
              body { padding: 16px; }
              .cut-off-line { margin: 24px 0 16px 0; }
            }
          </style>
        </head>
        <body>
          <!-- ZONA 1: COPIA LIMPIA DEL CLIENTE -->
          <div class="customer-zone">
            <div class="header">
              <div>
                <div class="brand">${brandConfig.printHeader.title}</div>
                <div class="subtitle">${brandConfig.printHeader.subtitle}</div>
              </div>
              <div style="text-align: right;">
                <div class="order-num">${order.order_number || `MAN-${order.id.substring(0, 8)}`}</div>
                <div style="font-size: 11px; color: #64748b; margin-top: 4px;">
                  ${new Date(order.created_at).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
              </div>
            </div>

            <div class="grid">
              <div class="box">
                <div class="box-title">Datos del Cliente</div>
                <div style="font-size: 13px; font-weight: 700;">${order.customer_name || 'Sin nombre'}</div>
                <div style="font-size: 11px; color: #475569; margin-top: 2px;">${order.customer_email || ''}</div>
                <div style="font-size: 11px; color: #475569;">📞 ${order.customer_phone || '—'}</div>
              </div>
              <div class="box">
                <div class="box-title">Detalles de Despacho / Retiro</div>
                ${order.delivery_date ? `<div style="font-size: 12px; font-weight: 700; color: #1b4332;">📅 Fecha: ${new Date(order.delivery_date + 'T12:00:00').toLocaleDateString('es-CL')}</div>` : ''}
                ${addr?.direccion || addr?.address_line1 ? `<div style="font-size: 11px; color: #475569; margin-top: 3px;">📍 ${addr.direccion || addr.address_line1}${addr?.comuna ? `, ${addr.comuna}` : ''}</div>` : ''}
                ${order.shipping_zone_name ? `<div style="font-size: 11px; color: #64748b; margin-top: 2px;">Zona: ${order.shipping_zone_name}</div>` : ''}
              </div>
            </div>

            <div class="box" style="margin-bottom: 14px;">
              <div class="box-title">Productos Solicitados</div>
              <table>
                <thead>
                  <tr>
                    <th>Producto & Detalle</th>
                    <th style="text-align: center;">Cant.</th>
                    <th style="text-align: right;">Precio</th>
                    <th style="text-align: right;">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
              </table>

              <div style="margin-top: 14px; padding-top: 10px; border-top: 1px solid #cbd5e1;">
                ${order.discount_amount > 0 ? `<div style="display:flex; justify-content:space-between; font-size:12px; color:#059669; margin-bottom:3px;"><span>Descuento</span><span>−${fmt(order.discount_amount)}</span></div>` : ''}
                ${order.shipping_amount > 0 ? `<div style="display:flex; justify-content:space-between; font-size:12px; color:#475569; margin-bottom:3px;"><span>Envío</span><span>${fmt(order.shipping_amount)}</span></div>` : ''}
                <div style="display:flex; justify-content:space-between; margin-top: 6px;" class="total-row">
                  <span>TOTAL PAGADO / A PAGAR</span>
                  <span>${fmt(order.total)}</span>
                </div>
              </div>
            </div>

            ${order.notes ? `
              <div class="box" style="border-left: 3px solid #f59e0b; background: #fffbeb;">
                <div class="box-title" style="color: #b45309;">Observaciones / Instrucciones del Cliente</div>
                <div style="font-size: 12px; color: #78350f; font-weight: 500; white-space: pre-wrap;">${order.notes}</div>
              </div>
            ` : ''}

            <div class="footer">${brandConfig.printHeader.footer}</div>
          </div>

          <!-- ZONA 2: SECCIÓN RECORTABLE DE USO INTERNO / PRODUCCIÓN -->
          <div class="cut-off-line">
            <span class="cut-off-label">✂ - - - - - RECORTAR AQUÍ (USO INTERNO / PRODUCCIÓN) - - - - - ✂</span>
          </div>

          <div class="internal-zone">
            <div class="internal-header">
              <span>🏭 Comanda Taller · Orden #${order.order_number || order.id}</span>
              <span>Canal: ${order.source || 'web'} · Pago: ${order.payment_status || 'pending'}</span>
            </div>
            <div style="font-size: 12px; margin-bottom: 6px;">
              <strong>Cliente:</strong> ${order.customer_name || 'Sin nombre'} · <strong>Tel:</strong> ${order.customer_phone || '—'}
            </div>
            ${order.delivery_date ? `<div style="font-size: 12px; margin-bottom: 6px;"><strong>Entrega Programada:</strong> ${new Date(order.delivery_date + 'T12:00:00').toLocaleDateString('es-CL')}</div>` : ''}
            
            <div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed #fdba74;">
              <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #9a3412; margin-bottom: 4px;">
                📝 Notas Internas de Preparación & Producción:
              </div>
              <div style="font-size: 12px; color: #431407; font-weight: 600; white-space: pre-wrap;">
                ${order.admin_notes || '(Sin notas internas registradas)'}
              </div>
            </div>
          </div>

          <script>
            window.onload = () => {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWin.document.close();

    // Registrar evento de impresión en backend
    void trackPrint('mark_printed');
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

      {/* Tarjeta de Estado de Impresión & Acciones */}
      <div className="bg-white/[0.02] border border-[rgba(0,255,179,0.12)] rounded-2xl p-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <p className="text-[10px] tracking-[3px] text-neon uppercase font-display">
            🖨️ Estado de Impresión
          </p>
          {printCount > 0 ? (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold">
              ✓ {printCount > 1 ? `Reimpreso (${printCount})` : 'Impreso'}
            </span>
          ) : (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 text-white/50 border border-white/10">
              No impreso
            </span>
          )}
        </div>

        {lastPrintedAt && (
          <p className="text-xs text-muted mb-3 font-mono">
            Última impresión: {new Date(lastPrintedAt).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={printOrder}
            className="flex-1 bg-white/10 hover:bg-neon hover:text-[#020705] text-white font-bold py-2 px-3 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5"
          >
            🖨 {printCount > 0 ? 'Reimprimir Orden' : 'Imprimir Orden'}
          </button>

          {printCount > 0 && (
            <button
              onClick={() => void trackPrint('reset_print')}
              title="Restablecer estado si la impresión se canceló en el diálogo"
              className="text-[11px] text-white/50 hover:text-white border border-white/10 rounded-xl px-2.5 py-2 hover:bg-white/5 transition-colors"
            >
              Restablecer
            </button>
          )}
        </div>
      </div>

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
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
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
          onClick={() => setEditingModal(true)}
          className="bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-all flex items-center gap-2"
        >
          ✏️ Editar Datos del Pedido
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

      {/* MODAL DE EDICIÓN MANUAL DEL PEDIDO (G) */}
      {editingModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#071710] border border-[rgba(0,255,179,0.25)] rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
              <h3 className="font-display font-bold text-lg text-white flex items-center gap-2">
                <span>✏️</span> Editar Datos del Pedido
              </h3>
              <button
                onClick={() => setEditingModal(false)}
                className="text-white/40 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={saveManualEdit} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs text-muted mb-1 font-semibold">Nombre del Cliente</label>
                <input
                  type="text"
                  value={editCustomerName}
                  onChange={(e) => setEditCustomerName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:border-neon outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted mb-1 font-semibold">Teléfono del Pedido</label>
                  <input
                    type="tel"
                    placeholder="+56 9 1234 5678"
                    value={editCustomerPhone}
                    onChange={(e) => setEditCustomerPhone(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:border-neon outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1 font-semibold">Correo Electrónico</label>
                  <input
                    type="email"
                    value={editCustomerEmail}
                    onChange={(e) => setEditCustomerEmail(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:border-neon outline-none"
                  />
                </div>
              </div>

              {/* Checkbox desacoplamiento CRM */}
              <div className="bg-white/[0.02] border border-white/10 rounded-xl p-3">
                <label className="flex items-center gap-2 text-xs text-white/90 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={updateCrm}
                    onChange={(e) => setUpdateCrm(e.target.checked)}
                    className="rounded text-neon focus:ring-neon accent-[#00ffb3]"
                  />
                  <span>Actualizar también la ficha maestra del contacto en CRM</span>
                </label>
                <p className="text-[10px] text-white/40 mt-1 pl-5">
                  Si no está marcado, el cambio de teléfono solo afectará a este pedido específico sin sobreescribir la identidad omnicanal.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted mb-1 font-semibold">Dirección</label>
                  <input
                    type="text"
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:border-neon outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1 font-semibold">Comuna</label>
                  <input
                    type="text"
                    value={editComuna}
                    onChange={(e) => setEditComuna(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:border-neon outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-muted mb-1 font-semibold">Fecha de Entrega Programada</label>
                <input
                  type="date"
                  value={editDeliveryDate}
                  onChange={(e) => setEditDeliveryDate(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:border-neon outline-none"
                />
              </div>

              <div>
                <label className="block text-xs text-muted mb-1 font-semibold">Observaciones / Instrucciones del Cliente</label>
                <textarea
                  rows={2}
                  value={editCustomerNotes}
                  onChange={(e) => setEditCustomerNotes(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:border-neon outline-none"
                />
              </div>

              <div>
                <label className="block text-xs text-muted mb-1 font-semibold">Notas Internas (Uso Exclusivo Taller)</label>
                <textarea
                  rows={2}
                  value={editAdminNotes}
                  onChange={(e) => setEditAdminNotes(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:border-neon outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setEditingModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white/60 hover:text-white border border-white/10"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-neon text-[#020705] px-5 py-2 rounded-xl text-xs font-bold hover:bg-white transition-all shadow-[0_0_10px_rgba(0,255,179,0.3)] disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : 'Guardar Datos ✦'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
