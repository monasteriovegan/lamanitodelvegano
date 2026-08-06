import Link from 'next/link';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/supabase/require-role';
import { PageHeader, Badge, EmptyState } from '../_ui/AdminUI';

export const dynamic = 'force-dynamic';

export default async function AdminBlogPage() {
  await requireRole(['admin', 'soporte']);

  const supabase = createSupabaseServiceClient();
  const { data: posts, error } = await supabase
    .from('blog_posts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching blog posts:', error);
  }

  const items = posts || [];

  return (
    <div className="max-w-[1000px] text-crema">
      <PageHeader
        eyebrow="✦ Contenido"
        title="Blog del Taller"
        action={
          <Link
            href="/admin/blog/nuevo"
            className="bg-neon hover:bg-neon/90 text-black px-4 py-2.5 rounded-xl font-bold text-sm transition-all shadow-[0_0_15px_rgba(0,255,179,0.2)] inline-block"
          >
            + Nuevo Post
          </Link>
        }
      />

      <div className="bg-[#050e0a]/80 border border-white/10 rounded-2xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02]">
                {['Título', 'Categoría', 'Estado', 'Lectura', 'Publicado', 'Acciones'].map(h => (
                  <th key={h} className="text-[10px] uppercase tracking-wider text-neon font-bold px-5 py-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12">
                    <EmptyState emoji="✍️" texto="Aún no has publicado ningún artículo en el blog." />
                  </td>
                </tr>
              ) : (
                items.map((post: any) => (
                  <tr key={post.id} className="border-b border-white/5 hover:bg-white/[0.01] transition-all">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-sm text-white">{post.title}</div>
                      {post.excerpt && <div className="text-xs text-muted mt-0.5 truncate max-w-[320px]">{post.excerpt}</div>}
                    </td>
                    <td className="px-5 py-4 text-sm text-white/80">{post.category || 'General'}</td>
                    <td className="px-5 py-4">
                      <Badge tono={post.is_published ? 'neon' : 'neutro'}>
                        {post.is_published ? 'Publicado' : 'Borrador'}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 text-sm text-white/85">
                      {post.read_time_minutes ? `${post.read_time_minutes} min` : '—'}
                    </td>
                    <td className="px-5 py-4 text-xs text-muted font-mono">
                      {post.published_at
                        ? new Date(post.published_at).toLocaleDateString('es-CL', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })
                        : '—'}
                    </td>
                    <td className="px-5 py-4">
                      <Link
                        href={`/admin/blog/${post.id}`}
                        className="text-neon hover:text-neon/80 text-xs font-bold transition-all"
                      >
                        Editar
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
