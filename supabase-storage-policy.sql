insert into storage.buckets (id, name, public)
values ('productos', 'productos', true)
on conflict (id) do update set public = true;

drop policy if exists "Public read product images" on storage.objects;
create policy "Public read product images"
on storage.objects
for select
using (bucket_id = 'productos');

drop policy if exists "Anon upload product images" on storage.objects;
create policy "Anon upload product images"
on storage.objects
for insert
to anon
with check (bucket_id = 'productos');
