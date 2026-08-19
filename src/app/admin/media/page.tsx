import { requireRole } from '@/lib/supabase/require-role';
import { PageHeader, SectionCard } from '../_ui/AdminUI';
import { MediaUploader } from './MediaUploader';

export const dynamic = 'force-dynamic';

export default async function AdminMediaPage() {
  await requireRole(['admin']);

  return (
    <div className="max-w-3xl">
      <PageHeader eyebrow="Marketing · Meta Ads" title="📸 Fotos & videos" />
      <p className="-mt-6 mb-7 max-w-2xl text-sm leading-6 text-white/50">
        Sube un creativo y obtén un URL público directo para usarlo en campañas, anuncios o integraciones de Meta.
      </p>

      <SectionCard title="Subir creativo">
        <MediaUploader />
      </SectionCard>
    </div>
  );
}
