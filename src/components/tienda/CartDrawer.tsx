'use client';

import Link from 'next/link';
import { useCart, itemKey } from '@/lib/cart/CartContext';

export function CartDrawer() {
  const { items, isOpen, closeCart, changeQty, subtotal } = useCart();

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/60 z-[350]" onClick={closeCart} />}
      <aside
        className={`fixed top-0 right-0 h-full w-full max-w-[400px] glass z-[360] transition-transform duration-300 flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between p-5 border-b border-[rgba(0,255,179,0.1)]">
          <h2 className="font-display font-bold text-lg text-white">🛒 Tu pedido</h2>
          <button onClick={closeCart} className="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {items.length === 0 ? (
            <div className="text-center text-muted text-sm py-10">
              <p className="mb-3">Tu carrito está vacío 🌱</p>
              <button onClick={closeCart} className="text-neon underline text-sm">
                Seguir viendo productos
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {items.map((item) => {
                const key = itemKey(item);
                return (
                  <div key={key} className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
                    <span className="text-2xl">{item.emoji}</span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-white">{item.nombre}</p>
                      {(item.formato || item.variedad) && (
                        <p className="text-[11px] text-muted">
                          {[item.variedad, item.formato].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      <p className="text-xs text-neon font-bold">${item.precio.toLocaleString('es-CL')}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => changeQty(key, -1)}
                        className="w-6 h-6 rounded-md bg-white/10 text-white text-xs flex items-center justify-center"
                      >
                        −
                      </button>
                      <span className="text-xs font-bold text-white min-w-[14px] text-center">{item.qty}</span>
                      <button
                        onClick={() => changeQty(key, 1)}
                        className="w-6 h-6 rounded-md bg-neon text-[#020705] text-xs flex items-center justify-center"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="p-5 border-t border-[rgba(0,255,179,0.1)]">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-muted">Subtotal</span>
              <span className="font-display font-bold text-xl text-neon">${subtotal.toLocaleString('es-CL')}</span>
            </div>
            <Link
              href="/checkout"
              onClick={closeCart}
              className="block w-full text-center bg-neon text-[#020705] font-bold py-3 rounded-full text-sm shadow-[0_0_15px_rgba(0,255,179,0.4)] transition-all hover:bg-white"
            >
              Continuar al pago →
            </Link>
          </div>
        )}
      </aside>
    </>
  );
}
