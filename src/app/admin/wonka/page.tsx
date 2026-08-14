import { requireRole } from '@/lib/supabase/require-role';
import WonkaHubClient from './WonkaHubClient';

export default async function WonkaHubPage() {
  await requireRole(['admin']);
  return <WonkaHubClient />;
}
