import type { MetadataRoute } from 'next';
import { OFFICIAL_SITE_URL } from '@/lib/site-url';

export default function sitemap(): MetadataRoute.Sitemap {
  return ['', '/nosotros', '/contacto', '/blog', '/privacidad', '/terminos', '/eliminacion-de-datos']
    .map((path) => ({ url: `${OFFICIAL_SITE_URL}${path}`, changeFrequency: path === '' ? 'weekly' : 'monthly' }));
}
