# Phase 4: matriz de secretos externos

Fecha de ejecución: 2026-09-23/24. Esta matriz registra nombres, ubicación y decisión; no contiene valores.

## Regla de corte

Ningún secreto de producción se configura todavía en endpoints públicos ni en Vercel Production. Los valores ya almacenados en tablas se copiaron como parte del snapshot de base de datos, pero no se usan para ejecutar pagos, webhooks, correo, Meta CAPI ni mensajería saliente durante esta fase.

| Secreto o grupo | Consumidor actual | Origen actual | Decisión | Destino futuro y dependencia |
|---|---|---|---|---|
| `META_TOKEN_ENCRYPTION_KEY` | Descifrado de tokens en `meta_connections` y rutas OAuth/Assets de Meta | Vercel, solo servidor | **Conservar exactamente** | Debe cargarse por canal secreto en el runtime futuro antes de probar tokens migrados. Cambiarla haría ilegibles los tokens existentes. |
| `META_APP_SECRET`, `META_BRIDGE_APP_SECRET`, `META_INSTAGRAM_APP_SECRET` | OAuth, validación de firmas y recuperación de Instagram/WhatsApp | Vercel, solo servidor | Conservar durante validación; rotar después del cutover si se programa una ventana | Runtime de la aplicación en Vercel; reconfigurar callbacks solo cuando exista hostname definitivo. |
| `META_APP_ID`, `META_BRIDGE_APP_ID`, `META_INSTAGRAM_APP_ID`, `META_BUSINESS_ID`, `META_PAGE_ID`, `META_INSTAGRAM_BUSINESS_ID`, `META_WABA_ID`, `WA_PHONE_NUMBER_ID` | Enrutamiento de activos Meta/WhatsApp | Vercel/configuración | Reconfigurar, no son claves privadas pero condicionan el enrutamiento | Runtime de Vercel y panel Meta; verificar correspondencia con `meta_connection_assets`. |
| `META_WEBHOOK_VERIFY_TOKEN` | Verificación de webhooks WhatsApp/Instagram y rutas internas heredadas | Vercel o `integraciones_secretas.wa_verify_token` | Conservar para una prueba controlada; regenerar coordinadamente después | Vercel y panel Meta deben cambiarse en la misma ventana. |
| `META_CONVERSIONS_API_ACCESS_TOKEN`, `META_SYSTEM_USER_TOKEN`, `META_CATALOG_AUDIT_TOKEN` | CAPI y auditoría de catálogo | Vercel/configuración | Conservar para validar; rotar después si corresponde | Vercel, nunca cliente; mantener CAPI deshabilitado hasta cutover. |
| `META_WHATSAPP_SEND_MODE`, `META_SEND_MODE` | Control de mensajería saliente | Vercel | Reconfigurar como `disabled`/`read_only` durante pruebas | Vercel Preview primero; Production solo en cutover aprobado. |
| `META_PROXY_UPSTREAM_URL`, `META_WHATSAPP_CALLBACK_URL` | Proxy y callbacks Meta | Vercel | Reconfigurar | Dependen del hostname público definitivo; no usar IP ni loopback como callback externo. |
| `flow_api_key`, `flow_secret_key` | Creación/firma de pagos Flow | `public.integraciones_secretas` | Conservar en el snapshot; no invocar | Permanecen en DB restringida o se trasladan a un gestor de secretos antes de exponer el servicio. Reconfigurar URL de confirmación en cutover. |
| `mp_access_token` y `MERCADOPAGO_ACCESS_TOKEN`/`MERCADO_PAGO_ACCESS_TOKEN`/`MP_ACCESS_TOKEN` | Preferencias y consultas Mercado Pago | DB y/o Vercel | Conservar uno como fuente canónica; no invocar | Runtime servidor. Verificar sandbox/producción antes de habilitar. |
| `MERCADOPAGO_WEBHOOK_SECRET`/`MERCADO_PAGO_WEBHOOK_SECRET`/`MP_WEBHOOK_SECRET` | Firma del webhook Mercado Pago | Vercel | Conservar o regenerar coordinadamente | Vercel y Mercado Pago en la ventana de cutover. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | OAuth de Google Calendar/Wonka y, si se habilita, Auth social | Vercel/Google Cloud | Conservar; reconfigurar URIs | Vercel y Google Cloud. OAuth público de Auth permanece deshabilitado en esta fase. |
| Refresh token de Google Calendar | Wonka Calendar | `integraciones_secretas.google_calendar_refresh_token` | Conservar; revocar/regenerar solo si falla | DB restringida; depende del mismo cliente OAuth. |
| `GEMINI_API_KEY`, `GOOGLE_API_KEY`, `gemini_api_key` | IA, OCR y Wonka | Vercel y/o `integraciones_secretas` | Conservar una fuente canónica; rotar si hubo exposición | Runtime servidor o DB restringida; nunca cliente. |
| Credenciales de proveedores IA | Wonka/Remy | `ai_provider_credentials` e `integraciones_secretas` | Conservar cifrado/estado actual; validar descifrado antes de uso | DB self-hosted y clave de cifrado asociada, si aplica. |
| `resend_api_key`, `resend_from_email` | Correo transaccional Resend | `integraciones_secretas` | Conservar; no enviar en esta fase | DB restringida; verificar dominio remitente al cutover. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_ADMIN_EMAIL`, `SMTP_SENDER_NAME` | Correos de Supabase Auth | Configuración self-hosted | Reconfigurar; no reutilizar placeholders | `.env` protegido del stack. Activar solo tras validar dominio/remitente. |
| `CRON_SECRET` | Rutas cron de Vercel | Vercel | Regenerar para el entorno futuro | Vercel y scheduler deben actualizarse juntos; no duplicar jobs antes del cutover. |
| `NEXT_PUBLIC_SUPABASE_URL` | Navegador y servidor | Vercel | Reconfigurar más adelante | No cambiar Production hasta aprobación y hostname definitivo. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`/`ANON_KEY`/`SUPABASE_PUBLISHABLE_KEY` | Cliente público y gateway | Platform/Vercel y self-hosted | Usar únicamente las claves nuevas del self-hosted | Vercel Preview primero. No copiar la clave administrada. |
| `SUPABASE_SERVICE_ROLE_KEY`/`SERVICE_ROLE_KEY`/`SUPABASE_SECRET_KEY` | Rutas servidor con bypass de RLS | Platform/Vercel y self-hosted | Usar únicamente las claves nuevas del self-hosted | Vercel servidor; nunca navegador ni Git. |
| `JWT_SECRET`, `JWT_KEYS`, `JWT_JWKS` | Auth, PostgREST, Realtime, Storage y gateway | `.env` protegido self-hosted | Mantener los valores nuevos ya generados | Todos los servicios del stack deben usar el mismo juego. Las sesiones Platform existentes no serán válidas. |
| `POSTGRES_PASSWORD`, `PG_META_CRYPTO_KEY`, `VAULT_ENC_KEY`, `REALTIME_DB_ENC_KEY`, `SECRET_KEY_BASE` | Servicios internos self-hosted | `.env` protegido self-hosted | Mantener/regenerar solo mediante procedimiento coordinado | Solo VPS; nunca Vercel, Git ni logs. |
| `DASHBOARD_USERNAME`, `DASHBOARD_PASSWORD` | Studio | `.env` protegido self-hosted | Mantener nuevos; Studio no público | Solo acceso futuro por túnel SSH/VPN. |
| Credenciales S3 Platform | Extracción de Storage por `rclone` | Supabase Platform | Temporales; revocar/eliminar tras copiar | Archivo temporal `0600` durante la transferencia, nunca Git. |
| `S3_PROTOCOL_ACCESS_KEY_ID`, `S3_PROTOCOL_ACCESS_KEY_SECRET`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD` | Storage S3 self-hosted | `.env` protegido self-hosted | Mantener nuevos | Solo red interna/loopback; no exponer endpoint S3 directamente. |
| `CRON_SECRET` y secretos de gateway internos | Automatizaciones y proxy API | Vercel / `.env` self-hosted | Regenerar por entorno | Activar únicamente después de pruebas Preview y aprobación de cutover. |

## Hallazgos de ubicación

- Flow, Mercado Pago, Gemini, Resend y parte de WhatsApp se consumen desde `public.integraciones_secretas`; esa única fila fue migrada con fingerprint idéntico, sin mostrar valores.
- Tokens Meta cifrados se encuentran en las tablas `meta_connections`/`meta_connection_assets`; su lectura depende de `META_TOKEN_ENCRYPTION_KEY`.
- Las claves Supabase administradas no se copiaron. El self-hosted conserva sus propias claves nuevas en `/opt/supabase-lamanito/stack/.env`, fuera de Git y con acceso restringido.
- No se cargó ningún secreto de producción adicional en el VPS durante esta fase, excepto los valores contenidos dentro del snapshot de base de datos autorizado.
