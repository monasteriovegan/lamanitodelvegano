'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { guardarPedidoCompleto } from '../actions';

type ProductOption = { id: string; nombre: string; precio: number; gramaje?: string | null; variedades?: string | null };
type EditableItem = { key: string; custom: boolean; productoId: string; nombre: string; qty: number; precio: number; formato: string; variedad: string; notas: string };

const inputClass = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-neon';
const labelClass = 'block text-[10px] uppercase tracking-wider text-muted font-bold mb-1.5';

function key() { return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`; }
function toEditableItem(item: any): EditableItem {
  const productoId = String(item?.productoId || item?.product_id || '');
  return {
    key: key(),
    custom: Boolean(item?.custom || !productoId),
    productoId,
    nombre: String(item?.nombre || item?.product_name || item?.name || 'Producto'),
    qty: Number(item?.qty || item?.quantity || 1),
    precio: Number(item?.precio || item?.unit_price || item?.price || 0),
    formato: String(item?.formato || ''),
    variedad: String(item?.variedad || ''),
    notas: String(item?.notas || ''),
  };
}

function newItem(custom = false): EditableItem {
  return { key: key(), custom, productoId: '', nombre: '', qty: 1, precio: 0, formato: '', variedad: '', notas: '' };
}

export default function OrderEditForm({ order, products }: { order: any; products: ProductOption[] }) {
  const router = useRouter();
  const address = typeof order.shipping_address === 'object' && order.shipping_address ? order.shipping_address : {};
  const [open, setOpen] = useState(false);
  const [customerName, setCustomerName] = useState(String(order.customer_name || ''));
  const [customerPhone, setCustomerPhone] = useState(String(order.customer_phone || ''));
  const [customerEmail, setCustomerEmail] = useState(String(order.customer_email || ''));
  const [addressLine, setAddressLine] = useState(String(address.direccion || address.address_line1 || ''));
  const [comuna, setComuna] = useState(String(address.comuna || ''));
  const [deliveryDate, setDeliveryDate] = useState(String(order.delivery_date || ''));
  const [shippingCost, setShippingCost] = useState(Number(order.shipping_amount || 0));
  const [shippingZoneName, setShippingZoneName] = useState(String(order.shipping_zone_name || ''));
  const [paymentMethod, setPaymentMethod] = useState(String(order.payment_method || 'transfer'));
  const [paymentStatus, setPaymentStatus] = useState(String(order.payment_status || 'pending'));
  const [sourceChannel, setSourceChannel] = useState(String(order.source || 'manual'));
  const [estado, setEstado] = useState(String(order.legacy_status || 'Pendiente'));
  const [notes, setNotes] = useState(String(order.notes || ''));
  const [adminNotes, setAdminNotes] = useState(String(order.admin_notes || ''));
  const [items, setItems] = useState<EditableItem[]>(() => (order.items?.length ? order.items.map(toEditableItem) : [newItem(false)]));
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + Math.max(0, item.qty) * Math.max(0, item.precio), 0), [items]);
  const total = subtotal + Math.max(0, shippingCost);

  const updateItem = (itemKey: string, patch: Partial<EditableItem>) => setItems((rows) => rows.map((row) => row.key === itemKey ? { ...row, ...patch } : row));
  const selectProduct = (itemKey: string, productId: string) => {
    const product = products.find((row) => row.id === productId);
    updateItem(itemKey, { custom: false, productoId: productId, nombre: product?.nombre || '', precio: Number(product?.precio || 0) });
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!window.confirm('Esto puede modificar total, pago y stock del pedido. ¿Guardar los cambios?')) return;
    setLoading(true);
    setMessage('');
    try {
      await guardarPedidoCompleto(String(order.id), {
        customerName,
        customerPhone,
        customerEmail,
        address: addressLine,
        comuna,
        deliveryDate,
        shippingCost,
        shippingZoneName,
        paymentMethod,
        paymentStatus,
        sourceChannel,
        estado,
        notes,
        adminNotes,
        items: items.map(({ key: _key, ...item }) => item),
      });
      setMessage('✓ Pedido actualizado. El cambio quedó registrado en auditoría.');
      setOpen(false);
      router.refresh();
    } catch (error) {
      setMessage(`⚠ ${error instanceof Error ? error.message : 'No se pudo actualizar el pedido.'}`);
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-display font-bold text-white">Correcciones del pedido</h2><p className="text-xs text-muted mt-1">Cliente, productos, cantidades, despacho, pago, canal y fecha.</p></div>
          <button type="button" onClick={() => setOpen(true)} className="bg-white/5 hover:bg-neon hover:text-[#020705] border border-white/10 px-4 py-2 rounded-lg text-sm font-bold text-white transition-all">Editar pedido</button>
        </div>
        {message && <p className="text-xs text-neon mt-3">{message}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={save} className="rounded-2xl border border-neon/20 bg-white/[0.02] p-5 space-y-5">
      <div className="flex items-center justify-between gap-3"><div><h2 className="font-display font-bold text-white">Editar pedido</h2><p className="text-xs text-amber-200 mt-1">Los cambios materiales quedan auditados y el stock se ajusta solo por diferencia.</p></div><button type="button" onClick={() => setOpen(false)} className="text-xs text-muted">Cerrar</button></div>
      {message && <div className="rounded-lg border border-white/10 p-3 text-xs text-white">{message}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div><label className={labelClass}>Nombre</label><input className={inputClass} value={customerName} onChange={(e) => setCustomerName(e.target.value)} /></div>
        <div><label className={labelClass}>Teléfono</label><input className={inputClass} value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} /></div>
        <div><label className={labelClass}>Email</label><input type="email" className={inputClass} value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} /></div>
        <div className="md:col-span-2"><label className={labelClass}>Dirección</label><input className={inputClass} value={addressLine} onChange={(e) => setAddressLine(e.target.value)} /></div>
        <div><label className={labelClass}>Comuna</label><input className={inputClass} value={comuna} onChange={(e) => setComuna(e.target.value)} /></div>
      </div>

      <div className="border-t border-white/10 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3"><h3 className="font-bold text-sm text-white">Productos</h3><div className="flex gap-2"><button type="button" onClick={() => setItems((rows) => [...rows, newItem(false)])} className="text-xs border border-neon/30 text-neon rounded-lg px-3 py-1.5">+ Catálogo</button><button type="button" onClick={() => setItems((rows) => [...rows, newItem(true)])} className="text-xs border border-white/15 text-white rounded-lg px-3 py-1.5">+ Producto personalizado</button></div></div>
        <div className="space-y-3">
          {items.map((item, index) => (
            <div key={item.key} className="border border-white/10 rounded-xl p-3">
              <div className="flex justify-between mb-2"><span className="text-[10px] uppercase font-bold text-neon">Ítem {index + 1} · {item.custom ? 'Producto personalizado' : 'Catálogo'}</span>{items.length > 1 && <button type="button" className="text-xs text-red-300" onClick={() => setItems((rows) => rows.filter((row) => row.key !== item.key))}>Quitar</button>}</div>
              <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
                {!item.custom ? <div className="md:col-span-3"><label className={labelClass}>Producto</label><select className={inputClass} value={item.productoId} onChange={(e) => selectProduct(item.key, e.target.value)}><option value="" className="bg-[#030907]">Seleccionar…</option>{products.map((product) => <option key={product.id} value={product.id} className="bg-[#030907]">{product.nombre}</option>)}</select></div> : <div className="md:col-span-3"><label className={labelClass}>Nombre</label><input className={inputClass} value={item.nombre} onChange={(e) => updateItem(item.key, { nombre: e.target.value })} /></div>}
                <div><label className={labelClass}>Cant.</label><input type="number" min={1} className={inputClass} value={item.qty} onChange={(e) => updateItem(item.key, { qty: Number(e.target.value) })} /></div>
                <div className="md:col-span-2"><label className={labelClass}>Precio unit.</label><input type="number" min={0} className={inputClass} value={item.precio} onChange={(e) => updateItem(item.key, { precio: Number(e.target.value) })} /></div>
                <div className="md:col-span-2"><label className={labelClass}>Formato</label><input className={inputClass} value={item.formato} onChange={(e) => updateItem(item.key, { formato: e.target.value })} /></div>
                <div className="md:col-span-2"><label className={labelClass}>Variante / composición</label><input className={inputClass} value={item.variedad} onChange={(e) => updateItem(item.key, { variedad: e.target.value })} /></div>
                <div className="md:col-span-2"><label className={labelClass}>Nota</label><input className={inputClass} value={item.notas} onChange={(e) => updateItem(item.key, { notas: e.target.value })} /></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 border-t border-white/10 pt-4">
        <div><label className={labelClass}>Fecha entrega</label><input type="date" className={inputClass} value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} /></div>
        <div><label className={labelClass}>Costo envío</label><input type="number" min={0} className={inputClass} value={shippingCost} onChange={(e) => setShippingCost(Number(e.target.value))} /></div>
        <div className="md:col-span-2"><label className={labelClass}>Zona / modalidad</label><input className={inputClass} value={shippingZoneName} onChange={(e) => setShippingZoneName(e.target.value)} /></div>
        <div><label className={labelClass}>Método pago</label><select className={inputClass} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}><option className="bg-[#030907]" value="transfer">Transferencia</option><option className="bg-[#030907]" value="cash">Efectivo</option><option className="bg-[#030907]" value="card">Tarjeta</option><option className="bg-[#030907]" value="other">Otro</option></select></div>
        <div><label className={labelClass}>Estado pago</label><select className={inputClass} value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}><option className="bg-[#030907]" value="pending">Pendiente</option><option className="bg-[#030907]" value="paid">Pagado</option><option className="bg-[#030907]" value="partial">Parcial</option><option className="bg-[#030907]" value="refunded">Reembolsado</option></select></div>
        <div><label className={labelClass}>Canal</label><select className={inputClass} value={sourceChannel} onChange={(e) => setSourceChannel(e.target.value)}><option className="bg-[#030907]" value="instagram">Instagram</option><option className="bg-[#030907]" value="whatsapp">WhatsApp</option><option className="bg-[#030907]" value="web">Web</option><option className="bg-[#030907]" value="manual">Manual</option></select></div>
        <div><label className={labelClass}>Estado</label><select className={inputClass} value={estado} onChange={(e) => setEstado(e.target.value)}><option className="bg-[#030907]">Pendiente</option><option className="bg-[#030907]">Pagado</option><option className="bg-[#030907]">Despachado</option><option className="bg-[#030907]">Completado</option><option className="bg-[#030907]">Cancelado</option></select></div>
        <div className="md:col-span-2"><label className={labelClass}>Notas cliente</label><textarea rows={3} className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        <div className="md:col-span-2"><label className={labelClass}>Notas administrativas</label><textarea rows={3} className={inputClass} value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} /></div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4"><div><p className="text-xs text-muted">Subtotal ${subtotal.toLocaleString('es-CL')} · Envío ${shippingCost.toLocaleString('es-CL')}</p><p className="font-display font-bold text-xl text-neon">Nuevo total ${total.toLocaleString('es-CL')}</p></div><div className="flex gap-2"><button type="button" onClick={() => setOpen(false)} className="border border-white/10 px-4 py-2 rounded-lg text-sm text-white">Cancelar</button><button disabled={loading} className="bg-neon text-[#020705] font-bold px-5 py-2 rounded-lg text-sm disabled:opacity-50">{loading ? 'Guardando…' : 'Guardar cambios'}</button></div></div>
    </form>
  );
}
