export async function GET() {
  return Response.json({
    id: '/admin',
    name: 'Wonka Hub — Panel Maestro',
    short_name: 'Wonka Hub',
    description: 'Panel administrativo de La Manito del Vegano para pedidos, conversaciones, CRM, métricas y agentes.',
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
  }, {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'private, max-age=300',
    },
  });
}
