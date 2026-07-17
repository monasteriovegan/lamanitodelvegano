-- ============================================================
-- RLS — La Manito Del Vegano v2 (sobre tablas REALES compartidas
-- con el sitio viejo). Ejecutar DESPUÉS de migracion-compatible.sql.
-- Principio: anon (navegador) solo puede LEER catálogo público.
-- Todo lo sensible (pedidos, integraciones, pins) pasa por
-- service_role desde API routes de Next.js, nunca directo.
-- ============================================================

alter table categorias enable row level security;
alter table productos enable row level security;
alter table zonas enable row level security;
alter table ajustes enable row level security;
alter table integraciones_secretas enable row level security;
alter table cupones enable row level security;
alter table puntos_pins enable row level security;
alter table pedidos enable row level security;
alter table carritos_abandonados enable row level security;
alter table admin_roles enable row level security;

create or replace function is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from admin_roles where user_id = auth.uid()
  );
$$;

-- ---------- CATEGORÍAS ----------
drop policy if exists "categorias_select_public" on categorias;
create policy "categorias_select_public" on categorias for select to anon, authenticated using (true);

drop policy if exists "categorias_write_admin" on categorias;
create policy "categorias_write_admin" on categorias for all to authenticated
  using (is_admin()) with check (is_admin());

-- ---------- PRODUCTOS ----------
drop policy if exists "productos_select_public" on productos;
create policy "productos_select_public" on productos for select to anon, authenticated
  using (activo = true);

drop policy if exists "productos_select_admin_all" on productos;
create policy "productos_select_admin_all" on productos for select to authenticated
  using (is_admin());

drop policy if exists "productos_write_admin" on productos;
create policy "productos_write_admin" on productos for all to authenticated
  using (is_admin()) with check (is_admin());

-- ---------- ZONAS ----------
drop policy if exists "zonas_select_public" on zonas;
create policy "zonas_select_public" on zonas for select to anon, authenticated using (true);

drop policy if exists "zonas_write_admin" on zonas;
create policy "zonas_write_admin" on zonas for all to authenticated
  using (is_admin()) with check (is_admin());

-- ---------- AJUSTES (no sensibles: nombre tienda, redes, etc., dentro de `data`) ----------
drop policy if exists "ajustes_select_public" on ajustes;
create policy "ajustes_select_public" on ajustes for select to anon, authenticated using (true);

drop policy if exists "ajustes_write_admin" on ajustes;
create policy "ajustes_write_admin" on ajustes for all to authenticated
  using (is_admin()) with check (is_admin());

-- ---------- INTEGRACIONES SECRETAS: SIN policies para anon/authenticated ----------
-- Solo accesible vía service_role, desde API routes / server actions, tras
-- verificar manualmente que quien llama es admin (ver actions.ts de integraciones).

-- ---------- CUPONES ----------
drop policy if exists "cupones_select_public" on cupones;
create policy "cupones_select_public" on cupones for select to anon, authenticated
  using (activo = true and (expira_at is null or expira_at > now()));

drop policy if exists "cupones_write_admin" on cupones;
create policy "cupones_write_admin" on cupones for all to authenticated
  using (is_admin()) with check (is_admin());

-- ---------- PUNTOS_PINS: nunca accesible directo, solo server-side ----------
-- Sin policies para anon/authenticated => bloqueado.

-- ---------- PEDIDOS: nunca accesible directo desde el navegador ----------
drop policy if exists "pedidos_admin_all" on pedidos;
create policy "pedidos_admin_all" on pedidos for all to authenticated
  using (is_admin()) with check (is_admin());

-- ---------- CARRITOS ABANDONADOS: solo server-side / admin ----------
drop policy if exists "carritos_admin_all" on carritos_abandonados;
create policy "carritos_admin_all" on carritos_abandonados for all to authenticated
  using (is_admin()) with check (is_admin());

-- ---------- ADMIN_ROLES: nadie excepto service_role gestiona esto ----------
