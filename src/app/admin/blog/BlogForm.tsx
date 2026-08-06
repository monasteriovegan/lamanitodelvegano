'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');

export default function BlogForm({ post }: { post?: any }) {
  const router = useRouter();
  const [form, setForm] = useState({
    title: post?.title || '',
    slug: post?.slug || '',
    excerpt: post?.excerpt || '',
    content: post?.content || '',
    cover_image: post?.cover_image || '',
    author_name: post?.author_name || 'La Manito del Vegano',
    category: post?.category || '',
    tags: post?.tags?.join(', ') || '',
    is_published: post?.is_published || false,
    read_time_minutes: post?.read_time_minutes || '',
    meta_title: post?.meta_title || '',
    meta_description: post?.meta_description || '',
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [imgFile, setImgFile] = useState<File | null>(null);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  const toast = (text: string, ok = true) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 3000);
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imgFile) return null;
    const fd = new FormData();
    fd.append('file', imgFile);
    fd.append('bucket', 'blog');
    const r = await fetch('/api/admin/upload', { method: 'POST', body: fd });
    const d = await r.json();
    return d.url || null;
  };

  const save = async (publish?: boolean) => {
    if (!form.title || !form.content) return toast('✦ Título y contenido son requeridos', false);
    setSaving(true);
    let cover_image = form.cover_image;
    if (imgFile) {
      const url = await uploadImage();
      if (url) cover_image = url;
    }
    const body = {
      ...form,
      slug: form.slug || slugify(form.title),
      tags: form.tags
        ? form.tags
            .split(',')
            .map((t: string) => t.trim())
            .filter(Boolean)
        : [],
      cover_image,
      read_time_minutes: form.read_time_minutes ? Number(form.read_time_minutes) : null,
      is_published: publish !== undefined ? publish : form.is_published,
      published_at: publish || form.is_published ? new Date().toISOString() : null,
    };
    const url = post ? `/api/admin/blog/${post.id}` : '/api/admin/blog';
    const method = post ? 'PUT' : 'POST';
    try {
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (r.ok) {
        toast(publish ? '✦ Post publicado con éxito' : '✦ Guardado como borrador');
        setTimeout(() => router.push('/admin/blog'), 1200);
      } else {
        const d = await r.json();
        toast(`Error: ${d.error}`, false);
      }
    } catch (err: any) {
      toast(`Error de red: ${err.message}`, false);
    }
    setSaving(false);
  };

  const deletePost = async () => {
    if (!post || !confirm('¿Eliminar este post?')) return;
    try {
      const r = await fetch(`/api/admin/blog/${post.id}`, { method: 'DELETE' });
      if (r.ok) {
        router.push('/admin/blog');
      } else {
        toast('Error al eliminar', false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-[860px] text-crema space-y-6">
      {msg && (
        <div
          className={`border p-4 rounded-xl text-sm ${
            msg.ok
              ? 'bg-[rgba(0,255,179,0.06)] border-neon/30 text-neon'
              : 'bg-[rgba(239,68,68,0.06)] border-rojo/30 text-rojo'
          }`}
        >
          {msg.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className="block text-xs uppercase tracking-wider text-muted font-semibold mb-2">Título *</label>
          <input
            value={form.title}
            onChange={e => {
              set('title', e.target.value);
              if (!post) set('slug', slugify(e.target.value));
            }}
            placeholder="Cómo llevar una dieta vegana equilibrada..."
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-neon text-white"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-muted font-semibold mb-2">Slug (URL)</label>
          <input
            value={form.slug}
            onChange={e => set('slug', e.target.value)}
            placeholder="auto-generado desde el título"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-neon text-white"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs uppercase tracking-wider text-muted font-semibold mb-2">Extracto / Resumen</label>
        <textarea
          value={form.excerpt}
          onChange={e => set('excerpt', e.target.value)}
          placeholder="Un breve resumen que aparecerá en el listado del blog..."
          rows={2}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-neon text-white resize-none"
        />
      </div>

      <div>
        <label className="block text-xs uppercase tracking-wider text-muted font-semibold mb-2">Contenido (puedes usar Markdown) *</label>
        <textarea
          value={form.content}
          onChange={e => set('content', e.target.value)}
          placeholder="Escribe el artículo aquí..."
          rows={10}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-neon text-white resize-y font-sans"
        />
      </div>

      {/* Cover Image Upload */}
      <div className="bg-[#050e0a] border border-white/10 rounded-2xl p-5">
        <h3 className="font-display font-bold text-sm text-white mb-4">Imagen de Portada</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs uppercase tracking-wider text-muted font-semibold mb-2">Subir desde dispositivo</label>
            <input
              type="file"
              accept="image/*"
              onChange={e => setImgFile(e.target.files?.[0] || null)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-neon text-white cursor-pointer"
            />
            {imgFile && <p className="text-[11px] text-neon mt-2">✦ Imagen seleccionada: {imgFile.name}</p>}
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-muted font-semibold mb-2">O pegar URL de imagen</label>
            <input
              value={form.cover_image}
              onChange={e => set('cover_image', e.target.value)}
              placeholder="https://..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-neon text-white"
            />
          </div>
        </div>
        {(form.cover_image || imgFile) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgFile ? URL.createObjectURL(imgFile) : form.cover_image}
            className="mt-4 rounded-xl border border-white/10 max-h-40 object-cover"
            alt="Preview"
          />
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div>
          <label className="block text-xs uppercase tracking-wider text-muted font-semibold mb-2">Autor</label>
          <input
            value={form.author_name}
            onChange={e => set('author_name', e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-neon text-white"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-muted font-semibold mb-2">Categoría</label>
          <input
            value={form.category}
            onChange={e => set('category', e.target.value)}
            placeholder="Recetas, Nutrición, Novedades..."
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-neon text-white"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-muted font-semibold mb-2">Tiempo de lectura (min)</label>
          <input
            type="number"
            value={form.read_time_minutes}
            onChange={e => set('read_time_minutes', e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-neon text-white"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs uppercase tracking-wider text-muted font-semibold mb-2">Etiquetas / Tags (separados por coma)</label>
        <input
          value={form.tags}
          onChange={e => set('tags', e.target.value)}
          placeholder="vegano, artesanal, sin-gluten"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-neon text-white"
        />
      </div>

      {/* SEO Fields */}
      <div className="bg-[#050e0a] border border-white/10 rounded-2xl p-5">
        <h3 className="font-display font-bold text-sm text-white mb-4">Optimización SEO</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-muted font-semibold mb-2">Meta título</label>
            <input
              value={form.meta_title}
              onChange={e => set('meta_title', e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-neon text-white"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-muted font-semibold mb-2">Meta descripción</label>
            <textarea
              value={form.meta_description}
              onChange={e => set('meta_description', e.target.value)}
              rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-neon text-white resize-none"
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-5 border-t border-white/5">
        <button
          onClick={() => save(false)}
          disabled={saving}
          className="bg-white/5 hover:bg-white/10 border border-white/10 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-all"
        >
          {saving ? 'Guardando...' : 'Guardar Borrador'}
        </button>
        <button
          onClick={() => save(true)}
          disabled={saving}
          className="bg-neon hover:bg-neon/90 text-black px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-[0_0_15px_rgba(0,255,179,0.2)]"
        >
          ✦ Publicar Artículo
        </button>
        {post && (
          <button
            onClick={deletePost}
            className="ml-auto bg-rojo/10 hover:bg-rojo/20 border border-rojo/30 text-rojo px-4 py-2.5 rounded-xl font-bold text-xs transition-all"
          >
            Eliminar
          </button>
        )}
      </div>
    </div>
  );
}
