# Resultado de Fase 3: inventario vivo y restore sólo de esquema

Fecha: 2026-09-23

Repositorio: `monasteriovegan/lamanitodelvegano`

Entorno destino: Supabase self-hosted aislado en el VPS Contabo. El frontend continúa en Vercel y sigue apuntando al Supabase administrado.

## Límites respetados

- No se cambiaron DNS, dominios ni variables de Vercel.
- No se copiaron filas de negocio, usuarios Auth, sesiones, buckets ni objetos de Storage.
- No se modificaron tablas, funciones, triggers, policies ni datos del Supabase administrado.
- La única modificación autorizada al origen fue restablecer su contraseña PostgreSQL después de auditar conexiones directas.
- PostgreSQL, Supavisor, Studio y servicios internos no se publicaron en Internet.
- No se habilitaron Logs/Analytics ni Vector.
- Los secretos nuevos permanecen únicamente en `/opt/supabase-lamanito/stack/.env`, `root:root`, modo `0600`, fuera de Git.

## Auditoría previa a la rotación de contraseña

Se comprobó, sin descargar valores secretos:

- El repositorio no contiene `DATABASE_URL`, `POSTGRES_URL`, `POSTGRES_PASSWORD`, `DB_PASSWORD`, hosts directos `db.<ref>.supabase.co` ni hosts de pooler.
- Vercel Production contiene URL y claves API de Supabase, pero no variables de conexión PostgreSQL directa. No se cambió ninguna variable.
- GitHub Actions no declara secretos de conexión PostgreSQL.
- `pg_stat_activity` sólo mostró sesiones de servicios administrados de Supabase: PostgREST, Supavisor/pgbouncer, Storage, exporter y administración interna.

Riesgo residual: una integración externa dormida, no versionada y sin sesión activa podría conservar la contraseña anterior. Las consultas de inventario vía Supabase siguieron funcionando después de la rotación.

## Inventario vivo del Supabase administrado

### Resumen

| Elemento | Estado vivo |
|---|---:|
| PostgreSQL | `17.6.1.127` |
| Migraciones registradas | 55 |
| Tablas `public` | 77 |
| Columnas `public` | 878 |
| Constraints `public` | 817 |
| Índices `public` | 215 |
| Firmas de función `public` | 29 |
| Triggers `public` | 15 |
| Policies `public` | 93 |
| Policies personalizadas de Storage | 2 |
| Usuarios en `auth.users` | 2 (sólo conteo; no se extrajo PII) |
| Edge Functions | 0 |
| Tablas de aplicación en Realtime publication | 0 |
| Buckets | 3 (sólo metadatos de inventario) |

El API informó el proyecto como `ACTIVE_HEALTHY` durante la auditoría. Sin embargo, el Dashboard mostró simultáneamente `Services restricted` / `Exceeding usage limits`; esta alerta de cuota es un riesgo de producción independiente y no fue modificada.

### Roles no internos de PostgreSQL

`anon`, `authenticated`, `authenticator`, `dashboard_user`, `pgbouncer`, `postgres`, `service_role`, `supabase_admin`, `supabase_auth_admin`, `supabase_etl_admin`, `supabase_privileged_role`, `supabase_read_only_user`, `supabase_realtime_admin`, `supabase_replication_admin` y `supabase_storage_admin`.

El dump de roles no contenía roles personalizados adicionales ni contraseñas.

### Schemas

`auth`, `extensions`, `graphql`, `graphql_public`, `pgbouncer`, `public`, `realtime`, `storage`, `supabase_migrations` y `vault`.

### Extensiones instaladas

| Extensión | Versión |
|---|---|
| `http` | 1.6 |
| `pg_stat_statements` | 1.11 |
| `pgcrypto` | 1.3 |
| `plpgsql` | 1.0 |
| `supabase_vault` | 0.3.1 |
| `uuid-ossp` | 1.1 |

El self-host incluye además `pg_net 0.20.3` como dependencia de la release; no se añadió al dump de aplicación.

### Las 77 tablas públicas vivas

