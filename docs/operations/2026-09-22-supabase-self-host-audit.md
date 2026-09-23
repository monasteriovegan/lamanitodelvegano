# Auditoría para migración a Supabase self-hosted

Fecha: 2026-09-22  
Repositorio: `monasteriovegan/lamanitodelvegano`  
Base auditada: `main` en `c553124`  
Alcance: inventario del repositorio y preparación previa a una migración futura. No se consultó ni modificó la base administrada, no se copiaron datos, no se cambiaron DNS ni variables de Vercel y no se instaló Supabase.

## Resumen ejecutivo

La aplicación puede seguir alojada en Vercel y apuntar a Supabase self-hosted mediante `NEXT_PUBLIC_SUPABASE_URL`, la clave pública y la clave de servidor. El cambio no es todavía seguro porque el repositorio no contiene una definición reproducible completa del estado de producción.

Los bloqueos principales son:

1. El runtime referencia 64 tablas o relaciones de base de datos, pero 24 nombres usados por la aplicación no tienen un `CREATE TABLE` en los SQL del repositorio.
2. Hay 48 archivos SQL: 28 migraciones timestamped y 20 scripts manuales en la raíz de `supabase/`. No existe `supabase/config.toml`, directorio de Edge Functions ni una única cadena canónica que reconstruya una base vacía.
3. La migración `supabase/migrations/20260905110000_rm_shipping_zones.sql` borra todas las filas de `public.zonas` antes de insertar una nueva configuración. No se debe reproducir ciegamente.
4. Storage usa cinco buckets, pero el repositorio no crea ninguno ni versiona sus políticas.
5. Hay URLs públicas de Storage persistibles y una URL del proyecto administrado codificada como fallback en `src/lib/supabase/server.ts`. Un cambio de host puede dejar enlaces antiguos o dirigir tráfico al proyecto administrado si faltan variables.
6. Auth depende de usuarios, sesiones, cookies, redirects y de `admin_roles`. Un restore sólo de `public` rompería los administradores.
7. Existen funciones `SECURITY DEFINER` y políticas RLS repartidas entre scripts antiguos y migraciones posteriores. Debe auditarse el estado vivo y consolidarse antes del ensayo.

## Arquitectura observada

- Frontend y API: Next.js 16.2.9 en Vercel.
- Clientes Supabase: `@supabase/supabase-js` 2.108.2 y `@supabase/ssr` 0.12.0 según lockfile.
- Acceso público: cliente browser con URL y clave anon/publishable.
- Acceso autenticado: cliente SSR con cookies para Supabase Auth.
- Acceso privilegiado: cliente server-only con `SUPABASE_SERVICE_ROLE_KEY`; muchas rutas API usan bypass de RLS después de validar al operador.
- Programación: Vercel Cron; no se usa `pg_cron` en la aplicación.
- Webhooks externos: terminan en rutas de Vercel, no directamente en Supabase.

## Inventario de dependencias Supabase

### Database

El código de `src/` referencia directamente estos 64 nombres de tabla o relación:

`admin_notification_deliveries`, `admin_push_subscriptions`, `admin_roles`, `agent_memories`, `agent_runtime_configs`, `ai_provider_credentials`, `ajustes`, `analytics_events`, `blocked_delivery_dates`, `blog_posts`, `business_members`, `business_units`, `carritos_abandonados`, `cart_items`, `categorias`, `channel_settings`, `contact_messages`, `conversation_orders`, `conversation_reconciliation_state`, `conversations`, `conversion_events`, `crm_activities`, `cupones`, `customer_identities`, `customer_notes`, `customer_tag_assignments`, `customer_tags`, `delivery_settings`, `ingredients`, `integraciones_secretas`, `mcp_access_tokens`, `messaging_transport_status`, `meta_connection_assets`, `meta_connections`, `meta_oauth_states`, `omnichannel_contacts`, `omnichannel_messages`, `order_status_history`, `payment_reconciliation_queue`, `pedidos`, `product_option_groups`, `product_option_values`, `product_pack_components`, `product_variants`, `productos`, `provider_pricing`, `provider_quota_configs`, `puntos_pins`, `recipe_ingredients`, `recipes`, `sales_opportunities`, `season_products`, `season_variant_overrides`, `seasons`, `store_reservations`, `synthetiq_resources`, `usage_events`, `wonka_job_events`, `wonka_jobs`, `wonka_messages`, `wonka_threads`, `wonka_tool_audit`, `wonka_worker_tokens` y `zonas`.

