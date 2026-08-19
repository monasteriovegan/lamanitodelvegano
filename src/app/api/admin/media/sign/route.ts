import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { getCurrentAdminUser } from '@/lib/supabase/server-auth';

const BUCKET = 'productos';
const PREFIX = 'ads-media';
const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/quicktime',
  'video/webm',
]);

function safeExtension(fileName: string, contentType: string) {
  const ext = String(fileName || '').toLowerCase().match(/\.([a-z0-9]{1,8})$/)?.[1];
  if (ext) return ext;
  const fallback: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/webm': 'webm',
  };
  return fallback[contentType] || 'bin';
}

export async function POST(request: Request) {
  const admin = await getCurrentAdminUser();
  if (!admin || admin.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as { fileName?: unknown; contentType?: unknown; size?: unknown } | null;
  const fileName = String(body?.fileName || '').trim();
  const contentType = String(body?.contentType || '').trim().toLowerCase();
  const size = Number(body?.size || 0);

  if (!fileName || fileName.length > 240 || !ALLOWED_TYPES.has(contentType) || !Number.isFinite(size) || size <= 0) {
    return NextResponse.json({ error: 'Archivo no válido. Usa una foto o video compatible.' }, { status: 400 });
  }

  const extension = safeExtension(fileName, contentType);
  const path = `${PREFIX}/${new Date().toISOString().slice(0, 10)}/${Date.now()}-${randomUUID()}.${extension}`;
  const db = createSupabaseServiceClient();
  const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data?.token) {
    console.error('ads_media_sign_failed', { detail: error?.message || 'missing_token' });
    return NextResponse.json({ error: 'No se pudo preparar la subida.' }, { status: 500 });
  }

  const publicUrl = db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  return NextResponse.json({ bucket: BUCKET, path, token: data.token, publicUrl });
}