`_catalog_asset_staging_20260910`, `admin_notification_deliveries`, `admin_push_subscriptions`, `admin_roles`, `agent_control_audit_logs`, `agent_memories`, `agent_runtime_configs`, `agent_settings`, `ai_provider_credentials`, `ajustes`, `analytics_events`, `automation_decisions`, `automation_schedules`, `blocked_delivery_dates`, `blog_posts`, `business_members`, `business_units`, `carritos_abandonados`, `cart_attribution`, `cart_items`, `carts`, `categorias`, `channel_settings`, `configuracion`, `contact_messages`, `conversation_notes`, `conversation_orders`, `conversation_reconciliation_state`, `conversations`, `conversion_events`, `crm_activities`, `crm_sync_queue`, `cupones`, `customer_identities`, `customer_notes`, `customer_tag_assignments`, `customer_tags`, `delivery_settings`, `ingredients`, `integraciones_secretas`, `mcp_access_tokens`, `messaging_transport_status`, `meta_connection_assets`, `meta_connections`, `meta_oauth_states`, `meta_webhook_events`, `omnichannel_contacts`, `omnichannel_messages`, `order_change_log`, `order_status_history`, `payment_reconciliation_queue`, `pedidos`, `product_option_groups`, `product_option_values`, `product_pack_components`, `product_variants`, `productos`, `provider_pricing`, `provider_quota_configs`, `puntos_pins`, `recipe_ingredients`, `recipes`, `sales_opportunities`, `season_products`, `season_variant_overrides`, `seasons`, `store_reservations`, `synthetiq_resources`, `usage_events`, `wonka_job_events`, `wonka_jobs`, `wonka_messages`, `wonka_threads`, `wonka_tool_audit`, `wonka_worker_tokens`, `zonas` y `zonas_envio`.

## Comparación del estado vivo con los 48 SQL del repositorio

### Las 24 tablas usadas en runtime sin `CREATE TABLE` versionado

`agent_runtime_configs`, `ajustes`, `business_units`, `categorias`, `channel_settings`, `conversations`, `cupones`, `mcp_access_tokens`, `omnichannel_contacts`, `omnichannel_messages`, `pedidos`, `productos`, `provider_pricing`, `provider_quota_configs`, `puntos_pins`, `synthetiq_resources`, `usage_events`, `wonka_job_events`, `wonka_jobs`, `wonka_messages`, `wonka_threads`, `wonka_tool_audit`, `wonka_worker_tokens` y `zonas`.

### Otras 10 tablas vivas sin `CREATE TABLE` versionado

`_catalog_asset_staging_20260910`, `agent_control_audit_logs`, `agent_settings`, `automation_decisions`, `automation_schedules`, `configuracion`, `conversation_notes`, `crm_sync_queue`, `meta_webhook_events` y `zonas_envio`.

Total exacto de tablas vivas sin declaración literal en Git: 34.

### Nueve tablas declaradas en Git que no existen en vivo

`businesses`, `crm_ai_settings`, `crm_conversation_orders`, `crm_conversations`, `crm_messages`, `customers`, `order_items`, `orders` y `site_settings`.

### Funciones/RPC

- Viva y ausente de Git: `ensure_pedido_tracking_number()`.
- Declaradas en Git y ausentes en vivo: `sync_customers_from_pedidos()` y `update_updated_at()`.
- `checkout_create_order_v2` tiene dos firmas vivas; por eso hay 29 firmas para 28 nombres de función.
- Las diez RPC consumidas por la aplicación existen en vivo y quedaron restauradas.

### Triggers

- Vivo y ausente de Git: `pedidos_tracking_number_auto` sobre `pedidos`, asociado a `ensure_pedido_tracking_number()`.
- Declarados en Git y ausentes en vivo: `trg_blog_posts_updated`, `trg_ingredients_updated`, `trg_recipes_updated`, `trg_seasons_updated`, `trg_site_settings_updated` y `trg_store_reservations_updated`.
- Los otros 14 triggers públicos vivos tienen paridad con las definiciones efectivas del repositorio.

### Policies RLS

- El origen contiene 93 policies públicas y el destino restaurado contiene las mismas 93.
- Muchas policies `reconciled_admin_*` y policies legacy se generan dinámicamente en `migracion-omnichannel-reconciled-v2.sql`; una comparación sólo por `CREATE POLICY` literal produce falsos positivos.
- Dos policies vivas de Storage no estaban representadas en ningún SQL: `storage_anon_insert` y `storage_anon_select` sobre `storage.objects`, limitadas a `bucket_id = 'productos'`.
- Ambas se versionaron en `20260924022102_restore_storage_productos_policies.sql` y se aplicaron sólo al self-host.
- No se creó el bucket `productos` ni se copiaron objetos.

