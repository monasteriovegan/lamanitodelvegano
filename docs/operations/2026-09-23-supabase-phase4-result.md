# Phase 4: resultado de migración aislada de datos, Auth y Storage

Fecha de cierre: 2026-09-24.

## Estado ejecutivo

La base de datos de aplicación y Auth fue migrada al self-hosted y validada sin diferencias de filas, claves foráneas ni secuencias. Storage quedó **bloqueado parcialmente**: se restauró su metadata SQL, pero Supabase Platform rechazó el acceso S3 con HTTP 402 `Payment Required`, por lo que no se copió ningún objeto físico. No se intentó ningún método alternativo.

No se cambió DNS, Vercel Production, variables de producción ni endpoints públicos. El Supabase administrado se usó en modo read-only para dumps/consultas; no se modificaron sus datos.

## Backup previo

| Archivo en el VPS | Bytes | Permisos |
|---|---:|---|
| `roles.sql` | 297 | `root:root 0600` |
| `schema.sql` | 242.075 | `root:root 0600` |
| `data.sql` | 10.976.939 | `root:root 0600` |
| `SHA256SUMS` | 228 | `root:root 0600` |

- Los tres hashes SHA-256 fueron verificados.
- El dump oficial contiene 108 bloques `COPY` y 108 terminadores.
- El password temporal del origen fue destruido y se comprobó su ausencia.
- Se creó una copia externa al VPS cifrada con AES-256-GCM. La clave aleatoria está protegida con Windows DPAPI para el usuario actual.
- La copia cifrada se descifró en un directorio temporal, se verificaron nuevamente los hashes y se eliminó todo el staging plano.
- Riesgo operativo: la clave DPAPI depende de este usuario/equipo Windows. El archivo cifrado y el archivo `.key.dpapi` deben conservarse juntos, pero no subirse a Git.

## Restauración de datos y Auth

El dump se importó con `psql --single-transaction --set ON_ERROR_STOP=1`. El propio dump fijó `session_replication_role = replica`; después de finalizar se verificó que una sesión nueva devuelve `origin`.

### Compatibilidad Auth

La Platform contiene cuatro tablas nuevas que no existen en la release self-hosted fijada, y una tabla con una columna adicional:

- `auth.mfa_recovery_code_sets`
- `auth.mfa_recovery_codes`
- `auth.scim_tokens`
- `auth.scim_users`
- `auth.one_time_tokens.expires_at`

Las cinco tablas involucradas tenían 0 filas en el origen. Se creó `data-compatible.sql` sin esos cinco bloques vacíos; el dump original no se alteró. La copia compatible contiene 103 bloques `COPY` y ninguna tabla o columna requerida falta en el destino.

El destino posee columnas adicionales esperadas de su propia versión: `auth.identities.email`, `auth.users.confirmed_at` y `storage.objects.path_tokens`.

### Resultado global

- Tablas incluidas en el snapshot: **108**.
- Diferencias de conteo: **0**.
- Claves foráneas verificadas: **136**.
- Filas huérfanas: **0**.
- Secuencias verificadas: **4**.
- Diferencias de secuencia: **0**.
- Funciones/RPC públicas: **29**, iguales al esquema validado.
- Triggers públicos: **15**, iguales al esquema validado.
- Policies públicas: **93**; policies Storage: **2**.
- Tablas públicas: **77**; 76 tienen RLS habilitado según su definición viva.

El inventario completo está en `phase4-table-counts.tsv` y la evidencia de integridad referencial en `phase4-fk-validation.tsv`.

### Conteos críticos

| Relación | Origen | Destino |
|---|---:|---:|
| `productos` | 15 | 15 |
| `pedidos` | 67 | 67 |
| `categorias` | 7 | 7 |
| `zonas` | 8 | 8 |
| `cupones` | 0 | 0 |
| `integraciones_secretas` | 1 | 1 |
| `conversations` | 269 | 269 |
| `omnichannel_messages` | 7.319 | 7.319 |
| `analytics_events` | 1.684 | 1.684 |
| `crm_activities` | 79 | 79 |
| `sales_opportunities` | 633 | 633 |
| `wonka_jobs` | 39 | 39 |
| `wonka_job_events` | 84 | 84 |
| `wonka_messages` | 80 | 80 |
| `wonka_threads` | 1 | 1 |
| `wonka_tool_audit` | 11 | 11 |
| `wonka_worker_tokens` | 4 | 4 |
| `meta_connections` | 2 | 2 |
| `meta_connection_assets` | 3 | 3 |
| `order_change_log` | 15 | 15 |
| `order_status_history` | 69 | 69 |

