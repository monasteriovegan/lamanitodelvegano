-- Las conversaciones nuevas nacen preparadas para Remy, pero los interruptores
-- maestros/canales siguen controlando si puede responder automáticamente.
-- No modifica conversaciones existentes ni contactos marcados como personales.
alter table public.conversations alter column ai_enabled set default true;
