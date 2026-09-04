import { requireRole } from '@/lib/supabase/require-role';
import SeasonCatalogEditor from './SeasonCatalogEditor';

interface PageProps { params: Promise<{ id: string }> }

export default async function SeasonCatalogPage({ params }: PageProps) {
  await requireRole(['admin']);
  const { id } = await params;
  return <SeasonCatalogEditor seasonId={id} />;
}
