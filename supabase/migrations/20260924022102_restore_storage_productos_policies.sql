-- Schema-only parity with the managed project. This does not create the
-- `productos` bucket or copy any Storage objects.
drop policy if exists "storage_anon_insert" on storage.objects;
create policy "storage_anon_insert"
on storage.objects
for insert
to anon
with check (bucket_id = 'productos'::text);

drop policy if exists "storage_anon_select" on storage.objects;
create policy "storage_anon_select"
on storage.objects
for select
to anon
using (bucket_id = 'productos'::text);
