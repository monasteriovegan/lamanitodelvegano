'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogoutButton } from './LogoutButton';

const TABS = [
  { href: '/admin/productos', label: '🌿 Productos' },
  { href: '/admin/categorias', label: '🏷️ Categorías' },
  { href: '/admin/zonas', label: '🚚 Envíos' },
  { href: '/admin/cupones', label: '🎟️ Cupones' },
  { href: '/admin/pedidos', label: '📦 Pedidos' },
  { href: '/admin/metricas', label: '📊 Métricas' },
  { href: '/admin/ajustes', label: '⚙️ Ajustes' },
  { href: '/admin/integraciones', label: '🔌 Integraciones' },
];

export function AdminSidebar({ email }: { email: string }) {
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

      {/* Tabs */}
      <nav className="admin-smenu">
        {TABS.map((tab) => {
          const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/');
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`atab ${isActive ? 'on' : ''}`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="mt-4 mb-4 px-2.5">
        <p className="text-[10px] text-muted truncate max-w-[200px]" title={email}>
          👤 {email}
        </p>
      </div>

      {/* Logout Button */}
      <LogoutButton />
    </aside>
  );
}
