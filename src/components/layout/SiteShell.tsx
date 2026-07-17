'use client';

import { useState, useEffect } from 'react';
import { CartProvider, useCart } from '@/lib/cart/CartContext';
import { Navbar } from './Navbar';
import { CartDrawer } from '@/components/tienda/CartDrawer';
import { FloatingEffects } from './FloatingEffects';
import { Chatbot } from './Chatbot';
import { Footer } from './Footer';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

function NavbarConCarrito({ shiftDown }: { shiftDown: boolean }) {
  const { count, openCart } = useCart();
  return <Navbar cartCount={count} onCartClick={openCart} shiftDown={shiftDown} />;
}

export function SiteShell({ children }: { children: React.ReactNode }) {
  const [tallerCerrado, setTallerCerrado] = useState(false);

  useEffect(() => {
    async function loadAjustes() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase
          .from('ajustes')
          .select('data')
          .eq('id', 'global')
          .maybeSingle();

        if (!error && data?.data) {
          setTallerCerrado(data.data.estado === 'cerrado');
        }
      } catch (err) {
        console.error('Error cargando estado del taller:', err);
      }
    }
    loadAjustes();
  }, []);

  return (
    <CartProvider>
      {tallerCerrado && (
        <div
          style={{
            background: 'var(--rojo)',
            color: 'white',
            padding: '8px 12px',
            textAlign: 'center',
            fontSize: '11px',
            fontWeight: 700,
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            zIndex: 9999,
            boxShadow: '0 2px 10px rgba(239,68,68,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          ⚠️ Taller Cerrado Temporalmente por alta demanda. Estaremos agendando nuevamente muy pronto.
        </div>
      )}
      <FloatingEffects />
      <NavbarConCarrito shiftDown={tallerCerrado} />
      <div className="flex-1" style={{ paddingTop: tallerCerrado ? '36px' : '0px', transition: 'padding 0.3s ease' }}>
        {children}
      </div>
      <CartDrawer />
      <Chatbot />
      <Footer />
    </CartProvider>
  );
}
