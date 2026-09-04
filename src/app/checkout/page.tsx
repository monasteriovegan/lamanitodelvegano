'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { SiteShell } from '@/components/layout/SiteShell';
import { useCart } from '@/lib/cart/CartContext';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Zona } from '@/types/domain';
import { formatDeliveryDateLabel } from '@/lib/pricing/fechas';
import { trackContact, trackInitiateCheckout } from '@/lib/analytics/client';

function CheckoutContent() {
  const router = useRouter();
  const { items, subtotal, clearCart } = useCart();
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const checkoutTracked = useRef(false);

  const [zonas, setZonas] = useState<Zona[]>([]);
  const [zonaId, setZonaId] = useState('');
  const [comuna, setComuna] = useState('');
  const [fechaEntrega, setFechaEntrega] = useState('');
  const [deliveryDates, setDeliveryDates] = useState<string[]>([]);
  const [cuponCode, setCuponCode] = useState('');
  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [notas, setNotas] = useState('');
  const [attribution, setAttribution] = useState<Record<string, string>>({});

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const keys = ['fbclid', 'fbc', 'fbp', 'gclid', 'gbraid', 'wbraid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
    const captured = Object.fromEntries(
      keys.map((key) => [key, params.get(key) || '']).filter(([, value]) => value),
    );
    const current = {
      ...captured,
      landing_url: window.location.href,
      referrer: document.referrer || '',
    };
    let firstTouch: Record<string, string> = {};
    try {
      firstTouch = JSON.parse(localStorage.getItem('lmv_cart_attribution') || '{}');
    } catch {
      firstTouch = {};
    }
    const merged = { ...current, ...firstTouch, ...captured };
    localStorage.setItem('lmv_cart_attribution', JSON.stringify(merged));
    const updateId = window.setTimeout(() => setAttribution(merged), 0);
    return () => window.clearTimeout(updateId);
  }, []);

  useEffect(() => {
    if (items.length === 0 || checkoutTracked.current) return;
    checkoutTracked.current = true;
    trackInitiateCheckout({
      items: items.map((item) => ({ id: item.productoId, name: item.nombre, price: item.precio, quantity: item.qty })),
      value: subtotal,
    });
  }, [items, subtotal]);

  const [metodoPago, setMetodoPago] = useState<'mercadopago' | 'flow' | 'whatsapp'>('mercadopago');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase
      .from('zonas')
      .select('id, nombre, comunas, precio')
      .then(({ data }) => setZonas((data as Zona[]) || []));
  }, []);

  useEffect(() => {
    if (!items.length) return;
    const controller = new AbortController();
    const productIds = Array.from(new Set(items.map((item) => item.productoId))).join(',');
    fetch(`/api/checkout?productIds=${encodeURIComponent(productIds)}`, { signal: controller.signal, cache: 'no-store' })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('delivery_dates_failed')))
      .then((data) => {
        const dates = Array.isArray(data?.deliveryDates) ? data.deliveryDates.map(String) : [];
        setDeliveryDates(dates);
        setFechaEntrega((current) => dates.includes(current) ? current : '');
      })
      .catch((fetchError) => {
        if (fetchError?.name !== 'AbortError') setDeliveryDates([]);
      });
    return () => controller.abort();
  }, [items]);

  useEffect(() => {
    if (items.length === 0 || (!email && !telefono)) return;
    const timeoutId = setTimeout(() => {
      fetch('/api/carrito/guardar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombre || null,
          email: email || null,
          telefono: telefono || null,
          items,
          subtotal,
          attribution,
        }),
      }).catch(() => {});
    }, 2000);
    return () => clearTimeout(timeoutId);
  }, [items, subtotal, nombre, email, telefono, attribution]);

  const zonaSeleccionada = zonas.find((z) => z.id === zonaId);
  const comunasDisponibles = String(zonaSeleccionada?.comunas || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const totalEstimado = subtotal + (zonaSeleccionada?.precio || 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (items.length === 0) return;
    setLoading(true);
    setError(null);

    try {
      const checkoutRes = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          idempotencyKey,
          cliente: { nombre, direccion, comuna, telefono, email },
          items: items.map((i) => ({
            productoId: i.productoId,
            variantId: i.variantId,
            qty: i.qty,
            selections: i.selections?.map(({ optionValueId, quantity }) => ({ optionValueId, quantity })),
            campaignTag: i.campaignTag,
            formato: i.formato,
            variedad: i.variedad,
            notas: i.notas || null,
          })),
          zonaId: zonaId || null,
          fechaEntrega,
          cuponCode: cuponCode || null,
          metodoPago,
          notas: notas.trim() || null,
          attribution,
        }),
      });

      const checkoutData = await checkoutRes.json();
      if (!checkoutRes.ok) {
        setError(checkoutData.error || 'No se pudo procesar el pedido.');
        setLoading(false);
        return;
      }

      const pedidoId = String(checkoutData.pedidoId);

      if (metodoPago === 'whatsapp') {
        trackContact('whatsapp', {
          items: items.map((item) => ({ id: item.productoId, name: item.nombre, price: item.precio, quantity: item.qty })),
          value: checkoutData.total,
        });
        clearCart();
        const mensaje = encodeURIComponent(
          `Hola! Quiero confirmar mi pedido #${pedidoId.slice(0, 8).toUpperCase()} por $${Number(checkoutData.total).toLocaleString('es-CL')}`,
        );
        window.location.href = `https://wa.me/56990816124?text=${mensaje}`;
        return;
      }

      const pagoEndpoint = metodoPago === 'mercadopago' ? '/api/pagos/mercadopago' : '/api/pagos/flow';
      const pagoRes = await fetch(pagoEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedidoId }),
      });
      const pagoData = await pagoRes.json();

      if (!pagoRes.ok) {
        setError(pagoData.error || 'No se pudo iniciar el pago.');
        setLoading(false);
        return;
      }

      clearCart();
      window.location.href = pagoData.init_point || pagoData.url;
    } catch {
      setError('Error de conexión. Intenta de nuevo.');
      setLoading(false);
    }
  }

  if (items.length === 0) {
    return (
      <SiteShell>
        <main className="pt-[100px] px-4 pb-16 text-center">
          <p className="text-muted text-sm mb-4">Tu carrito está vacío 🌱</p>
          <button onClick={() => router.push('/')} className="text-neon underline text-sm">Volver a la tienda</button>
        </main>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <main className="pt-[100px] px-4 pb-16 max-w-[480px] mx-auto">
        <h1 className="font-display font-bold text-xl text-white mb-6">🛒 Finalizar pedido</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input type="hidden" data-testid="checkout-idempotency-key" value={idempotencyKey} readOnly />
          <div className="bg-white/[0.03] border border-[rgba(0,255,179,0.1)] rounded-xl p-4">
            <h2 className="text-sm font-bold text-white mb-3">Tus datos</h2>
            <div className="flex flex-col gap-2.5">
              <input required placeholder="Nombre completo" value={nombre} onChange={(e) => setNombre(e.target.value)} className="bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white" />
              <input required placeholder="Dirección de despacho" value={direccion} onChange={(e) => setDireccion(e.target.value)} className="bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white" />
              <input required placeholder="Teléfono (con código país)" value={telefono} onChange={(e) => setTelefono(e.target.value)} className="bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white" />
              <input type="email" placeholder="Email (opcional, para puntos de fidelidad)" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white" />
            </div>
          </div>

          <div className="bg-white/[0.03] border border-[rgba(0,255,179,0.1)] rounded-xl p-4">
            <h2 className="text-sm font-bold text-white mb-3">Despacho</h2>
            <div className="flex flex-col gap-2.5">
              <select
                required
                value={zonaId}
                onChange={(e) => { setZonaId(e.target.value); setComuna(''); }}
                className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white"
              >
                <option value="" className="bg-[#0d1e16]">— Selecciona tu zona —</option>
                {zonas.map((z) => (
                  <option key={z.id} value={z.id} className="bg-[#0d1e16]">{z.nombre} — ${z.precio.toLocaleString('es-CL')}</option>
                ))}
              </select>

              <select required disabled={!zonaId} value={comuna} onChange={(e) => setComuna(e.target.value)} className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white disabled:opacity-50">
                <option value="" className="bg-[#0d1e16]">— Selecciona tu comuna —</option>
                {comunasDisponibles.map((value) => <option key={value} value={value} className="bg-[#0d1e16]">{value}</option>)}
              </select>

              <select required value={fechaEntrega} onChange={(e) => setFechaEntrega(e.target.value)} className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white">
                <option value="" className="bg-[#0d1e16]">— Selecciona fecha de entrega —</option>
                {deliveryDates.map((date) => <option key={date} value={date} className="bg-[#0d1e16]">{formatDeliveryDateLabel(date)}</option>)}
              </select>
            </div>
          </div>

          <div className="bg-white/[0.03] border border-[rgba(0,255,179,0.1)] rounded-xl p-4">
            <h2 className="text-sm font-bold text-white mb-3">Cupón de descuento (opcional)</h2>
            <input placeholder="Código de cupón" value={cuponCode} onChange={(e) => setCuponCode(e.target.value.toUpperCase())} className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white" />
          </div>

          <div className="bg-white/[0.03] border border-[rgba(0,255,179,0.1)] rounded-xl p-4">
            <h2 className="text-sm font-bold text-white mb-1.5">Instrucciones de entrega / Comentarios</h2>
            <p className="text-xs text-white/50 mb-3">Horario preferido, indicaciones del lugar o notas para tu pedido.</p>
            <textarea rows={2} maxLength={500} placeholder="Ej: Entregar después de las 18:00, tocar timbre depto 402, etc." value={notas} onChange={(e) => setNotas(e.target.value)} className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white resize-none outline-none focus:border-neon" />
          </div>

          <div className="bg-white/[0.03] border border-[rgba(0,255,179,0.1)] rounded-xl p-4">
            <h2 className="text-sm font-bold text-white mb-3">Método de pago</h2>
            <div className="flex flex-col gap-2">
              {[
                { value: 'mercadopago', label: '🟦 Mercado Pago' },
                { value: 'flow', label: '💳 Flow' },
                { value: 'whatsapp', label: '💬 Coordinar por WhatsApp' },
              ].map((opt) => (
                <label key={opt.value} className={`flex items-center gap-2 text-sm px-3 py-2.5 rounded-lg border cursor-pointer ${metodoPago === opt.value ? 'border-neon bg-[rgba(0,255,179,0.05)] text-white' : 'border-white/10 text-white/60'}`}>
                  <input type="radio" name="metodoPago" value={opt.value} checked={metodoPago === opt.value} onChange={() => setMetodoPago(opt.value as typeof metodoPago)} className="accent-[#00ffb3]" />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {error && <div className="bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.3)] text-rojo text-sm rounded-xl p-3">{error}</div>}

          <div className="flex items-center justify-between bg-white/5 rounded-xl p-4">
            <span className="text-sm text-muted">Total estimado*</span>
            <span className="font-display font-bold text-xl text-neon">${totalEstimado.toLocaleString('es-CL')}</span>
          </div>
          <p className="text-[10px] text-muted -mt-2">*El total final (con cupón aplicado) se confirma de forma segura en el servidor antes de procesar el pago.</p>

          <button type="submit" disabled={loading || deliveryDates.length === 0} className="w-full bg-neon text-[#020705] font-bold py-3.5 rounded-full text-sm shadow-[0_0_15px_rgba(0,255,179,0.4)] hover:bg-white transition-all disabled:opacity-50">
            {loading ? 'Procesando...' : 'Confirmar pedido →'}
          </button>
        </form>
      </main>
    </SiteShell>
  );
}

export const dynamic = 'force-dynamic';

export default function CheckoutPage() {
  return <CheckoutContent />;
}