Se compararon 25 tablas críticas del origen vivo y el destino mediante conteo y fingerprint determinístico; las 25 coincidieron.

### Auth

- `auth.users`: **2**.
- `auth.identities`: **2**.
- `auth.sessions`: **22** filas copiadas.
- `auth.refresh_tokens`: **324** filas copiadas.
- Password hashes no nulos: **2**.
- Fingerprint de hashes origen/destino: idéntico.
- Relaciones `admin_roles.user_id -> auth.users.id`: **2** válidas, 0 huérfanas.
- Las claves JWT/API del self-hosted son nuevas; no se copiaron claves de Platform.
- Google OAuth permanece deshabilitado/no configurado.
- No se creó ninguna sesión durante las pruebas.
- Las sesiones existentes de Platform no deben considerarse válidas. Antes del cutover debe decidirse si se eliminan las filas de sesiones/refresh tokens del destino para forzar reautenticación explícita.

## Storage

### Metadata migrada

| Bucket | Público | Objetos en metadata | Bytes declarados | Fingerprint de rutas |
|---|---|---:|---:|---|
| `omnichannel-media` | No | 87 | 12.759.213 | coincide |
| `productos` | Sí | 33 | 60.141.883 | coincide |
| `wonka-attachments` | No | 7 | 1.907.722 | coincide |
| **Total** |  | **127** | **74.808.818** | coincide |

Los buckets `products` y `blog` no existen en el estado vivo del origen. No se inventaron ni se crearon.

### Bloqueo S3

- `rclone 1.60.1` fue instalado.
- El endpoint S3 interno del self-hosted respondió correctamente y listó los tres buckets.
- Platform S3 respondió **HTTP 402 Payment Required** al primer `rclone lsd`.
- El script se detuvo antes de copiar.
- El archivo temporal `rclone.conf` y el directorio de trabajo se eliminaron.
- No existe manifest de transferencia porque no hubo transferencia.
- La clave S3 temporal creada en Platform debe revocarse desde el dashboard.
- La metadata no equivale a los binarios: una lectura pública devolvió HTTP 500; la creación de signed URL privada devolvió 200, pero su descarga devolvió HTTP 500.
- No se copiaron archivos directamente a `volumes/storage/`.

Por tanto, la migración física de Storage continúa pendiente y es un bloqueo de cutover.

## URLs antiguas

Origen y destino conservan exactamente 80 filas/campos con referencias a `*.supabase.co`:

| Ubicación | Total | Público | Firmado |
|---|---:|---:|---:|
| `ajustes.data` | 1 | 1 | 0 |
| `omnichannel_messages.payload` | 69 | 69 | 0 |
| `productos.imagen_url` | 7 | 7 | 0 |
| `seasons.banner_image` | 1 | 1 | 0 |
| `wonka_jobs.input` | 1 | 0 | 1 |
| `wonka_messages.metadata` | 1 | 0 | 1 |
| **Total** | **80** | **78** | **2** |

No se modificó ninguna. La migración versionada `20260924145426_prepare_legacy_supabase_url_rewrite.sql`:

- respalda los valores completos;
- exige un origin HTTPS definitivo;
- sustituye solo URLs públicas;
- deja las dos URLs firmadas pendientes de regeneración;
- incluye una función de rollback;
- no fue aplicada.

## Secretos externos

La matriz versionada clasifica Meta/WhatsApp, Flow, Mercado Pago, Google OAuth, Gemini, Resend/SMTP, cron, gateway, JWT/API, DB y S3.

Puntos críticos:

