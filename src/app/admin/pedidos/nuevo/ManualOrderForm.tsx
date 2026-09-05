'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { crearPedidoManual } from '../actions';

type ProductOption = {
  id: string;
  nombre: string;
  precio: number;
  gramaje?: string | null;
  variedades?: string | null;
  maneja_stock?: boolean | null;
  stock?: number | null;
  orderOptions?: string[];
};

type CustomerOption = {
  id: string;
  nombre?: string | null;
  display_name?: string | null;
  phone?: string | null;
  email?: string | null;
  direccion?: string | null;
  metadata?: Record<string, unknown> | null;
};

type EditableItem = {
  key: string;
  custom: boolean;
  productoId: string;
  nombre: string;
  qty: number;
  precio: number;
  formato: string;
  variedad: string;
  notas: string;
};

function newItem(custom = false): EditableItem {
  return {
    key: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
    custom,
    productoId: '',
    nombre: '',
    qty: 1,
    precio: 0,
    formato: '',
    variedad: '',
    notas: '',
  };
}

const inputClass = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-neon';
const labelClass = 'block text-[10px] uppercase tracking-wider text-muted font-bold mb-1.5';

export default function ManualOrderForm({
  products,
  customers,
}: {
  products: ProductOption[];
  customers: CustomerOption[];
}) {
  const router = useRouter();
  const [draftKey] = useState(() => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`);
  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [address, setAddress] = useState('');
  const [comuna, setComuna] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [shippingCost, setShippingCost] = useState(0);
  const [shippingZoneName, setShippingZoneName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('transfer');
  const [paymentStatus, setPaymentStatus] = useState('pending');
  const [sourceChannel, setSourceChannel] = useState('manual');
  const [adminNotes, setAdminNotes] = useState('');
  const [items, setItems] = useState<EditableItem[]>([newItem(false)]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + Math.max(0, Number(item.qty || 0)) * Math.max(0, Number(item.precio || 0)), 0),
    [items],
  );
  const total = subtotal + Math.max(0, Number(shippingCost || 0));

  const updateItem = (key: string, patch: Partial<EditableItem>) => {
    setItems((current) => current.map((item) => item.key === key ? { ...item, ...patch } : item));
  };

  const selectProduct = (key: string, productId: string) => {
    const product = products.find((row) => row.id === productId);
    updateItem(key, {
      productoId: productId,
      nombre: product?.nombre || '',
      precio: Number(product?.precio || 0),
      variedad: '',
      custom: false,
    });
  };

  const orderOptionsFor = (productId: string) => products.find((row) => row.id === productId)?.orderOptions || [];

  const selectCustomer = (id: string) => {
    setCustomerId(id);
    const customer = customers.find((row) => row.id === id);
    if (!customer) return;
    setCustomerName(customer.nombre || customer.display_name || '');
    setCustomerPhone(customer.phone || '');
    setCustomerEmail(customer.email || '');
    setAddress(customer.direccion || '');
    const metaComuna = customer.metadata && typeof customer.metadata.comuna === 'string' ? customer.metadata.comuna : '';
    setComuna(metaComuna);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await crearPedidoManual({
        draftKey,
        customerId: customerId || null,
        customerName,
        customerPhone,
        customerEmail,
        address,
        comuna,
        deliveryDate,
        shippingCost,
        shippingZoneName,
        paymentMethod,
        paymentStatus,
        sourceChannel,
        adminNotes,
        items: items.map(({ key: _key, ...item }) => item),
      });
      router.push(`/admin/pedidos/${result.orderId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el pedido.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}

      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <h2 className="font-display font-bold text-white mb-4">Cliente</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className={labelClass}>Cliente CRM existente (opcional)</label>
            <select value={customerId} onChange={(e) => selectCustomer(e.target.value)} className={inputClass}>
              <option value="" className="bg-[#030907]">Cliente nuevo / ingresar datos</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id} className="bg-[#030907]">
                  {(customer.nombre || customer.display_name || 'Sin nombre')} {customer.phone ? `· ${customer.phone}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div><label className={labelClass}>Nombre *</label><input className={inputClass} value={customerName} onChange={(e) => setCustomerName(e.target.value)} required /></div>
          <div><label className={labelClass}>Teléfono</label><input className={inputClass} value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} /></div>
          <div><label className={labelClass}>Email</label><input type="email" className={inputClass} value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} /></div>
          <div><label className={labelClass}>Comuna</label><input className={inputClass} value={comuna} onChange={(e) => setComuna(e.target.value)} /></div>
          <div className="md:col-span-2"><label className={labelClass}>Dirección</label><input className={inputClass} value={address} onChange={(e) => setAddress(e.target.value)} /></div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="font-display font-bold text-white">Productos</h2>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setItems((rows) => [...rows, newItem(false)])} className="border border-neon/30 text-neon px-3 py-1.5 rounded-lg text-xs font-bold">+ Catálogo</button>
            <button type="button" onClick={() => setItems((rows) => [...rows, newItem(true)])} className="border border-white/15 text-white px-3 py-1.5 rounded-lg text-xs font-bold">+ Producto personalizado</button>
          </div>
        </div>

        <div className="space-y-4">
          {items.map((item, index) => (
            <div key={item.key} className="rounded-xl border border-white/10 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-bold text-neon">Ítem {index + 1} · {item.custom ? 'Producto personalizado' : 'Catálogo'}</div>
                {items.length > 1 && <button type="button" onClick={() => setItems((rows) => rows.filter((row) => row.key !== item.key))} className="text-xs text-red-300">Quitar</button>}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                {!item.custom && (
                  <div className="md:col-span-3">
                    <label className={labelClass}>Producto</label>
                    <select className={inputClass} value={item.productoId} onChange={(e) => selectProduct(item.key, e.target.value)} required>
                      <option value="" className="bg-[#030907]">Seleccionar…</option>
                      {products.map((product) => <option key={product.id} value={product.id} className="bg-[#030907]">{product.nombre} · ${product.precio.toLocaleString('es-CL')}</option>)}
                    </select>
                  </div>
                )}
                {item.custom && <div className="md:col-span-3"><label className={labelClass}>Nombre personalizado</label><input className={inputClass} value={item.nombre} onChange={(e) => updateItem(item.key, { nombre: e.target.value })} required /></div>}
                <div><label className={labelClass}>Cantidad</label><input type="number" min={1} className={inputClass} value={item.qty} onChange={(e) => updateItem(item.key, { qty: Number(e.target.value) })} required /></div>
                <div className="md:col-span-2"><label className={labelClass}>Precio unitario</label><input type="number" min={0} className={inputClass} value={item.precio} onChange={(e) => updateItem(item.key, { precio: Number(e.target.value) })} required /></div>
                <div className="md:col-span-2"><label className={labelClass}>Formato</label><input className={inputClass} value={item.formato} onChange={(e) => updateItem(item.key, { formato: e.target.value })} /></div>
                {!item.custom && orderOptionsFor(item.productoId).length > 0 ? (
                  <div className="md:col-span-2">
                    <label className={labelClass}>Opciones / sabores</label>
                    <select className={inputClass} value={item.variedad} onChange={(e) => updateItem(item.key, { variedad: e.target.value })} required>
                      <option value="" className="bg-[#030907]">Seleccionar opción…</option>
                      {orderOptionsFor(item.productoId).map((option) => <option key={option} value={option} className="bg-[#030907]">{option}</option>)}
                    </select>
                  </div>
                ) : (
                  <div className="md:col-span-2"><label className={labelClass}>Variante / composición</label><input className={inputClass} value={item.variedad} onChange={(e) => updateItem(item.key, { variedad: e.target.value })} /></div>
                )}
                <div className="md:col-span-2"><label className={labelClass}>Nota del ítem</label><input className={inputClass} value={item.notas} onChange={(e) => updateItem(item.key, { notas: e.target.value })} /></div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <h2 className="font-display font-bold text-white mb-4">Entrega y pago</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div><label className={labelClass}>Fecha entrega</label><input type="date" className={inputClass} value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} /></div>
          <div><label className={labelClass}>Costo envío</label><input type="number" min={0} className={inputClass} value={shippingCost} onChange={(e) => setShippingCost(Number(e.target.value))} /></div>
          <div><label className={labelClass}>Zona / retiro</label><input className={inputClass} value={shippingZoneName} onChange={(e) => setShippingZoneName(e.target.value)} placeholder="Ej: Retiro taller / Maipú" /></div>
          <div><label className={labelClass}>Método pago</label><select className={inputClass} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}><option className="bg-[#030907]" value="transfer">Transferencia</option><option className="bg-[#030907]" value="cash">Efectivo</option><option className="bg-[#030907]" value="card">Tarjeta</option><option className="bg-[#030907]" value="other">Otro</option></select></div>
          <div><label className={labelClass}>Estado pago</label><select className={inputClass} value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}><option className="bg-[#030907]" value="pending">Pendiente</option><option className="bg-[#030907]" value="paid">Pagado</option><option className="bg-[#030907]" value="partial">Parcial</option><option className="bg-[#030907]" value="refunded">Reembolsado</option></select></div>
          <div><label className={labelClass}>Canal</label><select className={inputClass} value={sourceChannel} onChange={(e) => setSourceChannel(e.target.value)}><option className="bg-[#030907]" value="manual">Manual</option><option className="bg-[#030907]" value="instagram">Instagram</option><option className="bg-[#030907]" value="whatsapp">WhatsApp</option><option className="bg-[#030907]" value="web">Web</option></select></div>
          <div className="md:col-span-3"><label className={labelClass}>Notas administrativas</label><textarea className={inputClass} rows={3} value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} /></div>
        </div>
      </section>

      <div className="rounded-2xl border border-neon/20 bg-neon/5 p-5 flex flex-wrap items-center justify-between gap-4">
        <div><div className="text-xs text-muted">Subtotal ${subtotal.toLocaleString('es-CL')} · Envío ${shippingCost.toLocaleString('es-CL')}</div><div className="font-display text-2xl font-bold text-neon">Total ${total.toLocaleString('es-CL')}</div></div>
        <div className="flex gap-2"><Link href="/admin/pedidos" className="px-4 py-2.5 rounded-lg border border-white/10 text-sm text-white">Cancelar</Link><button disabled={loading} className="px-5 py-2.5 rounded-lg bg-neon text-[#020705] font-bold text-sm disabled:opacity-50">{loading ? 'Creando…' : 'Crear pedido'}</button></div>
      </div>
    </form>
  );
}
