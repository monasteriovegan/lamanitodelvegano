'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { SiteShell } from '@/components/layout/SiteShell';
import { useCart } from '@/lib/cart/CartContext';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Zona } from '@/types/domain';
import { trackContact, trackInitiateCheckout } from '@/lib/analytics/client';

function CheckoutContent() {
  const router = useRouter();
  const { items, subtotal, clearCart } = useCart();
  const idempotencyKey = useRef<string>(crypto.randomUUID());

  const [zonas, setZonas] = useState<Zona[]>([]);
  const [zonaId, setZonaId] = useState('');
  const [cuponCode, setCuponCode] = useState('');
  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
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
    setAttribution(merged);
  }, []);

  // InitiateCheckout / begin_checkout — una vez por carga de la página,
  // con el valor real del carrito en ese momento.
  useEffect(() => {
    if (items.length === 0) return;
    trackInitiateCheckout({
      items: items.map((item) => ({ id: item.productoId, name: item.nombre, price: item.precio, quantity: item.qty })),
      value: subtotal,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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

  // Guarda el carrito en progreso con debounce, solo cuando ya hay forma de
  // contactar al cliente (email o teléfono) y hay al menos un producto.
  // Es la base del recordatorio de carrito abandonado — no bloquea ni
  // afecta el flujo de checkout si falla (fetch silencioso, sin await del
  // resultado en el submit).
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
      }).catch(() => {
        // silencioso a propósito: esto es best-effort, nunca debe
        // interrumpir al cliente completando su compra.
      });
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [items, subtotal, nombre, email, telefono, attribution]);

  const zonaSeleccionada = zonas.find((z) => z.id === zonaId);
  const totalEstimado = subtotal + (zonaSeleccionada?.precio || 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (items.length === 0) return;
    setLoading(true);
    setError(null);

    try {
      const checkoutRes = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: idempotencyKey.current,
          cliente: { nombre, direccion, telefono, email },
          items: items.map((i) => ({ productoId: i.productoId, qty: i.qty, formato: i.formato, variedad: i.variedad })),
          zonaId: zonaId || null,
          cuponCode: cuponCode || null,
          metodoPago,
          attribution,
        }),
      });

      const checkoutData = await checkoutRes.json();
      if (!checkoutRes.ok) {
        setError(checkoutData.error || 'No se pudo procesar el pedido.');
        setLoading(false);
        return;
      }

      const pedidoId = checkoutData.pedidoId;

      if (metodoPago === 'whatsapp') {
        trackContact('whatsapp', {
          items: items.map((item) => ({ id: item.productoId, name: item.nombre, price: item.precio, quantity: item.qty })),
          value: checkoutData.total,
        });
        clearCart();
        const mensaje = encodeURIComponent(
          `Hola! Quiero confirmar mi pedido #${pedidoId.substring(0, 6).toUpperCase()} por $${checkoutData.total.toLocaleString('es-CL')}`
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
          <button onClick={() => router.push('/')} className="text-neon underline text-sm">
            Volver a la tienda
          </button>
        </main>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <main className="pt-[100px] px-4 pb-16 max-w-[480px] mx-auto">
        <h1 className="font-display font-bold text-xl text-white mb-6">🛒 Finalizar pedido</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input type="hidden" data-testid="checkout-idempotency-key" value={idempotencyKey.current} readOnly />
          <div className="bg-white/[0.03] border border-[rgba(0,255,179,0.1)] rounded-xl p-4">
            <h2 className="text-sm font-bold text-white mb-3">Tus datos</h2>
            <div className="flex flex-col gap-2.5">
              <input
                required
                placeholder="Nombre completo"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white"
              />
              <input
                required
                placeholder="Dirección de despacho"
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                className="bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white"
              />
              <input
                required
                placeholder="Teléfono (con código país)"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className="bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white"
              />
              <input
                type="email"
                placeholder="Email (opcional, para puntos de fidelidad)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white"
              />
            </div>
          </div>

          <div className="bg-white/[0.03] border border-[rgba(0,255,179,0.1)] rounded-xl p-4">
            <h2 className="text-sm font-bold text-white mb-3">Zona de despacho</h2>
            <select
              required
              value={zonaId}
              onChange={(e) => setZonaId(e.target.value)}
              className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white"
            >
              <option value="" className="bg-[#0d1e16]">— Selecciona tu zona —</option>
              {zonas.map((z) => (
                <option key={z.id} value={z.id} className="bg-[#0d1e16]">
                  {z.nombre} — ${z.precio.toLocaleString('es-CL')}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-white/[0.03] border border-[rgba(0,255,179,0.1)] rounded-xl p-4">
            <h2 className="text-sm font-bold text-white mb-3">Cupón de descuento (opcional)</h2>
            <input
              placeholder="Código de cupón"
              value={cuponCode}
              onChange={(e) => setCuponCode(e.target.value.toUpperCase())}
              className="w-full bg-white/5 border border-[rgba(0,255,179,0.2)] rounded-lg px-3 py-2.5 text-sm text-white"
            />
          </div>

          <div className="bg-white/[0.03] border border-[rgba(0,255,179,0.1)] rounded-xl p-4">
            <h2 className="text-sm font-bold text-white mb-3">Método de pago</h2>
            <div className="flex flex-col gap-2">
              {[
                { value: 'mercadopago', label: '🟦 Mercado Pago' },
                { value: 'flow', label: '💳 Flow' },
                { value: 'whatsapp', label: '💬 Coordinar por WhatsApp' },
              ].map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-center gap-2 text-sm px-3 py-2.5 rounded-lg border cursor-pointer ${
                    metodoPago === opt.value
                      ? 'border-neon bg-[rgba(0,255,179,0.05)] text-white'
                      : 'border-white/10 text-white/60'
                  }`}
                >
                  <input
                    type="radio"
                    name="metodoPago"
                    value={opt.value}
                    checked={metodoPago === opt.value}
                    onChange={() => setMetodoPago(opt.value as typeof metodoPago)}
                    className="accent-[#00ffb3]"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {error && (
            <div className="bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.3)] text-rojo text-sm rounded-xl p-3">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between bg-white/5 rounded-xl p-4">
            <span className="text-sm text-muted">Total estimado*</span>
            <span className="font-display font-bold text-xl text-neon">${totalEstimado.toLocaleString('es-CL')}</span>
          </div>
          <p className="text-[10px] text-muted -mt-2">
            *El total final (con cupón aplicado) se confirma de forma segura en el servidor antes de procesar el pago.
          </p>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-neon text-[#020705] font-bold py-3.5 rounded-full text-sm shadow-[0_0_15px_rgba(0,255,179,0.4)] hover:bg-white transition-all disabled:opacity-50"
          >
            {loading ? 'Procesando...' : 'Confirmar pedido →'}
          </button>
        </form>
      </main>
    </SiteShell>
  );
}

// Esta página depende del carrito del navegador y de datos en tiempo real
// (zonas), así que no tiene sentido cachearla como estática.
export const dynamic = 'force-dynamic';

export default function CheckoutPage() {
  return <CheckoutContent />;
}