Riesgo de seguridad: `storage_anon_insert` permite cargas anónimas al bucket lógico `productos`. Antes de exponer Storage debe evaluarse autenticación, límites de tamaño/MIME, rate limiting y potencial abuso de cuota.

## Auth, Storage y URLs absolutas

### Auth

- Se confirmó la estructura administrada de Auth y el conteo de dos usuarios.
- No se copiaron usuarios, identidades, sesiones, MFA ni tokens.
- La configuración del proveedor Google/Gmail no viaja en el dump de esquema. Requiere configuración y secretos OAuth nuevos en una etapa posterior.

### Storage

Buckets vivos:

| Bucket | Público |
|---|---|
| `productos` | sí |
| `omnichannel-media` | no |
| `wonka-attachments` | no |

Los buckets `products` y `blog` aparecen en código pero no existen en el estado vivo inventariado.

### Referencias al host administrado

Un escaneo read-only de 378 columnas textuales/JSON encontró URLs absolutas del host administrado en:

| Ubicación | Filas con coincidencia |
|---|---:|
| `ajustes.data` | 1 |
| `omnichannel_messages.payload` | 69 |
| `productos.imagen_url` | 7 |
| `seasons.banner_image` | 1 |
| `wonka_jobs.input` | 1 |
| `wonka_messages.metadata` | 1 |

No se imprimieron valores ni datos personales. El dump de esquema contiene cero URLs `*.supabase.co`.

El repositorio conserva referencias documentales y un fallback codificado en `src/lib/supabase/server.ts` al host administrado. Debe eliminarse o fallar cerrado antes de un cutover, en un cambio separado y probado.

## Stack self-hosted desplegado

Fuente fijada:

- tag oficial `self-hosted/v0.8.1`;
- objeto tag `690080884040e238926ba22606e8c05a3536829b`;
- commit de checkout `8c7a4d9dbbaf8b552893822e89d7bf06f33f9220`;
- PostgreSQL `17.6.1.136`;
- Envoy `1.39.1` como gateway;
- Compose efectivo sin Logs/Analytics/Vector.

Servicios verificados healthy:

| Servicio | Imagen |
|---|---|
| Database | `supabase/postgres:17.6.1.136` |
| Gateway | `envoyproxy/envoy:v1.39.1` |
| Auth | `supabase/gotrue:v2.196.0` |
| REST | `postgrest/postgrest:v14.17` |
| Storage | `supabase/storage-api:v1.74.0` |
| Realtime | `supabase/realtime:v2.134.10` |
| Studio | `supabase/studio:2026.09.07-sha-7996410` |
| Postgres Meta | `supabase/postgres-meta:v0.99.0` |
| Edge Runtime | `supabase/edge-runtime:v1.76.2` |
| Supavisor | `supabase/supavisor:2.9.12` |
| Imgproxy | `darthsim/imgproxy:v3.31.4` |

Todos los 11 contenedores estaban `healthy` después del restore.

## Restore de esquema

Artefactos protegidos en el VPS:

- `/opt/supabase-lamanito/baseline/roles.sql`: 297 bytes, modo `0600`.
- `/opt/supabase-lamanito/baseline/schema.sql`: 242.075 bytes, modo `0600`.
- SHA-256 roles: `25873cec56a2cc6514e204f420231777f85c03da818caa7090cdcdfa89776ecd`.
- SHA-256 schema: `98fbf4e34773b42b58b344d8639122499f4b444bf2eea41a22e207c17e631283`.

La CLI oficial no aceptó la contraseña por TTY a través de SSH y terminó con `no password supplied`. Para no exponer la contraseña como argumento, se ejecutó el script exacto producido por `supabase db dump --dry-run`, con la misma imagen oficial `public.ecr.aws/supabase/postgres:17.6.1.167`, usando un `.env` temporal modo `0600` que fue destruido inmediatamente.

El primer intento del wrapper produjo archivos vacíos porque faltaba `-i` en `docker run`; la validación de tamaño/hash lo detectó antes del restore. Se corrigió, se repitió y se validaron los archivos finales.

Roles y esquema se aplicaron con `psql --single-transaction --set ON_ERROR_STOP=1`. Resultado: exit 0, sin incompatibilidades SQL y sin cambios parciales.

