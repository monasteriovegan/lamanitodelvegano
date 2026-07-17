import { redirect } from 'next/navigation';
import { getCurrentAdminUser } from '@/lib/supabase/server-auth';
import { AdminSidebar } from './AdminSidebar';

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
      {/* Desktop Sidebar */}
      <AdminSidebar email={admin.email || ''} />

      {/* Main Content Area */}
      <main className="flex-1 p-4 md:p-8 overflow-x-hidden pb-20 md:pb-8 bg-[#030907]">
        {children}
      </main>

      {/* Gorilla Monk Easter Egg */}
      <div className="fixed bottom-4 right-4 w-[60px] h-[60px] rounded-full border-2 border-neon shadow-[0_0_15px_rgba(0,255,179,0.3)] overflow-hidden z-[500] hover:scale-110 transition-transform cursor-pointer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/monk_gorilla.png" alt="Monasterio Monk Gorilla" className="w-full h-full object-cover" />
      </div>
    </div>
  );
}
