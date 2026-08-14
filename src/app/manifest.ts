import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Synthetiq Panel · Wonka Director',
    short_name: 'Synthetiq',
    description: 'Panel maestro operativo con Wonka Director para administrar La Manito del Vegano y futuros negocios.',
    start_url: '/admin',
    scope: '/admin',
    display: 'standalone',
    background_color: '#020705',
    theme_color: '#00ffb3',
    orientation: 'any',
    categories: ['business', 'productivity'],
    icons: [
      { src: '/api/wonka-icon/192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/api/wonka-icon/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/api/wonka-icon/512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
