import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Wonka Hub · Synthetiq',
    short_name: 'Wonka Hub',
    description: 'Director personal y operativo de Synthetiq y La Manito del Vegano.',
    start_url: '/admin/wonka',
    scope: '/',
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
