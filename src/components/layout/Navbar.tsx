'use client';

import Link from 'next/link';
import { useState } from 'react';

interface NavbarProps {
  cartCount: number;
  onCartClick: () => void;
  shiftDown?: boolean;
}

const NAV_LINKS = [
  { href: '/', label: 'Inicio' },
  { href: '/nosotros', label: 'Nosotros' },
  { href: '/blog', label: 'Blog' },
  { href: '/contacto', label: 'Contacto' },
  { href: '/seguimiento', label: '📍 Rastrear' },
];

export function Navbar({ cartCount, onCartClick, shiftDown = false }: NavbarProps) {
  const [open, setOpen] = useState(false);

  return (
    <nav
      className="glass fixed left-1/2 -translate-x-1/2 z-[300] w-[calc(100%-32px)] max-w-[1100px] h-[60px] rounded-[50px] px-6 flex items-center justify-between shadow-[0_8px_32px_rgba(0,255,179,0.05)] transition-all duration-300"
      style={{ top: shiftDown ? '52px' : '16px' }}
    >
      <Link href="/" className="flex items-center gap-2.5">
        <span className="w-[34px] h-[34px] rounded-full bg-[rgba(0,255,179,0.15)] border border-[rgba(0,255,179,0.3)] flex items-center justify-center text-base">
          🌱
        </span>
        <span className="font-display font-extrabold text-sm leading-tight text-white">
          La Manito Del Vegano
          <small className="block text-[9px] font-body font-normal opacity-65 tracking-wider uppercase text-neon">
            Plant Based · Chile
          </small>
        </span>
      </Link>

      <div className="hidden md:flex gap-0.5">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-neon px-3 py-1.5 rounded-full text-[11px] border border-[rgba(0,255,179,0.15)] bg-[rgba(0,255,179,0.05)] whitespace-nowrap transition-all hover:bg-neon hover:text-[#020705] hover:font-bold"
          >
            {link.label}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onCartClick}
          aria-label="Abrir carrito"
          className="relative bg-[rgba(0,255,179,0.08)] border border-[rgba(0,255,179,0.2)] text-neon w-9 h-9 rounded-full flex items-center justify-center transition-all hover:bg-[rgba(0,255,179,0.15)] hover:scale-105"
        >
          🛒
          {cartCount > 0 && (
            <span className="absolute -top-[3px] -right-[3px] bg-rojo text-white w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center">
              {cartCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setOpen(!open)}
          className="md:hidden bg-[rgba(255,255,255,0.06)] text-white/80 border border-white/10 w-9 h-9 rounded-full flex items-center justify-center"
          aria-label="Abrir menú"
        >
          ☰
        </button>
      </div>

      {open && (
        <div className="absolute top-[70px] left-0 right-0 glass rounded-2xl p-3 flex flex-col gap-1 md:hidden">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="text-neon px-4 py-2.5 rounded-xl text-sm hover:bg-[rgba(0,255,179,0.08)]"
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
