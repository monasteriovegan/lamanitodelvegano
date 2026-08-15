import { randomUUID } from 'crypto';
import { getCurrentAdminUser } from '@/lib/supabase/server-auth';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

const BUCKET = 'wonka-attachments';
const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function POST(request: Request) {
  const admin = await getCurrentAdminUser();
  if (!admin || !['admin', 'owner'].includes(admin.rol)) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: 'invalid_origin' }, { status: 403 });

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return Response.json({ error: 'file_required' }, { status: 400 });
  if (!ALLOWED.has(file.type)) return Response.json({ error: 'unsupported_image_type' }, { status: 400 });
  if (file.size <= 0 || file.size > MAX_BYTES) return Response.json({ error: 'invalid_file_size' }, { status: 400 });

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${admin.id}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const db = createSupabaseServiceClient();
  const uploaded = await db.storage.from(BUCKET).upload(path, bytes, { contentType: file.type, upsert: false });
  if (uploaded.error) return Response.json({ error: uploaded.error.message }, { status: 400 });

  const signed = await db.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24);
  if (signed.error || !signed.data?.signedUrl) {
    await db.storage.from(BUCKET).remove([path]).catch(() => undefined);
    return Response.json({ error: signed.error?.message || 'signed_url_failed' }, { status: 400 });
  }

  return Response.json({
    ok: true,
    attachment: {
      name: file.name.slice(0, 180),
      mime: file.type,
      size: file.size,
      bucket: BUCKET,
      path,
      url: signed.data.signedUrl,
    },
  });
}
