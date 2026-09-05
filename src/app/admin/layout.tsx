import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentAdminUser } from '@/lib/supabase/server-auth';
import { AdminSidebar } from './AdminSidebar';
import { WonkaFloatingDirector } from './WonkaFloatingDirector';
import { MobileAdminNav } from './MobileAdminNav';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  manifest: '/admin/manifest.webmanifest',
  robots: { index: false, follow: false },
};

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
      <div className="hidden md:block shrink-0">
        <AdminSidebar email={admin.email || ''} rol={(admin.rol as 'admin' | 'soporte' | 'bodega') || 'admin'} />
      </div>

      <main className="min-w-0 flex-1 overflow-x-hidden bg-[#030907] px-3 pt-4 pb-28 sm:px-4 md:p-8 md:pb-8">
        <div className="mx-auto w-full max-w-[1600px]">
          {children}
        </div>
      </main>

      <MobileAdminNav />
      <WonkaFloatingDirector />
    </div>
  );
}
