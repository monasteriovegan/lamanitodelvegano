export const ADMIN_MEDIA_MAX_BYTES = 12 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/quicktime',
  'video/webm',
]);

type UploadInput = { fileName?: unknown; contentType?: unknown; size?: unknown };
type ValidUpload = { ok: true; fileName: string; contentType: string; size: number };
type InvalidUpload = { ok: false; reason: 'file_name' | 'content_type' | 'size' };

export function validateAdminMediaUpload(input: UploadInput): ValidUpload | InvalidUpload {
  const fileName = String(input.fileName || '').trim();
  const contentType = String(input.contentType || '').trim().toLowerCase();
  const size = Number(input.size || 0);

  if (!fileName || fileName.length > 240) return { ok: false, reason: 'file_name' };
  if (!ALLOWED_TYPES.has(contentType)) return { ok: false, reason: 'content_type' };
  if (!Number.isFinite(size) || size <= 0 || size > ADMIN_MEDIA_MAX_BYTES) return { ok: false, reason: 'size' };

  return { ok: true, fileName, contentType, size };
}

