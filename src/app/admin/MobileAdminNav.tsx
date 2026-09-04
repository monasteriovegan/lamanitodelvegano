'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

type DeferredInstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const primary = [
  { href: '/admin', icon: '🏠', label: 'Inicio', exact: true },
  { href: '/admin/conversaciones', icon: '💬', label: 'Chats' },
  { href: '/admin/pedidos', icon: '📦', label: 'Pedidos' },
  { href: '/admin/clientes', icon: '👥', label: 'CRM' },
];

const more = [
  { href: '/admin/productos', icon: '🌿', label: 'Catálogo Master' },
  { href: '/admin/temporadas', icon: '📅', label: 'Temporadas' },
  { href: '/admin/categorias', icon: '🏷️', label: 'Categorías' },
  { href: '/admin/entregas', icon: '🗓️', label: 'Entregas & Días' },
  { href: '/admin/zonas', icon: '🚚', label: 'Envíos' },
  { href: '/admin/metricas', icon: '📊', label: 'Ventas & Métricas' },
  { href: '/admin/cupones', icon: '🎟️', label: 'Cupones' },
  { href: '/admin/recetas', icon: '🍳', label: 'Recetas & Costos' },
  { href: '/admin/ingredientes', icon: '🥕', label: 'Ingredientes' },
  { href: '/admin/media', icon: '🎬', label: 'Creativos Meta' },
  { href: '/admin/wonka', icon: '🎩', label: 'Wonka Hub' },
  { href: '/admin/agentes', icon: '🤖', label: 'Agentes & Modelos' },
  { href: '/admin/computer', icon: '🖥️', label: 'Synthetiq Computer' },
  { href: '/admin/uso-costos', icon: '💸', label: 'Automatizaciones' },
  { href: '/admin/integraciones', icon: '🔌', label: 'Integraciones' },
  { href: '/admin/ajustes', icon: '⚙️', label: 'Configuración' },
  { href: '/admin/blog', icon: '✍️', label: 'Blog' },
  { href: '/admin/mensajes', icon: '✉️', label: 'Contacto Web' },
];

function active(pathname: string, href: string, exact?: boolean) { return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`); }

export function MobileAdminNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<DeferredInstallPrompt | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [installHelp, setInstallHelp] = useState<string | null>(null);

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    setStandalone(isStandalone);
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/wonka-sw.js', { scope: '/' }).catch(() => undefined);
    const beforeInstall = (event: Event) => { event.preventDefault(); setInstallPrompt(event as DeferredInstallPrompt); setInstallHelp(null); };
    const installed = () => { setStandalone(true); setInstallPrompt(null); setInstallHelp(null); };
    window.addEventListener('beforeinstallprompt', beforeInstall); window.addEventListener('appinstalled', installed);
    return () => { window.removeEventListener('beforeinstallprompt', beforeInstall); window.removeEventListener('appinstalled', installed); };
  }, []);

  async function installApp() {
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice.catch(() => null);
      if (choice?.outcome === 'accepted') setStandalone(true);
      setInstallPrompt(null); return;
    }
    setInstallHelp('En Chrome toca ⋮ y elige “Instalar aplicación” o “Añadir a pantalla principal”. Si no aparece, recarga esta página una vez.');
  }

  return <>
    {open && <div className="fixed inset-0 z-[780] md:hidden">
      <button className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} aria-label="Cerrar menú" />
      <section className="absolute inset-x-3 bottom-[86px] max-h-[72dvh] overflow-y-auto overscroll-contain rounded-3xl border border-white/10 bg-[#06110c] p-3 shadow-2xl">
        <div className="flex items-center justify-between px-2 py-2"><div><div className="text-[10px] uppercase tracking-[0.18em] text-neon/65">Synthetiq Panel Maestro</div><div className="mt-1 text-base font-black text-white">Más herramientas</div></div><button onClick={() => setOpen(false)} className="h-10 w-10 rounded-full border border-white/10 text-lg text-white/60" aria-label="Cerrar menú">×</button></div>
        {!standalone && <div className="mb-3 rounded-2xl border border-neon/25 bg-neon/[0.07] p-3"><button onClick={() => void installApp()} className="flex min-h-12 w-full items-center gap-3 text-left"><span className="text-2xl">📲</span><span className="min-w-0"><span className="block text-sm font-black text-neon">Instalar Panel Maestro</span><span className="mt-0.5 block text-[10px] leading-4 text-white/45">Abrirlo como app desde la pantalla de inicio</span></span></button>{installHelp && <p className="mt-2 border-t border-white/8 pt-2 text-[10px] leading-4 text-white/55">{installHelp}</p>}</div>}
        <div className="grid grid-cols-2 gap-2">{more.map((item) => <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={`flex min-h-12 items-center rounded-2xl border px-3 py-3 text-sm font-semibold ${active(pathname, item.href) ? 'border-neon/35 bg-neon/12 text-neon' : 'border-white/8 bg-white/[0.03] text-white/70'}`}><span className="mr-2">{item.icon}</span>{item.label}</Link>)}</div>
      </section>
    </div>}
    <nav className="fixed inset-x-0 bottom-0 z-[800] md:hidden border-t border-white/10 bg-[#04100b]/95 backdrop-blur-xl px-2 pt-1.5 pb-[max(6px,env(safe-area-inset-bottom))] shadow-[0_-12px_35px_rgba(0,0,0,0.45)]">
      <div className="grid grid-cols-5 gap-1">{primary.map((item) => { const isActive = active(pathname, item.href, item.exact); return <Link key={item.href} href={item.href} className={`flex min-h-[54px] flex-col items-center justify-center rounded-2xl text-[10px] font-bold ${isActive ? 'bg-neon/12 text-neon' : 'text-white/55'}`}><span className="text-lg leading-none">{item.icon}</span><span className="mt-1">{item.label}</span></Link>; })}<button onClick={() => setOpen((value) => !value)} className={`flex min-h-[54px] flex-col items-center justify-center rounded-2xl text-[10px] font-bold ${open ? 'bg-neon/12 text-neon' : 'text-white/55'}`}><span className="text-lg leading-none">☰</span><span className="mt-1">Más</span></button></div>
    </nav>
  </>;
}