Los siguientes nombres usados en runtime no tienen un `CREATE TABLE` en los SQL del repositorio:

`agent_runtime_configs`, `ajustes`, `business_units`, `categorias`, `channel_settings`, `conversations`, `cupones`, `mcp_access_tokens`, `omnichannel_contacts`, `omnichannel_messages`, `pedidos`, `productos`, `provider_pricing`, `provider_quota_configs`, `puntos_pins`, `synthetiq_resources`, `usage_events`, `wonka_job_events`, `wonka_jobs`, `wonka_messages`, `wonka_threads`, `wonka_tool_audit`, `wonka_worker_tokens` y `zonas`.

Esto no prueba que falten en producción; prueba que el repositorio por sí solo no puede reconstruir el esquema vivo.

### Auth

Operaciones detectadas:

- `signInWithPassword`
- `exchangeCodeForSession`
- `getUser`
- `resetPasswordForEmail`
- `updateUser`
- `signOut`

Dependencias adicionales:

- cookies SSR de `@supabase/ssr`;
- callback `/admin/callback`;
- recovery `/admin/update-password`;
- FK `admin_roles.user_id -> auth.users.id`;
- resolución de roles `admin`, `soporte` y `bodega`;
- función RLS `is_admin()` basada en `auth.uid()`.

La migración debe preservar `auth.users`, las identidades y la compatibilidad de JWT durante el ensayo. Los redirects permitidos, `SITE_URL`, SMTP y plantillas de correo son configuración externa al dump de la base.

### Storage

Buckets usados por el código:

| Bucket | Uso | Acceso esperado |
|---|---|---|
| `productos` | imágenes de producto, campañas y biblioteca ads | público; `getPublicUrl` |
| `products` | bucket alternativo aceptado por upload admin | público; confirmar si existe o es legado |
| `blog` | imágenes de blog | público; `getPublicUrl` |
| `omnichannel-media` | imágenes inbound de WhatsApp/Instagram y OCR | el código genera URL pública; revisar si eso es intencional para comprobantes |
| `wonka-attachments` | adjuntos de Wonka y descarga por worker | privado; URLs firmadas de 24 horas |

Operaciones detectadas: `upload`, `createSignedUploadUrl`, `createSignedUrl`, `getPublicUrl`, `list`, `download` y `remove` de compensación cuando falla el firmado.

No hay SQL para `storage.buckets` o políticas sobre `storage.objects`. Los objetos no están incluidos en un dump normal de Postgres y deben copiarse en una etapa independiente. Las rutas deben conservarse para no romper referencias. Las URLs completas que contengan el host administrado deben inventariarse y, si corresponde, reescribirse de forma controlada después del ensayo.

### Realtime

No se encontraron llamadas a `.channel()`, `postgres_changes` ni suscripciones Realtime. El inbox usa polling. Realtime no es requisito funcional observado y puede omitirse del primer stack para reducir superficie, después de confirmar que no hay consumidores externos.

### Edge Functions

No existe `supabase/functions/` y no se encontraron llamadas a `supabase.functions.invoke`. Todas las funciones HTTP viven en rutas Next.js/Vercel. Edge Runtime de Supabase no es requisito funcional observado y puede omitirse inicialmente.

### RPCs

La aplicación llama a estas diez funciones Postgres:

1. `admin_conversation_inbox_summary_v1`
2. `admin_create_order_v1`
3. `admin_delete_order_v1`
4. `admin_update_order_v1`
5. `checkout_create_order_v2`
6. `checkout_schema_ready_v2`
7. `consume_meta_oauth_state`
8. `conversation_create_order_v1`
9. `mark_conversation_read`
10. `set_remy_global_enabled`

