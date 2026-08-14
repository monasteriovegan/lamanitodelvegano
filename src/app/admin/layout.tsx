import { redirect } from 'next/navigation';
import { getCurrentAdminUser } from '@/lib/supabase/server-auth';
import { AdminSidebar } from './AdminSidebar';
import { WonkaFloatingDirector } from './WonkaFloatingDirector';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  let admin = null;
  try {
    admin = await getCurrentAdminUser();
  } catch (err) {
    console.error('AdminLayout error:', err);
    redirect('/admin/login');
  }

  if (!admin) redirect('/admin/login');

  return (
    <div className="min-h-screen bg-fondo flex relative">
      <AdminSidebar email={admin.email || ''} rol={(admin.rol as 'admin' | 'soporte' | 'bodega') || 'admin'} />

      <main className="flex-1 p-4 md:p-8 overflow-x-hidden pb-24 md:pb-8 bg-[#030907]">
        {children}
      </main>

      <WonkaFloatingDirector />
    </div>
  );
}