Paridad comprobada origen → destino:

| Objeto `public` | Origen | Destino |
|---|---:|---:|
| Tablas | 77 | 77 |
| Columnas | 878 | 878 |
| Constraints | 817 | 817 |
| Índices | 215 | 215 |
| Funciones | 29 | 29 |
| Triggers | 15 | 15 |
| Policies | 93 | 93 |

Se añadieron después las dos policies de Storage, alcanzando paridad también en ese overlay personalizado.

La comprobación final del destino confirmó cero filas en `auth.users`, `storage.buckets`, `storage.objects`, `public.productos` y `public.pedidos`; no se migraron datos reales.

## Red, firewall y recursos tras el restore

Puertos escuchando:

| Bind | Servicio | Exposición |
|---|---|---|
| `0.0.0.0:22`, `[::]:22` | SSH | público, permitido por UFW |
| `127.0.0.1:8000` | Envoy | sólo loopback |
| `127.0.0.53:53`, `127.0.0.54:53` | systemd-resolved | sólo local |

No escuchan en el host `5432`, `6543`, Studio ni otros servicios internos.

UFW continúa activo con `deny incoming`, `deny routed`, `allow outgoing`; sólo permite `22/tcp` en IPv4/IPv6. `DOCKER-USER` salta primero a `LMV-DOCKER-FILTER` en IPv4 e IPv6 para impedir que futuros puertos Docker evadan el firewall.

Recursos del host:

- RAM: 11 GiB total, 1,8 GiB usada, 9,9 GiB disponible.
- Swap: 4 GiB persistente, aproximadamente 512 KiB usada.
- Disco raíz/Docker: 193 GiB total, 19 GiB usado, 175 GiB disponible (10%).

## Riesgos antes de copiar datos reales

1. El proyecto administrado muestra servicios restringidos por cuota; resolver facturación/cuota es prioritario y separado de esta migración.
2. `supabaseops` conserva temporalmente `NOPASSWD` para esta automatización. Antes de operación normal debe establecerse un método de sudo administrable y eliminarse `/etc/sudoers.d/90-supabaseops` o sustituirse por privilegios mínimos; validar otra sesión SSH antes de cerrar la actual.
3. No hay todavía dominio, TLS, reverse proxy público, backups off-site, restore probado, monitoreo ni alertas del self-host.
4. OAuth Google, redirects, SMTP y secretos de Auth no están configurados en el self-host.
5. No se han migrado usuarios Auth, datos, buckets ni objetos; el entorno no puede servir producción todavía.
6. Hay 34 tablas vivas sin definición literal en Git y nueve tablas legacy de Git ausentes en vivo. El dump validado es hoy la única baseline completa.
7. `_catalog_asset_staging_20260910` parece una tabla de staging; decidir conservarla o excluirla requiere revisión funcional antes del data dump.
8. Las URLs absolutas de Storage requieren un mapa de reescritura y validación; no deben actualizarse directamente en producción.
9. `storage_anon_insert` puede permitir abuso de cargas anónimas si el servicio se expone sin controles adicionales.
10. La contraseña PostgreSQL del origen fue rotada. No se observaron consumidores directos, pero una integración dormida podría requerir actualización.

## Próxima etapa propuesta, aún no autorizada

1. Resolver la restricción de cuota del origen y confirmar estabilidad.
2. Configurar backups cifrados, retención, restore de prueba y monitoreo del VPS.
3. Configurar Auth Google/SMTP/redirects en el self-host usando credenciales separadas y sin tocar Vercel Production.
4. Crear buckets vacíos y validar policies con datos sintéticos; no copiar objetos reales todavía.
5. Ejecutar un ensayo de datos en una copia aislada, con exclusiones explícitas de secretos y PII cuando corresponda.
6. Probar catálogo, checkout, stock, pedidos, admin, Flow, MercadoPago, Meta, WhatsApp, Instagram, Wonka y cron contra un deployment Preview de Vercel.
7. Diseñar ventana de corte, freeze de escrituras, verificación de conteos/checksums y rollback.
8. Pedir aprobaciones independientes para copiar datos/Auth/Storage y, posteriormente, para cambiar Vercel Production y DNS.

La Fase 3 se detiene aquí. El self-host permanece aislado y producción continúa sin cambios de endpoint.