El conjunto SQL define 29 funciones en total, incluyendo helpers y funciones de trigger. Las RPC administrativas y de checkout más recientes revocan acceso a `public`, `anon` y `authenticated` y otorgan ejecución a `service_role`, pero esa propiedad debe verificarse contra la base viva.

### Triggers

Se detectaron veinte triggers definidos en el repositorio:

- `conversation_orders_attribute_opportunity`
- `omnichannel_messages_increment_unread`
- `pedidos_enforce_unblocked_delivery_date`
- `pedidos_fill_subtotal`
- `sales_opportunities_set_updated_at`
- `trg_blog_posts_updated`
- `trg_guard_paid_purchase_conversion_v2`
- `trg_ingredients_updated`
- `trg_recipes_updated`
- `trg_remy_cart_commerce_stage`
- `trg_remy_cart_mark_interested`
- `trg_remy_cart_sync_recovery_contact`
- `trg_remy_claim_web_whatsapp_handoff`
- `trg_remy_order_commerce_stage`
- `trg_remy_order_payment_handoff`
- `trg_seasons_updated`
- `trg_site_settings_updated`
- `trg_store_reservations_updated`
- `trg_sync_conversation_order_link_v1`
- `trg_validate_season_variant_override`

No se debe cargar data con triggers activos sin un procedimiento explícito. La guía oficial de restore usa `session_replication_role = replica` durante el data import para evitar efectos duplicados.

### RLS y grants

Los SQL contienen 69 nombres de policy y habilitan RLS explícitamente en 47 tablas. El modelo pretende:

- lectura pública de catálogo/configuración no sensible;
- escritura administrativa condicionada por `is_admin()`;
- tablas de secretos, pedidos y PINs accesibles desde servidor con clave privilegiada;
- RPCs sensibles limitadas a `service_role`.

Riesgos a validar:

- `rls-policies.sql` crea `is_admin()` como `SECURITY DEFINER` sin fijar `search_path` ni revocar `EXECUTE` a `PUBLIC` en ese mismo archivo;
- `migracion-compatible.sql` crea `descontar_stock()` como `SECURITY DEFINER` sin grants/revokes explícitos ni `search_path` fijo;
- varias funciones posteriores sí corrigen grants, pero el resultado depende del orden y del estado previo;
- algunas funciones de trigger usan `search_path = public`; deben revisarse frente a shadowing;
- tablas expuestas requieren grants además de RLS; las configuraciones nuevas del Data API pueden no exponer tablas SQL automáticamente;
- no hay políticas versionadas de Storage.

### URLs de Storage y host Supabase

Referencias codificadas:

- `src/lib/supabase/server.ts` usa la URL del proyecto administrado y un JWT dummy cuando faltan variables durante build/local.
- Documentación histórica también contiene el project ref administrado.
- El código genera URLs públicas de objetos con `getPublicUrl`; pueden quedar guardadas en columnas JSON o de imagen.

Antes del cutover se debe eliminar el fallback al host administrado o convertirlo en un fallo cerrado fuera de build, además de localizar en la base viva cualquier URL completa del host antiguo.

## Flujos críticos

### Catálogo y productos

Fuente canónica principal: `productos`, enriquecida por `categorias`, `product_variants`, `product_option_groups`, `product_option_values`, `product_pack_components`, `seasons`, `season_products` y `season_variant_overrides`. El catálogo público filtra activos y productos de prueba. El admin modifica estructura normalizada y disponibilidad. Storage entrega imágenes públicas.

Riesgo de migración: conservar tipos de ID, slugs, SKU, relaciones, orden, variantes, overrides estacionales y rutas de imágenes. Los tests declaran `productos` UUID en el esquema reconciliado, mientras documentación antigua habla de `text`; el esquema vivo es la autoridad.

### Checkout y stock

La ruta `/api/checkout` recalcula en servidor usando `productos`, `zonas`, `cupones`, `ajustes`, disponibilidad y fechas bloqueadas. El camino nuevo usa `checkout_schema_ready_v2` como attestation y `checkout_create_order_v2` para idempotencia, creación del pedido, descuento de stock, carrito, atribución y conversión. Hay compatibilidad legacy con `pedidos`.

