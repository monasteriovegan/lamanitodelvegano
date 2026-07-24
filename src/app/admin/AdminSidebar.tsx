'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogoutButton } from './LogoutButton';

type Rol = 'admin' | 'soporte' | 'bodega';

const GRUPOS = [
  {
    label: null,
    tabs: [{ href: '/admin', label: '🏠 Inicio', exact: true, roles: ['admin', 'soporte', 'bodega'] as Rol[] }],
  },
  {
    label: 'Catálogo',
    tabs: [
      { href: '/admin/productos', label: '🌿 Productos', exact: false, roles: ['admin', 'bodega'] as Rol[] },
      { href: '/admin/categorias', label: '🏷️ Categorías', exact: false, roles: ['admin'] as Rol[] },
      { href: '/admin/destacados', label: '⭐ Destacados', exact: false, roles: ['admin'] as Rol[] },
    ],
  },
  {
    label: 'Ventas',
    tabs: [
      { href: '/admin/pedidos', label: '📦 Pedidos', exact: false, roles: ['admin', 'soporte', 'bodega'] as Rol[] },
      { href: '/admin/zonas', label: '🚚 Envíos', exact: false, roles: ['admin'] as Rol[] },
      { href: '/admin/metricas', label: '📊 Métricas', exact: false, roles: ['admin'] as Rol[] },
    ],
  },
  {
    label: 'Marketing',
    tabs: [
      { href: '/admin/cupones', label: '🎟️ Cupones', exact: false, roles: ['admin', 'soporte'] as Rol[] },
      { href: '/admin/promo-flyer', label: '📢 Promo Flyer', exact: false, roles: ['admin'] as Rol[] },
    ],
  },
  {
    label: 'Sistema',
    tabs: [
      { href: '/admin/ajustes', label: '⚙️ Ajustes', exact: false, roles: ['admin'] as Rol[] },
      { href: '/admin/integraciones', label: '🔌 Integraciones', exact: false, roles: ['admin'] as Rol[] },
    ],
  },
];

const ROL_LABEL: Record<Rol, string> = {
  admin: 'Administrador',
  soporte: 'Soporte',
  bodega: 'Bodega',
};

export function AdminSidebar({ email, rol }: { email: string; rol: Rol }) {
  const pathname = usePathname();

  return (
    <aside className="admin-side">
      {/* Logo */}
      <div className="admin-slogo">
        <span>🌱</span>
        <div style={{ lineHeight: 1.2 }}>
          <div style={{ fontWeight: 800, fontSize: '15px', letterSpacing: '0.5px', color: 'white' }}>
            La Manito
          </div>
          <div style={{ fontSize: '10px', opacity: 0.65, fontWeight: 600, color: '#2ecc71' }}>
            Panel de Control
          </div>
        </div>
      </div>

      {/* Navegación agrupada — filtrada por rol. El bloqueo real (si alguien
          escribe la URL a mano) vive en cada page.tsx vía requireRole(),
          esto solo evita mostrar botones que igual no podrían usar. */}
      <nav className="admin-smenu">
        {GRUPOS.map((grupo, i) => {
          const tabsVisibles = grupo.tabs.filter((tab) => tab.roles.includes(rol));
          if (tabsVisibles.length === 0) return null;

          return (
            <div key={i} className={i > 0 ? 'mt-3' : ''}>
              {grupo.label && (
                <p className="text-[10px] uppercase tracking-[0.12em] text-white/25 font-semibold px-3.5 mb-1.5 mt-2">
                  {grupo.label}
                </p>
              )}
              {tabsVisibles.map((tab) => {
                const isActive = tab.exact
                  ? pathname === tab.href
                  : pathname === tab.href || pathname.startsWith(tab.href + '/');
                return (
                  <Link key={tab.href} href={tab.href} className={`atab ${isActive ? 'on' : ''}`}>
                    {tab.label}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="mt-4 mb-4 px-2.5">
        <p className="text-[10px] text-muted truncate max-w-[200px]" title={email}>
          👤 {email}
        </p>
        <p className="text-[10px] font-semibold" style={{ color: '#00ffb3' }}>
          {ROL_LABEL[rol]}
        </p>
      </div>

      {/* Logout Button */}
      <LogoutButton />
    </aside>
  );
}
