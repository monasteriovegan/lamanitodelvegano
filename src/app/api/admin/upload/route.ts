import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { getCurrentAdminUser } from '@/lib/supabase/server-auth';

export async function POST(req: Request) {
  const admin = await getCurrentAdminUser();
  if (!admin || !['admin', 'soporte', 'bodega'].includes(admin.rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const db = createSupabaseServiceClient();
  const formData = await req.formData();
  const file = formData.get('file') as File;
  const requestedBucket = (formData.get('bucket') as string) || 'productos';
  
  // Accept standard bucket names
  const bucket = ['productos', 'products', 'blog'].includes(requestedBucket) ? requestedBucket : 'productos';

  if (!file) return NextResponse.json({ error: 'Archivo inválido' }, { status: 400 });
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: 'El archivo supera los 5 MB' }, { status: 413 });

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const allowed = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'];
  if (!allowed.includes(ext) || !file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'Formato no permitido' }, { status: 400 });
  }

  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const { data, error } = await db.storage.from(bucket).upload(filename, buffer, {
    contentType: file.type,
    upsert: false,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const { data: urlData } = db.storage.from(bucket).getPublicUrl(filename);
  return NextResponse.json({ url: urlData.publicUrl, path: data.path });
}