Riesgo de migración: tipos e índices exactos, constraints de idempotencia, locks de fila y triggers. Cualquier divergencia debe bloquear checkout en vez de degradar silenciosamente.

### Pedidos

`pedidos` sigue siendo la tabla canónica de runtime. Existen tablas normalizadas históricas `orders`/`order_items`, pero los tests exigen no crear una tercera vía. Operaciones manuales y conversacionales usan RPCs transaccionales; cambios de estado escriben `order_status_history`; conciliaciones usan `payment_reconciliation_queue` y `conversation_reconciliation_state`.

Riesgo de migración: preservar secuencias/IDs, `external_token`, referencias de conversación, historial, estados de pago, atribución y exactitud de stock.

### Panel admin

Auth usa cookies Supabase y `admin_roles`. Muchas lecturas/escrituras administrativas usan la clave privilegiada después de `getCurrentAdminUser`; otras políticas RLS permiten admins autenticados. El panel cubre catálogo, pedidos, CRM, logística, contenido, integraciones, mensajería, IA, métricas y Wonka.

Riesgo de migración: un usuario en `auth.users` sin su fila `admin_roles` pierde acceso; una clave server-side incorrecta inutiliza casi todo el panel.

### Flow

`/api/pagos/flow` crea pagos y `/api/pagos/flow-confirm` valida la confirmación, actualiza `pedidos`, registra historial y dispara notificaciones/analytics. Las credenciales pueden residir en `integraciones_secretas` y no deben aparecer en dumps, logs o commits.

El webhook sigue apuntando al dominio Vercel. La migración de Supabase no requiere cambiar ese callback mientras Vercel siga siendo el frontend/API.

### Mercado Pago

`/api/pagos/mercadopago` crea preferencias; `/api/pagos/mercadopago-webhook` valida firma, consulta el pago, hace compare-and-set de estado, registra historial/reconciliación, notificación y CAPI. Hay varios alias de variables de entorno para compatibilidad y fallback a `integraciones_secretas`.

El webhook sigue en Vercel. El mayor riesgo es duplicar eventos o perder la idempotencia durante una ventana de doble escritura; por eso no se propone doble escritura.

### Meta Pixel y CAPI

Pixel/GA4 corren en cliente. CAPI corre en servidor, lee `conversion_events`, `pedidos`, catálogo e `integraciones_secretas`, y usa un `event_id` estable para deduplicar con Pixel. La migración debe preservar los eventos/outbox y sus constraints.

### WhatsApp

Webhook `/api/whatsapp`, transporte Cloud API, modo `disabled/read_only/live`, deduplicación, persistencia en `conversations`/`omnichannel_messages`, reconciliación de ventas, OCR y continuidad web→WhatsApp. Configuración en `channel_settings`, `messaging_transport_status`, assets Meta e `integraciones_secretas`.

El callback público sigue en Vercel. Mantener exactamente el mismo endpoint evita tocar Meta durante el ensayo.

### Instagram

Webhook `/api/instagram`, OAuth de Meta, identidad CRM, backfill e historial. Usa `meta_connections`, `meta_connection_assets`, `meta_oauth_states`, `business_members`, conversaciones y mensajes. Tokens cifrados dependen de `META_TOKEN_ENCRYPTION_KEY`; perder esa clave hace ilegibles los tokens existentes.

### Wonka

Wonka usa Auth/admin, `business_units`, `integraciones_secretas`, memoria/configuración de agentes, hilos, mensajes, jobs, eventos, auditoría, tokens de workers, recursos Synthetiq y adjuntos privados. Muchas de esas tablas no están creadas por los SQL del repo, por lo que un snapshot vivo del esquema es obligatorio.

### Cron jobs

`vercel.json` define tres ejecuciones:

- `/api/cron/carritos-abandonados`: `0 13 * * *`
- `/api/cron/sales-opportunities`: `0 14 * * *`
- `/api/cron/reconcile-pending-sales`: `0 8 * * *`

La migración timestamped de scheduling declara explícitamente que no usa `pg_cron`. Las rutas validan `CRON_SECRET`. No se deben duplicar estos schedules en PostgreSQL.

