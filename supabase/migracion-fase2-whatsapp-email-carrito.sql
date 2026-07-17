-- Migración: soporte para webhook de WhatsApp, emails transaccionales (Resend)
-- y carrito abandonado. Ejecutar en el SQL Editor de Supabase.
-- Es seguro correrla más de una vez (todo con IF NOT EXISTS).

-- WhatsApp Cloud API necesita el phone_number_id además del access token
-- (ya existente) para poder ENVIAR mensajes, no solo verificar el webhook.
alter table integraciones_secretas
  add column if not exists wa_phone_number_id text;

-- Resend para emails transaccionales (confirmación de pedido, despacho,
-- recordatorio de carrito abandonado).
alter table integraciones_secretas
  add column if not exists resend_api_key text,
  add column if not exists resend_from_email text;

-- carritos_abandonados ya existía en el schema pero sin columnas de
-- contacto directo — solo tenía `identificador` (texto libre). Se agregan
-- columnas explícitas para no tener que adivinar si es email o teléfono.
alter table carritos_abandonados
  add column if not exists nombre text,
  add column if not exists email text,
  add column if not exists telefono text;

create index if not exists idx_carritos_abandonados_activity
  on carritos_abandonados (last_activity_at)
  where contactado = false and recuperado = false;