- `META_TOKEN_ENCRYPTION_KEY` debe conservarse exactamente para leer los tokens Meta ya cifrados.
- Flow, Mercado Pago, Gemini, Resend y parte de WhatsApp residen en `integraciones_secretas`; la fila migrada tiene fingerprint idéntico.
- Las claves administradas Supabase no se reutilizaron.
- Los secretos del self-hosted permanecen solo en el `.env` protegido del VPS.
- No se cargaron secretos en Git ni se imprimieron valores.

## Pruebas internas

Pasaron:

- health de Auth por Envoy con clave pública;
- lectura anónima de catálogo;
- lectura anónima de producto;
- lectura de pedido con service role;
- API administrativa de Auth: 2 usuarios;
- enlace de ambas identidades administrativas;
- ningún alta de sesión;
- integridad FK, secuencias y conteos;
- API S3 interna del self-hosted.

Bloqueadas por la falta de objetos físicos:

- descarga de objeto público;
- descarga mediante signed URL privada;
- paridad S3 count/bytes/path obtenida por `rclone`.

No se ejecutaron compras, pagos, webhooks, Meta CAPI, correo ni mensajería saliente.

## Seguridad de `storage_anon_insert`

No se encontró un flujo actual que necesite INSERT anónimo directo:

- las cargas administrativas pasan por rutas autenticadas y un cliente `service_role`;
- las cargas desde navegador usan `createSignedUploadUrl` después de validar al administrador;
- adjuntos Wonka y media omnichannel usan rutas servidor autenticadas/service role.

Antes de exponer Storage se recomienda:

1. eliminar `storage_anon_insert`;
2. mantener las cargas a través de rutas servidor o signed-upload de duración corta;
3. restringir prefijo, MIME y tamaño;
4. añadir límite de tamaño explícito a la ruta de firmado de media;
5. aplicar rate limiting;
6. mantener lectura pública solo para los assets del bucket `productos` que realmente deban ser públicos.

No se aplicó este endurecimiento todavía; se preservó paridad con el origen.

## Stack y recursos al cierre

- Release: `self-hosted/v0.8.1`.
- Checkout fijado: `8c7a4d...`; objeto del tag: `690080...`.
- PostgreSQL: `17.6.1.136`.
- Envoy: `1.39.1`.
- Docker Engine: `29.8.1`.
- Docker Compose: `v5.5.1`.
- Contenedores: **11/11 healthy**.
- Base de datos destino: **36.252.819 bytes (35 MB)**.
- RAM: 11 GiB total, aproximadamente 1,9 GiB usada y 9,8 GiB disponible.
- Swap: 4 GiB, aproximadamente 512 KiB usada.
- Disco: 193 GB total, 19 GB usados, 175 GB disponibles.
- `/opt/supabase-lamanito`: aproximadamente 1,5 GB.
- Puerto público: solo `22/tcp`.
- Envoy: `127.0.0.1:8000`.
- No escuchan públicamente 5432, 6543, Studio ni Supavisor.
- UFW: deny incoming, deny routed; solo SSH permitido.

## Incidencias y riesgos pendientes

1. **Bloqueo de cutover:** los 127 objetos Storage no se copiaron por cuota/HTTP 402.
2. La clave S3 temporal de Platform debe revocarse y borrarse del bloc de notas.
3. Google OAuth sigue sin configurar en self-hosted; no se realizó login interactivo. Se validó la identidad/admin por API y DB.
4. Las sesiones y refresh tokens fueron copiadas, pero las claves JWT cambiaron; se requiere una política explícita de invalidación antes del cutover.
5. Las dos URLs firmadas antiguas deben regenerarse, no reemplazarse.
6. `storage_anon_insert` debe retirarse o restringirse antes de exponer Storage.
7. `supabaseops` conserva temporalmente sudo/NOPASSWD para automatización; debe sustituirse por un método administrativo endurecido antes de producción.
8. La copia cifrada externa depende de DPAPI de este equipo Windows.
9. Logs/Analytics continúan deshabilitados.
10. El origen permanece en estado de cuota excedida; debe resolverse para completar Storage y repetir la verificación física.

## Stop point

No hubo cutover. DNS, Vercel Production, variables de producción y endpoints públicos permanecen intactos. No debe avanzarse hasta resolver Storage y recibir una nueva aprobación explícita.

