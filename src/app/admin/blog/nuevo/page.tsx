import BlogForm from '../BlogForm';
import { requireRole } from '@/lib/supabase/require-role';
import Link from 'next/link';

export default async function NuevoBlogPostPage() {
  await requireRole(['admin']);

  return (
    <div className="max-w-[860px] text-crema">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-neon font-semibold mb-1.5">✦ Contenido</p>
          <h1 className="font-display font-bold text-2xl md:text-3xl text-white">Nuevo Artículo</h1>
        </div>
        <Link
          href="/admin/blog"
          className="text-muted hover:text-white text-xs font-semibold"
        >
          ← Volver al blog
        </Link>
      </div>

      <BlogForm />
    </div>
  );
}
