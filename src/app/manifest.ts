import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/admin',
    name: 'Synthetiq Panel Maestro',
    short_name: 'Synthetiq',
    description: 'Panel maestro de Synthetiq para dirigir negocios, conversaciones, CRM, pedidos, métricas y agentes como Wonka y Remy.',
    start_url: '/admin',
    scope: '/admin',
    display: 'standalone',
    background_color: '#020705',
    theme_color: '#00ffb3',
    orientation: 'portrait-primary',
    categories: ['business', 'productivity'],
    icons: [
      { src: '/api/wonka-icon/192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/api/wonka-icon/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/api/wonka-icon/512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
