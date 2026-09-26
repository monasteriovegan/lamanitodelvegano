# Resultado de precutover HTTPS + Vercel Preview

Fecha: 2026-09-25. Estado: **Preview operativa; cutover de producción no ejecutado y no autorizado**.

## Resultado ejecutivo

El backend self-hosted está disponible en `https://supabase.lamanitodelvegano.cl` mediante Caddy y TLS válido. La aplicación se desplegó exclusivamente como Vercel Preview en `https://lmv-selfhost-preview.vercel.app`, protegida además por Vercel Authentication. La rama es `staging/supabase-self-hosted`; sus nueve variables son exclusivas del target Preview y de esa rama.

El smoke E2E real pasó con catálogo, producto, disponibilidad, checkout sin escritura, Auth, nueve vistas admin, CRM, conversaciones, Wonka, Storage público/privado, signed URL y firma de upload administrativo. Los dos proveedores de pago quedaron bloqueados por el safe mode antes de contactar al proveedor. No se envió correo, WhatsApp, Instagram ni Meta CAPI, y no se creó ningún cobro.

El núcleo comercial de Preview está operativo. El estado sigue siendo **NO-GO para cutover** hasta resolver los bloqueadores indicados al final.

## DNS, TLS y red

- Registro nuevo único: `supabase.lamanitodelvegano.cl A 31.220.99.191`, TTL 60.
- Apex, `www`, MX, SPF, DKIM, DMARC y otros subdominios: sin cambios.
- Certificado: Let's Encrypt, `CN=supabase.lamanitodelvegano.cl`, válido de 2026-09-24T21:54:20Z a 2026-12-23T21:54:19Z.
- HTTP redirige a HTTPS.
- Públicos: TCP 22, 80 y 443.
- No accesibles externamente: 3000, 5432, 6543 y 8000.
- Envoy permanece en `127.0.0.1:8000`.
- UFW: deny incoming, deny routed; permite sólo SSH, HTTP y HTTPS, IPv4/IPv6.
- Auth health, REST, Storage status y JWKS respondieron HTTP 200 desde fuera del VPS.

## Stack y recursos

- Supabase `self-hosted/v0.8.1`, commit fijado `8c7a4d9dbbaf8b552893822e89d7bf06f33f9220`.
- PostgreSQL `17.6.1.136`; Envoy `1.39.1`; Caddy `2.11.4-alpine`.
- Docker Engine `29.8.1`; Docker Compose `v5.5.1`.
- Ubuntu 24.04.5 LTS, kernel 6.8.0-142.
- Los 11 contenedores Supabase están healthy: Auth, DB, Edge Functions, Envoy, Imgproxy, Meta, Realtime, REST, Storage, Studio y Supavisor. Caddy está running.
- RAM: 11 GiB total, 2.0 GiB usada, 9.7 GiB disponible.
- Swap: 4 GiB activa, 512 KiB usada.
- Disco raíz: 193 GiB, 19 GiB usados, 174 GiB disponibles, 10%.
- DB: 36,637,843 bytes. `/opt/supabase-lamanito`: 1,812,975,287 bytes.

## Vercel Preview

