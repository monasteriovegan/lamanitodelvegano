# Aplicación manual — Omnichannel Commerce Core

Proyecto obligatorio: Supabase real de La Manito (`adrydqvahzqjbgtcvlay`). No crear otro proyecto.

1. En Supabase, abrir **SQL Editor → New query** y confirmar que el selector superior muestra el proyecto real.
2. Ejecutar primero esta consulta de solo lectura:

```sql
select table_name from information_schema.tables
where table_schema='public' and table_name in
('businesses','customers','pedidos','orders','crm_activities','crm_conversations','crm_messages','productos')
order by table_name;

select table_name,column_name,data_type
from information_schema.columns
where table_schema='public' and
((table_name in ('businesses','customers','orders') and column_name='id') or
 (table_name='productos' and column_name='id'))
order by table_name;
```

Se requieren `businesses/customers/orders.id = uuid` y `productos.id = text`. También deben existir `pedidos`, `crm_activities` e `is_admin()`.

3. Abrir `supabase/migracion-omnichannel-commerce-core.sql`, copiarlo completo y pulsar **Run** una sola vez.
4. Si aparece `omnichannel_preflight_*`, detenerse y compartir solamente ese nombre de error; la transacción habrá hecho rollback.
5. Verificar:

```sql
select automatic_ai_enabled from crm_ai_settings;
select transport,status from messaging_transport_status order by transport;
select tablename,rowsecurity from pg_tables where schemaname='public' and tablename in
('customer_identities','crm_conversations','crm_messages','crm_ai_settings','carts','cart_items','cart_attribution','crm_conversation_orders','conversion_events','messaging_transport_status');
```

`automatic_ai_enabled` debe ser `false`; todas las tablas deben tener RLS. La migración es transaccional, aditiva e idempotente: no contiene `DROP TABLE`, `DROP COLUMN`, `DELETE`, `TRUNCATE` ni reseteos.

## Variables Vercel

Abrir el proyecto `lamanitodelvegano` → Settings → Environment Variables. Reemplazar los valores vacíos y marcar **Preview**:

- `NEXT_PUBLIC_SUPABASE_URL`: URL API del proyecto real.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Publishable/anon key del proyecto real.
- `SUPABASE_SERVICE_ROLE_KEY`: service_role del proyecto real; solo servidor.
- `META_APP_SECRET`: secreto de `synthetiq Core`; solo servidor.
- `GATEWAY_SHARED_SECRET`: exactamente el mismo secreto ya configurado en Railway; no regenerarlo todavía.

No pegar claves en chat. Tras guardarlas, ejecutar Redeploy sobre el Preview de `codex/omnichannel-commerce-core`.
