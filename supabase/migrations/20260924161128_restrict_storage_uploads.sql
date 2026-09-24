-- Uploads are signed by authenticated admin-only server routes. No current
-- application flow requires an unrestricted anonymous INSERT policy.
drop policy if exists "storage_anon_insert" on storage.objects;

-- Defense in depth for signed/admin uploads to the public media bucket.
update storage.buckets
set file_size_limit = 12582912,
    allowed_mime_types = array[
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'video/mp4',
      'video/quicktime',
      'video/webm'
    ]::text[]
where id = 'productos';
