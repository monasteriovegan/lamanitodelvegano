'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const primary = [
  { href: '/admin', icon: '🏠', label: 'Inicio', exact: true },
  { href: '/admin/conversaciones', icon: '💬', label: 'Chats' },
  { href: '/admin/pedidos', icon: '📦', label: 'Pedidos' },
  { href: '/admin/clientes', icon: '👥', label: 'CRM' },
];

const more = [
  { href: '/admin/wonka', icon: '🎩', label: 'Wonka Hub' },
  { href: '/admin/productos', icon: '🌿', label: 'Productos' },
  { href: '/admin/categorias', icon: '🏷️', label: 'Categorías' },
  { href: '/admin/destacados', icon: '⭐', label: 'Destacados' },
  { href: '/admin/temporadas', icon: '🍂', label: 'Temporadas' },
  { href: '/admin/ingredientes', icon: '🥕', label: 'Ingredientes' },
  { href: '/admin/recetas', icon: '🍳', label: 'Recetas & Costos' },
  { href: '/admin/reservas', icon: '📅', label: 'Reservas' },
  { href: '/admin/zonas', icon: '🚚', label: 'Envíos' },
  { href: '/admin/entregas', icon: '🗓️', label: 'Días de Entrega' },
  { href: '/admin/metricas', icon: '📊', label: 'Métricas' },
  { href: '/admin/cupones', icon: '🎟️', label: 'Cupones' },
  { href: '/admin/blog', icon: '✍️', label: 'Blog' },
  { href: '/admin/mensajes', icon: '✉️', label: 'Contacto' },
  { href: '/admin/ajustes', icon: '⚙️', label: 'Ajustes' },
  { href: '/admin/integraciones', icon: '🔌', label: 'Integraciones' },
];

function active(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileAdminNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-[780] md:hidden">
          <button className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} aria-label="Cerrar menú" />
          <section className="absolute inset-x-3 bottom-[86px] max-h-[68vh] overflow-y-auto rounded-3xl border border-white/10 bg-[#06110c] p-3 shadow-2xl">
            <div className="flex items-center justify-between px-2 py-2">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-neon/65">Synthetiq Panel</div>
                <div className="mt-1 text-base font-black text-white">Más herramientas</div>
              </div>
              <button onClick={() => setOpen(false)} className="h-9 w-9 rounded-full border border-white/10 text-white/60">×</button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {more.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`rounded-2xl border px-3 py-3 text-sm font-semibold ${active(pathname, item.href) ? 'border-neon/35 bg-neon/12 text-neon' : 'border-white/8 bg-white/[0.03] text-white/70'}`}
                >
                  <span className="mr-2">{item.icon}</span>{item.label}
                </Link>
              ))}
            </div>
          </section>
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-[800] md:hidden border-t border-white/10 bg-[#04100b]/95 backdrop-blur-xl px-2 pt-2 pb-[max(8px,env(safe-area-inset-bottom))] shadow-[0_-12px_35px_rgba(0,0,0,0.45)]">
        <div className="grid grid-cols-5 gap-1">
          {primary.map((item) => {
            const isActive = active(pathname, item.href, item.exact);
            return (
              <Link key={item.href} href={item.href} className={`flex min-h-[56px] flex-col items-center justify-center rounded-2xl text-[10px] font-bold ${isActive ? 'bg-neon/12 text-neon' : 'text-white/55'}`}>
                <span className="text-lg leading-none">{item.icon}</span>
                <span className="mt-1">{item.label}</span>
              </Link>
            );
          })}
          <button onClick={() => setOpen((value) => !value)} className={`flex min-h-[56px] flex-col items-center justify-center rounded-2xl text-[10px] font-bold ${open ? 'bg-neon/12 text-neon' : 'text-white/55'}`}>
            <span className="text-lg leading-none">☰</span>
            <span className="mt-1">Más</span>
          </button>
        </div>
      </nav>
    </>
  );
}
