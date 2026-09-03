import { requireRole } from '@/lib/supabase/require-role';
import ConversationsClient from './ConversationsClient';
import RemyInstagramToggle from './RemyInstagramToggle';

export default async function ConversacionesPage() {
  await requireRole(['admin', 'soporte']);
  return (
    <div className="relative">
      <div className="fixed right-3 top-16 z-[70] sm:right-5 sm:top-20">
        <RemyInstagramToggle />
      </div>
      <ConversationsClient />
    </div>
  );
}
