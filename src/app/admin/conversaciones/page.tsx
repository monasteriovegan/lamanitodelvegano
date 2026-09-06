import { requireRole } from '@/lib/supabase/require-role';
import ConversationsClient from './ConversationsClient';
import RemyGlobalToggle from './RemyGlobalToggle';
import RemyInstagramToggle from './RemyInstagramToggle';

export default async function ConversacionesPage() {
  const admin = await requireRole(['admin', 'soporte']);
  return (
    <div className="relative">
      <div className="fixed right-3 top-16 z-[70] flex flex-col gap-2 sm:right-5 sm:top-20">
        {admin.rol === 'admin' ? <RemyGlobalToggle /> : null}
        <RemyInstagramToggle />
      </div>
      <ConversationsClient />
    </div>
  );
}
