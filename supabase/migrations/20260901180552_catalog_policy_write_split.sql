drop policy if exists catalog_variants_admin_write on public.product_variants;
drop policy if exists catalog_option_groups_admin_write on public.product_option_groups;
drop policy if exists catalog_option_values_admin_write on public.product_option_values;
drop policy if exists catalog_pack_components_admin_write on public.product_pack_components;

create policy catalog_variants_admin_insert
  on public.product_variants for insert to authenticated
  with check ((select public.is_admin()));
create policy catalog_variants_admin_update
  on public.product_variants for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy catalog_variants_admin_delete
  on public.product_variants for delete to authenticated
  using ((select public.is_admin()));

create policy catalog_option_groups_admin_insert
  on public.product_option_groups for insert to authenticated
  with check ((select public.is_admin()));
create policy catalog_option_groups_admin_update
  on public.product_option_groups for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy catalog_option_groups_admin_delete
  on public.product_option_groups for delete to authenticated
  using ((select public.is_admin()));

create policy catalog_option_values_admin_insert
  on public.product_option_values for insert to authenticated
  with check ((select public.is_admin()));
create policy catalog_option_values_admin_update
  on public.product_option_values for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy catalog_option_values_admin_delete
  on public.product_option_values for delete to authenticated
  using ((select public.is_admin()));

create policy catalog_pack_components_admin_insert
  on public.product_pack_components for insert to authenticated
  with check ((select public.is_admin()));
create policy catalog_pack_components_admin_update
  on public.product_pack_components for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy catalog_pack_components_admin_delete
  on public.product_pack_components for delete to authenticated
  using ((select public.is_admin()));
