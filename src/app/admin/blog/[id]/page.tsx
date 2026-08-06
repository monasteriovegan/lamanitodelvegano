import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/supabase/require-role';
import BlogForm from '../BlogForm';
import { notFound } from 'next/navigation';
import Link from 'next/link';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditarBlogPostPage({ params }: PageProps) {
  await requireRole(['admin']);
  const { id } = await params;

  const supabase = createSupabaseServiceClient();
  const { data: post } = await supabase.from('blog_posts').select('*').eq('id', id).single();

  if (!post) {
    notFound();
  }

  return (
    <div className="max-w-[860px] text-crema">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-neon font-semibold mb-1.5">✦ Contenido</p>
          <h1 className="font-display font-bold text-2xl md:text-3xl text-white">Editar Artículo</h1>
        </div>
        <Link
          href="/admin/blog"
          className="text-muted hover:text-white text-xs font-semibold"
        >
          ← Volver al blog
        </Link>
      </div>

      <BlogForm post={post} />
    </div>
  );
}
