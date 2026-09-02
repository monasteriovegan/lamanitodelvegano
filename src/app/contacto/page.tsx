'use client';

import { useState } from 'react';
import { SiteShell } from '@/components/layout/SiteShell';
import { trackContact } from '@/lib/analytics/client';

const FAQS = [
  {
    q: '¿Hacen despacho a todo Santiago?',
    a: 'Sí, cubrimos Santiago Centro, Oriente, Sur y Poniente con costos de envío distintos según zona. También hacemos despacho en Pucón.',
  },
  {
    q: '¿Cuánto tiempo de anticipación necesito para pedir?',
    a: 'Generalmente pedimos al menos 3 días de anticipación, ya que todo se elabora de forma artesanal. Algunos productos de temporada pueden tener fechas especiales de despacho.',
  },
  {
    q: '¿Todos los productos son 100% veganos?',
    a: 'Sí, sin excepción. Todo nuestro taller trabaja exclusivamente con ingredientes 100% plant-based.',
  },
  {
    q: '¿Tienen opciones sin gluten o sin nueces?',
    a: 'Sí, varios de nuestros productos son aptos para personas con intolerancia al gluten o alergia a las nueces. Revisa los badges en cada producto del catálogo.',
  },
  {
    q: '¿Cómo funciona el programa de puntos?',
    a: 'Por cada compra acumulas puntos que luego puedes canjear como descuento en tu siguiente pedido. Protegemos tus puntos con un PIN de 4 dígitos que tú eliges.',
  },
];

export default function ContactoPage() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <SiteShell>
      <main className="pt-[100px] px-4 pb-16 max-w-[600px] mx-auto">
        <div className="text-center mb-8">
          <span className="pill mb-3">💬 Contacto</span>
          <h1 className="font-display font-extrabold text-2xl text-white mb-2 leading-tight">
            ¿Tienes dudas o quieres hacer un{' '}
            <em className="text-[#B7E4C7] not-italic" style={{ fontStyle: 'italic', textShadow: '0 0 20px rgba(183,228,199,0.3)' }}>
              pedido especial?
            </em>
          </h1>
          <p className="text-xs text-muted">Contáctanos por nuestros canales oficiales</p>
        </div>

        {/* TARJETAS DE CONTACTO */}
        <div className="contcards mb-8">
          <a
            href="https://wa.me/56990816124"
            target="_blank"
            rel="noopener noreferrer"
            className="cc"
            onClick={() => trackContact('whatsapp')}
          >
            <div className="cci">💬</div>
            <div>
              <h3 className="cch3">WhatsApp</h3>
              <p className="ccp">+56 9 9081 6124</p>
            </div>
          </a>

          <a
            href="https://instagram.com/lamanitodelvegano"
            target="_blank"
            rel="noopener noreferrer"
            className="cc"
            onClick={() => trackContact('instagram')}
          >
            <div className="cci">📸</div>
            <div>
              <h3 className="cch3">Instagram</h3>
              <p className="ccp">@lamanitodelvegano</p>
            </div>
          </a>

          <div className="cc cursor-default">
            <div className="cci">📍</div>
            <div>
              <h3 className="cch3">Despachos en</h3>
              <p className="ccp">Santiago &amp; Pucón · Chile</p>
            </div>
          </div>
        </div>

        <h2 className="font-display font-bold text-lg text-white mb-4 text-center">❓ Preguntas frecuentes</h2>
        <div className="flex flex-col gap-2">
          {FAQS.map((faq, idx) => (
            <div key={idx} className="bg-white/[0.03] border border-[rgba(0,255,179,0.1)] rounded-xl overflow-hidden">
              <button
                onClick={() => setOpenIdx(openIdx === idx ? null : idx)}
                className="w-full flex items-center justify-between p-4 text-left"
              >
                <span className="text-sm font-semibold text-white">{faq.q}</span>
                <span className="text-neon text-xs">{openIdx === idx ? '▲' : '▼'}</span>
              </button>
              {openIdx === idx && (
                <p className="px-4 pb-4 text-xs text-white/70 leading-relaxed">{faq.a}</p>
              )}
            </div>
          ))}
        </div>
      </main>
    </SiteShell>
  );
}
