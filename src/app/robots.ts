import type { MetadataRoute } from 'next';
import { OFFICIAL_SITE_URL } from '@/lib/site-url';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin/', '/api/', '/internal-'] },
    sitemap: `${OFFICIAL_SITE_URL}/sitemap.xml`,
    host: OFFICIAL_SITE_URL,
  };
}
