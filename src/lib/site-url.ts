export const OFFICIAL_SITE_URL = 'https://lamanitodelvegano.cl';
export const LEGACY_VERCEL_URL = 'https://lamanitodelvegano.vercel.app';

export function runtimeSiteUrl() {
  return String(process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || LEGACY_VERCEL_URL)
    .trim()
    .replace(/\/$/, '');
}
