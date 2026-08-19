import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { getCurrentAdminUser } from '@/lib/supabase/server-auth';

const BUCKET = 'productos';
const PREFIX = 'ads-media';
const MAX_ITEMS = 80;

type StorageEntry = {
  name: string;
  id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  metadata?: Record<string, unknown> | null;
};

function extensionOf(name: string) {
  return name.toLowerCase().match(/\.([a-z0-9]{1,8})$/)?.[1] || '';
}

function mediaKind(name: string, metadata?: Record<string, unknown> | null) {
  const mime = String(metadata?.mimetype || '').toLowerCase();
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('image/')) return 'image';
  return ['mp4', 'mov', 'webm'].includes(extensionOf(name)) ? 'video' : 'image';
}

export async function GET() {
  const admin = await getCurrentAdminUser();
  if (!admin || admin.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  const db = createSupabaseServiceClient();
  const storage = db.storage.from(BUCKET);
  const { data: topEntries, error: topError } = await storage.list(PREFIX, {
    limit: 100,
    sortBy: { column: 'name', order: 'desc' },
  });

  if (topError) {
    console.error('ads_media_list_failed', { detail: topError.message });
    return NextResponse.json({ error: 'No se pudo cargar la biblioteca.' }, { status: 500 });
  }

  const directFiles = (topEntries || []).filter((entry) => Boolean(entry.id)) as StorageEntry[];
  const folders = (topEntries || []).filter((entry) => !entry.id).slice(0, 60) as StorageEntry[];
  const nested = await Promise.all(
    folders.map(async (folder) => {
      const folderPath = `${PREFIX}/${folder.name}`;
      const { data, error } = await storage.list(folderPath, {
        limit: 100,
        sortBy: { column: 'created_at', order: 'desc' },
      });
      if (error) {
        console.error('ads_media_folder_list_failed', { folder: folder.name, detail: error.message });
        return [];
      }
      return (data || [])
        .filter((entry) => Boolean(entry.id))
        .map((entry) => ({ entry: entry as StorageEntry, path: `${folderPath}/${entry.name}` }));
    })
  );

  const items = [
    ...directFiles.map((entry) => ({ entry, path: `${PREFIX}/${entry.name}` })),
    ...nested.flat(),
  ]
    .map(({ entry, path }) => {
      const metadata = entry.metadata || null;
      return {
        path,
        publicUrl: storage.getPublicUrl(path).data.publicUrl,
        kind: mediaKind(entry.name, metadata),
        contentType: String(metadata?.mimetype || ''),
        size: Number(metadata?.size || 0),
        createdAt: entry.created_at || entry.updated_at || null,
      };
    })
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    .slice(0, MAX_ITEMS);

  return NextResponse.json({ items });
}