- Alias estable: `https://lmv-selfhost-preview.vercel.app`.
- Deployment verificado: `dpl_F9ABHiLqAuAZvoDvzvG9uJ9M9KAT`, target `preview`, estado `Ready`.
- Variables de rama Preview: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`, `SITE_URL`, `LMV_PREVIEW_SAFE_MODE`, `META_SEND_MODE`, `META_WHATSAPP_SEND_MODE` y `CRON_SECRET`.
- Ninguna variable Vercel Production fue cambiada.
- Self-hosted Auth usa el alias estable como `SITE_URL` y lo permite en redirects.
- Vercel Authentication permanece activa; no se debilitó la protección para probar.

## Verificación de código y E2E

- Tests: 498 aprobados, 0 fallidos.
- TypeScript: correcto.
- Lint relevante: correcto.
- Build Next.js 16.2.9: correcto.
- Catálogo anónimo: 14 productos visibles de 15 totales; 21 variantes; 7 categorías; 8 zonas; 0 cupones.
- Snapshot crítico destino: 67 pedidos, 276 contactos CRM, 269 conversaciones, 7,319 mensajes omnichannel, 1 thread Wonka, 80 mensajes Wonka y 39 jobs Wonka.
- Preview: home, checkout y producto HTTP 200; ninguna página probada contiene el hostname Supabase administrado.
- Checkout: lectura de disponibilidad HTTP 200; POST inválido regresó 400 antes de escribir; conteo de pedidos permaneció en 67.
- Auth: alta temporal, rol admin, login, refresh, logout y limpieza correctos. El conteo final regresó a 2 usuarios / 2 identidades.
- Admin: 9/9 vistas HTTP 200 (`admin`, pedidos, productos, categorías, zonas, clientes, conversaciones, Wonka e integraciones).
- Social: dos canales (`instagram`, `whatsapp`) confirmados con `read_only_mode=true` y `auto_reply_enabled=false` en el destino.
- Storage: objeto público HTTP 200; objeto privado temporal, signed URL y descarga byte a byte correctos; firma de upload administrativo correcta; temporales eliminados.
- Fallback: pruebas de medios faltantes pasaron; CRM/conversaciones y Wonka renderizaron HTTP 200 pese a adjuntos históricos ausentes.
- Mercado Pago y Flow: las rutas Preview quedaron bloqueadas por safe mode y no contactaron proveedores. Firma, idempotencia, deduplicación, total server-side y transiciones de webhook están cubiertos por la suite; no se generó preferencia ni cobro real.
- Meta/WhatsApp/Instagram: handlers, HMAC, routing, deduplicación, lectura y persistencia están cubiertos por tests; no se hizo outbound ni CAPI real.

## Datos y diferencias desde Fase 4

Los conteos actuales del destino continúan iguales al snapshot de Fase 4 para las 22 relaciones críticas verificadas: productos 15, pedidos 67, categorías 7, zonas 8, cupones 0, integraciones 1, conversaciones 269, mensajes omnichannel 7,319, analytics 1,684, CRM activities 79, oportunidades 633, tablas Wonka 39/84/80/1/11/4, Meta 2/3, historial de pedidos 15/69 y Auth 2/2.

Las diferencias deliberadas del destino son:

- 9 URLs públicas reescritas al hostname self-hosted;
- 71 URLs antiguas conservadas: 69 omnichannel sin binario y 2 firmadas Wonka no reutilizables;
- `channel_settings` de Instagram/WhatsApp forzado a read-only con respaldo reversible de las dos filas;
- policy `storage_anon_insert` eliminada en una fase previa;
- usuarios/objetos de smoke creados y eliminados, sin residuo.

No se ejecutó el delta final ni se volvió a leer el origen administrado en esta fase. Por tanto, no se afirma que producción siga idéntica al snapshot; esa medición pertenece a la ventana de cutover.

El análisis estático identifica como potencialmente mutables, entre otras, estas tablas: `admin_notification_deliveries`, `admin_push_subscriptions`, `agent_memories`, `agent_runtime_configs`, `ai_provider_credentials`, `ajustes`, `analytics_events`, `blocked_delivery_dates`, `blog_posts`, `business_members`, `business_units`, `carritos_abandonados`, `cart_items`, `categorias`, `conversation_orders`, `conversation_reconciliation_state`, `conversations`, `conversion_events`, `crm_activities`, `cupones`, `customer_identities`, `customer_notes`, `customer_tags`, `delivery_settings`, `ingredients`, `integraciones_secretas`, `mcp_access_tokens`, `messaging_transport_status`, `meta_connection_assets`, `meta_connections`, `omnichannel_contacts`, `omnichannel_messages`, `order_status_history`, `payment_reconciliation_queue`, `pedidos`, `product_option_groups`, `product_option_values`, `product_pack_components`, `product_variants`, `productos`, `puntos_pins`, `recipe_ingredients`, `recipes`, `sales_opportunities`, `season_products`, `seasons`, `store_reservations`, `usage_events`, `wonka_job_events`, `wonka_jobs`, `wonka_messages`, `wonka_threads`, `wonka_tool_audit`, `wonka_worker_tokens` y `zonas`. Auth, Storage metadata y secuencias también deben tratarse como mutables.

## Storage y URLs

- Metadata: 127 objetos / 74,808,818 bytes.
- Recuperados y respaldables: 27 objetos / 39,405,106 bytes, todos en `productos`.
- Pendientes: 100 objetos / 35,403,712 bytes: 87 `omnichannel-media`, 7 `wonka-attachments` y 6 históricos de `productos`.
- Impacto conocido: 0 críticos, 76 importantes CRM/Wonka, 24 históricos.
- URLs reescritas y HTTP 200: 7 producto, 1 temporada y 1 ajuste.
- URLs pendientes: 69 `omnichannel_messages.payload`, 1 `wonka_jobs.input`, 1 `wonka_messages.metadata`.
- La tabla privada conserva las 80 referencias originales y el rollback reversible permanece disponible.

## Backups y sudo

- Timers de backup y healthcheck: active + enabled.
- Backup forzado después de HTTPS: `lmv-supabase-20260925T033110Z.tar.gz.enc`, resultado `success`; copia Windows descargada y checksum verificado.
- Se corrigió el backup para firmar S3 con el hostname HTTPS canónico en lugar de loopback.
- Restore drill repetido: 129 tablas, 325 constraints, 27 objetos / 39,405,106 bytes; temporales eliminados.
- Existen dos envelopes DPAPI independientes para la misma clave de backup. Ambos están fuera del VPS, pero en este mismo Windows; el segundo aún debe copiarse a medio desconectado para ser físicamente offline.
- `supabaseops`: SSH por clave funciona; password status `P`; sudo con contraseña fue probado desde una sesión nueva con UID 0.
- La regla global `/etc/sudoers.d/90-supabaseops` fue eliminada; `sudo -n` falla, por lo que `NOPASSWD` quedó retirado.
- La contraseña sudo está sólo en `outputs/supabaseops-sudo-password.dpapi`, protegida por DPAPI para esta cuenta Windows; no fue mostrada ni guardada en texto plano.

## Secretos e integraciones

| Grupo | Estado antes de cutover |
|---|---|
| JWT/anon/service role/DB/S3 self-hosted | nuevos, activos y fuera de Git |
| CRON Preview | nuevo y limitado a la rama Preview |
| Meta/WhatsApp | cuentas/metadata detectables y canales read-only; outbound bloqueado |
| `META_TOKEN_ENCRYPTION_KEY` | no se encontró una copia segura recuperable; no se validó descifrado de tokens migrados |
| Mercado Pago / Flow | lógica, firmas e idempotencia validadas; proveedor real no invocado |
| Google OAuth | deshabilitado; no se inventaron credenciales/callbacks |
| Gemini/Wonka | datos y UI validados; llamada externa real no ejecutada |
| SMTP/Resend | outbound bloqueado; credencial/remitente real no validados |
| Platform S3 temporal | revocada por el operador; copias temporales eliminadas |

## Procedimiento preparado para delta/cutover

No ejecutar sin aprobación explícita:

1. Activar una ventana de mantenimiento y congelar todas las escrituras de frontend, admin, cron y webhooks sobre Platform.
2. Confirmar cero writers y tomar dumps finales separados de roles, schema y data con hashes; exportar Auth y el inventario Storage final en modo read-only.
3. Restaurar el dump final primero en una DB temporal del VPS. Comparar las 108 tablas, PK/FK, secuencias y fingerprints contra el snapshot y producir el conjunto exacto de tablas/filas cambiadas.
4. Hacer backup cifrado del destino actual. Aplicar el delta en una transacción con `session_replication_role=replica`, orden FK, upserts por PK, bajas explícitamente revisadas y `setval` de secuencias. Reaplicar las transformaciones exclusivas del destino (URLs recuperadas, canales read-only y hardening Storage).
5. Repetir conteos/fingerprints, Auth, constraints, RPC, triggers, RLS y Storage. Verificar especialmente objetos nuevos creados desde el snapshot; Platform S3 402 impide asumir que se copiaron.
6. Invalidar sesiones antiguas del destino para forzar un nuevo login seguro.
7. Sólo entonces cambiar variables Vercel Production, callbacks/webhooks y desplegar Production.
8. Ejecutar smoke de producción sin cobros/mensajes reales primero; habilitar side effects uno por uno.
9. Mantener Platform intacto como rollback temporal y registrar el instante de freeze.

## Rollback preparado

1. Revertir Vercel Production a sus variables/deployment anteriores.
2. Revertir callbacks/webhooks al origen administrado.
3. Mantener DNS del backend nuevo independiente; no es necesario tocar apex ni `www` para volver el frontend.
4. Si sólo falla Preview/backend, detener Caddy y retirar únicamente el registro `supabase`/reglas 80-443; Envoy sigue loopback.
5. Restaurar URLs del destino con `migration_support.rollback_legacy_supabase_url_rewrite()` sólo si se decide abandonar el self-host.
6. Restaurar el último backup únicamente en una DB nueva, verificar y luego promover mediante un procedimiento aprobado; nunca restaurar a ciegas sobre `postgres`.

## Bloqueadores reales restantes

1. Falta recuperar o reconfigurar de forma segura `META_TOKEN_ENCRYPTION_KEY`; no se pudo demostrar que los tokens Meta migrados sean descifrables.
2. SMTP/Resend, Google OAuth y proveedores externos no tienen validación real porque no se autorizaron side effects ni se inventaron secretos.
3. Quedan 100 binarios históricos/importantes; no bloquean el núcleo comercial por sí solos, pero cualquier objeto nuevo desde el snapshot debe auditarse en el delta.
4. El segundo escrow existe, pero aún no está en un medio físicamente desconectado/separado.
5. Falta ejecutar y verificar el delta final después de congelar escrituras.
6. Falta aprobación explícita para Production, webhooks/endpoints públicos y habilitación gradual de outbound/pagos.

## Stop point

No se cambió Vercel Production, el dominio principal, `www`, correo, endpoints productivos ni datos/esquema del Supabase administrado. No se ejecutó el cutover. Esperar aprobación explícita.
