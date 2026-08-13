import { requireRole } from '@/lib/supabase/require-role';
import ConversationsClient from './ConversationsClient';

export default async function ConversacionesPage() {
  await requireRole(['admin', 'soporte']);
  return <ConversationsClient />;
}
