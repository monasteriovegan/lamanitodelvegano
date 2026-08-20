import { requireRole } from '@/lib/supabase/require-role';
import ConversationSalesClient from './ConversationSalesClient';

export const dynamic = 'force-dynamic';

export default async function ConversationSalesPage() {
  await requireRole(['admin', 'owner', 'supervisor']);
  return <ConversationSalesClient />;
}