## Revisión de `supabase/`

### Migraciones timestamped (28)

| Archivo | Propósito principal | Observación de migración |
|---|---|---|
| `20260901180147_fiestas_patrias_catalog_master.sql` | variantes/opciones/packs y RLS | esquema de catálogo normalizado |
| `20260901180552_catalog_policy_write_split.sql` | separa policies por operación | reemplaza policies previas |
| `20260901181559_seed_fiestas_patrias_2026.sql` | seed estacional | DML de negocio; no replay ciego |
| `20260903040700_meta_connections_instagram_login_provider.sql` | proveedor de login Instagram | alteración pequeña |
| `20260903043000_conversation_order.sql` | RPC de pedido conversacional | reemplazada por versión posterior |
| `20260903183000_conversation_order_custom_items.sql` | amplía RPC a ítems custom | `SECURITY DEFINER` |
| `20260903210000_canonical_catalog_consolidation.sql` | consolida catálogo | backfill/update |
| `20260903215000_order_reconciliation_state.sql` | estado de conciliación | tabla nueva |
| `20260903220000_admin_order_transactions.sql` | crear pedido admin | RPC transaccional |
| `20260903221500_admin_order_edit.sql` | editar pedido admin | log y RPC transaccional |
| `20260903223000_schedule_order_reconciliation.sql` | documenta Vercel Cron | sin side effects SQL |
| `20260904004500_conversation_order_link_guard.sql` | sincroniza vínculo conversación/pedido | trigger privilegiado |
| `20260904020000_season_variant_overrides.sql` | overrides estacionales | tabla, trigger y RLS |
| `20260904023000_migrate_fiestas_patrias_overrides.sql` | backfill de overrides | DML de negocio |
| `20260904040000_checkout_production_readiness.sql` | attestation y guard de compra | RPCs/trigger privilegiados |
| `20260904203000_lock_admin_order_rpcs.sql` | limita RPCs a service role | hardening |
| `20260905005500_admin_order_safe_delete.sql` | borrado admin controlado | contiene deletes dentro de RPC |
| `20260905090000_sales_opportunities.sql` | oportunidades comerciales | tabla, triggers, RPC |
| `20260905110000_rm_shipping_zones.sql` | reemplaza zonas | **borra todas las filas de `zonas`** |
| `20260905193000_crm_inbox_reliability.sql` | resumen/no leídos | RPCs y trigger |
| `20260905234500_remy_commerce_state.sql` | estados de comercio Remy | triggers |
| `20260905235500_remy_whatsapp_handoff.sql` | handoff web→WhatsApp | trigger privilegiado |
| `20260906001000_remy_trigger_security_hardening.sql` | revokes/search path | hardening |
| `20260906002000_remy_handoff_schema_alignment.sql` | alinea handoff | reemplaza función |
| `20260906003000_admin_web_push.sql` | push admin | tablas privadas/RLS |
| `20260906011500_remy_global_kill_switch.sql` | kill switch global | RPC sólo server-side |
| `20260910000000_dulces_chocolateria_catalog.sql` | catálogo/seed de dulces | DML de negocio |
| `20260912010000_enforce_blocked_delivery_dates.sql` | bloquea fechas en DB | trigger privilegiado |

### Scripts manuales raíz (20)

Incluyen migración compatible inicial, CRM/logística, paridad, esquema de órdenes, omnicanal, credenciales IA, memorias, evolución Remy, RLS y parches. Se solapan con migraciones timestamped y varios contienen backfills o seeds. Deben clasificarse como:

- baseline histórico ya aplicado;
- reemplazado por migración posterior;
- parche que todavía debe incorporarse a un baseline canónico;
- script de datos que no debe ejecutarse en un entorno nuevo sin revisión.

`migracion-omnichannel-reconciled-v2.sql` es el candidato más cercano a una base consolidada, pero no basta: no crea todas las tablas usadas y contiene lógica de limpieza/DML. La fuente de verdad para el ensayo debe ser un dump de sólo esquema del proyecto administrado, sanitizado y comparado con estos archivos.

