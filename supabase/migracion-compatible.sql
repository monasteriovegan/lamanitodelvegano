-- ============================================================
-- Migración compatible — La Manito Del Vegano
-- A diferencia del schema.sql original (que asumía base limpia),
-- este script AGREGA columnas y seguridad sobre las tablas REALES
-- que ya existen en producción, sin borrar datos.
-- Ejecutar en el SQL Editor de Supabase, de arriba hacia abajo.
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- PRODUCTOS: agregar columnas que faltan, sin tocar las existentes ----------
alter table productos add column if not exists activo boolean default true;
-- Nota: la tabla vieja ya tiene id text, categoria text (no FK), descripcion text (no descripcion_corta/larga).
-- La capa de datos de Next.js se adapta a estos nombres reales, no al revés.

-- ---------- CUPONES: agregar 'activo' y 'expira_at' que no existían ----------
alter table cupones add column if not exists activo boolean default true;
alter table cupones add column if not exists expira_at timestamptz;
update cupones set activo = true where activo is null;

-- ---------- PEDIDOS: agregar columna para reconciliar webhooks de pago ----------
alter table pedidos add column if not exists external_token text;
alter table pedidos add column if not exists metodoPago text;

-- ---------- NUEVAS TABLAS (no existían antes) ----------
create table if not exists integraciones_secretas (
  id text primary key default 'global',
  flow_enabled boolean default false,
  flow_sandbox boolean default true,
  flow_api_key text,
  flow_secret_key text,
  mp_access_token text,
  gemini_api_key text,
  wa_access_token text,
  wa_verify_token text,
  updated_at timestamptz default now()
);

create table if not exists carritos_abandonados (
  id uuid primary key default gen_random_uuid(),
  identificador text,
  items jsonb not null,
  subtotal integer,
  contactado boolean default false,
  recuperado boolean default false,
  created_at timestamptz default now(),
  last_activity_at timestamptz default now()
);

create table if not exists admin_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  rol text not null default 'admin' check (rol in ('admin','soporte','bodega')),
  created_at timestamptz default now()
);

-- ---------- MIGRAR las credenciales sensibles que estaban en `ajustes.data` (JSON) ----------
-- Si tu tabla `ajustes` vieja tenía flow_api_key/flow_secret_key/mp_token guardados dentro
-- del JSON `data`, este bloque los copia a la tabla segura nueva. Si no los tenía, no hace nada.
insert into integraciones_secretas (id, flow_api_key, flow_secret_key, mp_access_token)
select
  'global',
  data->>'flow_api_key',
  data->>'flow_secret_key',
  data->>'mp_access_token'
from ajustes
where id = 'global'
on conflict (id) do update set
  flow_api_key = coalesce(excluded.flow_api_key, integraciones_secretas.flow_api_key),
  flow_secret_key = coalesce(excluded.flow_secret_key, integraciones_secretas.flow_secret_key),
  mp_access_token = coalesce(excluded.mp_access_token, integraciones_secretas.mp_access_token);

-- ---------- Función de descuento atómico de stock ----------
create or replace function descontar_stock(p_producto_id text, p_cantidad integer)
returns void
language plpgsql
security definer
as $$
begin
  update productos
  set stock = greatest(0, stock - p_cantidad)
  where id = p_producto_id and maneja_stock = true;
end;
$$;