## Verificación del repositorio

Ejecutado sobre la copia limpia:

- `npm ci`: correcto; 367 paquetes instalados.
- `npm test`: 486 tests, 486 pass, 0 fail.
- `npx tsc --noEmit`: exit 0.
- `npm run build`: exit 0; 67 páginas generadas.
- `npm run lint`: falla con 521 problemas (493 errores, 28 warnings), mayormente `no-explicit-any` y reglas de hooks. Es deuda preexistente y no se corrigió en esta auditoría.
- `npm audit`: 9 vulnerabilidades (1 crítica, 6 altas, 2 moderadas). Next.js 16.2.9 tiene fix disponible en 16.3.6; también hay avisos transitivos en `sharp`, `postcss`, `brace-expansion`, `browserslist`, `js-yaml` y `nanoid`.

## Estado de Fase 2 (VPS)

No ejecutada por falta de una conexión SSH utilizable en esta sesión. `~/.ssh` sólo contiene `known_hosts` de GitHub, no hay alias de host, clave privada ni agente SSH cargado, y no se proporcionó hostname/IP o usuario. No se intentó acceder por otros medios ni se alteró el VPS.

Para continuar se necesita el comando de conexión o, como mínimo, hostname/IP, puerto, usuario actual y método de autenticación. Las credenciales deben entregarse por un canal seguro, no pegadas en chat.

## Puertos propuestos

### Al terminar la preparación base, antes de instalar Supabase

| Puerto | Exposición | Servicio |
|---|---|---|
| `22/tcp` o puerto SSH existente | público restringido a IP de administración si es viable | OpenSSH |
| resto inbound | denegado | UFW default deny |

Docker y Compose quedarían instalados, pero sin contenedores Supabase ni puertos publicados.

### Después de una futura instalación aprobada

| Puerto | Exposición | Servicio |
|---|---|---|
| `80/tcp` | público | redirect HTTP→HTTPS / ACME |
| `443/tcp` | público | reverse proxy TLS hacia API Gateway |
| `22/tcp` o puerto SSH existente | restringido | administración |
| `5432/tcp` | **no público** | PostgreSQL directo |
| `6543/tcp` | **no público** | pooler/Supavisor si se usa |
| `8000/tcp` | **no público**, bind loopback/red Docker | API Gateway interno |
| Studio y servicios internos | **no públicos** | acceso por túnel SSH/VPN o proxy restringido |

Docker puede saltarse reglas UFW cuando publica puertos. La configuración debe evitar `0.0.0.0` para Postgres, pooler, Studio y gateway interno, y reforzar la cadena `DOCKER-USER`.

## Decisión recomendada

No instalar Supabase todavía. Primero:

1. obtener acceso SSH verificable y preparar el VPS base;
2. levantar un inventario read-only del proyecto Supabase vivo (versión PostgreSQL, extensiones, esquema, grants, RLS, funciones, triggers, Auth config y buckets) sin extraer datos de producción;
3. generar un baseline canónico sólo de esquema;
4. instalar una versión self-hosted fijada en un entorno aislado;
5. restaurar sólo esquema y datos sintéticos;
6. validar los flujos críticos desde un deployment Preview de Vercel;
7. diseñar backups, restore probado, monitoreo y rollback;
8. pedir aprobación separada para una migración de datos y otra para el cutover de producción.

## Referencias oficiales vigentes consultadas

- https://supabase.com/docs/guides/self-hosting/docker
- https://supabase.com/docs/guides/self-hosting/restore-from-platform
- https://supabase.com/docs/guides/self-hosting/self-hosted-auth-keys
- https://supabase.com/docs/guides/self-hosting/auth/config
- https://supabase.com/docs/guides/self-hosting/storage/config
- https://supabase.com/changelog.md

Cambios relevantes del changelog: Envoy reemplaza Kong como gateway por defecto, `API_EXTERNAL_URL` incluye `/auth/v1`, Analytics/Vector son opt-in, el stack self-hosted migra por defecto de PostgreSQL 15 a 17 y tablas nuevas pueden no quedar expuestas automáticamente al Data API.
