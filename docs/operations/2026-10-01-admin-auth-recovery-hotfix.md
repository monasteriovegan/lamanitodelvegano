# Hotfix de recuperación Auth administrativa — 2026-10-01

## Alcance y resultado técnico

Se auditó el usuario administrador y la configuración efectiva del contenedor `supabase-auth` sin imprimir passwords, hashes, tokens, JWTs ni credenciales SMTP. El Supabase administrado no fue consultado ni modificado. No se reinició el VPS; sólo se recreó el servicio Auth después de respaldar su `.env` root-only.

## Problema | Causa raíz | Antes | Después | Evidencia

| Problema | Causa raíz | Antes | Después | Evidencia |
|---|---|---|---|---|
| Login con la contraseña anterior | La cuenta y su hash bcrypt son válidos, pero el hash del destino ya no coincide con el snapshot de corte. El audit log registra `user_updated_password` el 2026-09-27 y un login posterior correcto. Los intentos del 2026-10-01 devuelven `invalid_credentials`; no hay evidencia de usuario ausente, baneado, borrado o sin rol. | La contraseña previa al cambio del 2026-09-27 no valida contra el hash actual. | Se conserva el hash actual; no se reemplaza por SQL. La recuperación segura es la vía autorizada. | UUID Auth e identidad coinciden; `encrypted_password` presente y con formato bcrypt; email confirmado; rol `admin`; 0 roles huérfanos. |
| Recovery terminaba en Vercel | GoTrue tenía el Preview como `GOTRUE_SITE_URL`; su allowlist sólo contenía localhost y el Preview. El cliente además construía `redirectTo` desde `window.location.origin`. | `SITE_URL=https://lmv-selfhost-preview.vercel.app`; callback dependiente del origen del navegador. | `SITE_URL=https://lamanitodelvegano.cl`; callback explícito canónico; sin fallback Vercel, localhost o `*.supabase.co`. | Entorno real leído dentro del contenedor antes/después y pruebas automatizadas. |
| El primer enlace canónico mostró `callback-failed` | La solicitud controlada directa a GoTrue devolvió la sesión de recuperación en el fragmento `#`; los fragmentos no llegan a un Route Handler del servidor. | El callback sólo podía intercambiar `?code=` y trataba el enlace por fragmento como carente de credenciales. | El callback cliente admite PKCE con `exchangeCodeForSession()` y recuperación implícita con `setSession()`. Elimina código/tokens de la barra antes de cualquier `await` y sólo acepta `type=recovery`. | Pruebas de ambos contratos; evento `user_updated_password` y login posterior registrados por Auth. |
| Callback aceptaba un `next` arbitrario | `new URL(next, origin)` usaba el valor sin validación. | Un `next` absoluto o protocol-relative podía convertirse en redirect externo. | Sólo se aceptan rutas normalizadas bajo `/admin/`; todo lo demás cae en `/admin/productos`. | Pruebas para URL absoluta, `//host`, backslash, ruta no admin, path traversal y valor ausente. |

## Estado Auth y autorización

- Usuario administrador: existe.
- UUID: `6989c98c-3a03-4076-90c1-9cbd6f80807f`.
- Email confirmado: sí.
- Identidad: una identidad `email`, con el mismo UUID.
- Password cifrada: presente; formato bcrypt válido. El valor no se extrajo ni imprimió.
- `admin_roles`: rol `admin`, mismo UUID; 0 filas huérfanas.
- Baneado: no.
- Eliminado: no.
- Usuarios / identidades / roles admin: `2 / 2 / 2`.
- Snapshot final de origen: el UUID coincide; el hash no coincide porque el destino registra un cambio de contraseña posterior al snapshot (`user_updated_password`, 2026-09-27T02:49:52Z), seguido de login correcto.

## GoTrue efectivo

| Variable/estado | Antes | Después |
|---|---|---|
| Imagen | `supabase/gotrue:v2.196.0` | sin cambio |
| `API_EXTERNAL_URL` | `https://supabase.lamanitodelvegano.cl/auth/v1` | sin cambio |
| `GOTRUE_SITE_URL` | `https://lmv-selfhost-preview.vercel.app` | `https://lamanitodelvegano.cl` |
| `GOTRUE_URI_ALLOW_LIST` | localhost + alias Preview | callback canónico y callback canónico con `next=/admin/update-password` |
| Signup | deshabilitado | sin cambio |
| SMTP | Resend `smtp.resend.com:587`; usuario/clave presentes | sin cambio; TCP verificado |
| Auth health | healthy | healthy; HTTP 200 con clave pública protegida |

El primer probe HTTP posterior al recreate recibió 401 porque se llamó el endpoint público sin `apikey`. No fue un fallo del servicio: Docker ya informaba `healthy`. La repetición read-only con el encabezado público requerido devolvió 200.

## Código y tests

- `adminRecoveryRedirectUrl()` fija `https://lamanitodelvegano.cl/admin/callback?next=/admin/update-password`.
- `safeAdminCallbackPath()` bloquea redirects externos y restringe el destino a rutas `/admin/`.
- El callback intercambia PKCE con `exchangeCodeForSession()` y acepta de forma restringida la sesión de recuperación por fragmento con `setSession()`.
- Código y tokens se eliminan inmediatamente de la barra mediante `history.replaceState()` y nunca se registran.
- La pantalla de nueva contraseña mantiene `updateUser({ password })` y retorno a `/admin/login`.
- La autorización continúa consultando `admin_roles` por el UUID de Auth.

Evidencia previa al despliegue:

- Prueba enfocada: 7/7.
- Suite completa unificada: 540/540.
- Build remoto Vercel: compilación, TypeScript y 67/67 páginas generadas; `READY`.
- El `tsc --noEmit` directo conserva 3 errores preexistentes en `test/vps-systemd-cron-migration.test.ts` por `ProcessEnv.NODE_ENV`.
- El lint global conserva 506 hallazgos preexistentes (479 errores, 27 warnings); el hotfix no pretende sanear esa deuda global.
- El build local no puede prerenderizar sin variables Supabase sensibles; `vercel pull` no entrega esos valores. El build remoto Production, que sí recibe el entorno protegido, terminó correctamente.

## Deployment y smoke

- Commits Auth: `6dc6dd3` y `2491172`.
- Deployment Production final: `dpl_Uox8gmCwvfwHrP4EoMxtBHokiTYP`.
- Estado: `READY`.
- Alias: `https://lamanitodelvegano.cl`.
- `/admin/login`: 200.
- `/admin/update-password`: 200.
- `/admin/productos` sin sesión: 307 a `/admin/login`.
- `/admin/callback`: 200 y procesamiento cliente restringido.
- Callback con `next=https://evil.example`: el destino se normaliza a `/admin/productos`; no puede salir del dominio.

## Recovery controlado

- Solicitud única aceptada por Auth: HTTP 200 a `2026-10-01T15:50:02Z`.
- El audit log registra `user_recovery_requested` para el UUID administrador.
- El log GoTrue registra como `referer` únicamente el callback canónico con `next=/admin/update-password`.
- La credencial Resend disponible está limitada a envío: el endpoint de listado respondió 403. No se reenvió un segundo correo y no se intentó ampliar permisos.
- Cambio manual confirmado por el administrador.
- Audit Auth: `user_updated_password` a `2026-10-01T16:00:56Z`.
- Audit Auth: login exitoso posterior a `2026-10-01T16:01:23Z`.

## Regresión visual detectada y corregida

El primer despliegue del hotfix Auth partió de la rama de migración, que aún no contenía cuatro commits recientes de la campaña de fin de semana. La base ya apuntaba a diez archivos bajo `/campaigns/especial-fin-de-semana/`, pero ese deployment no los incluía, por lo que devolvían 404 y el catálogo mostraba imágenes rotas.

Se integraron los commits de campaña completos (`79ab614`, `633ab0e`, `7045852`, `fc25dfe`) en la misma versión del hotfix Auth y se volvió a desplegar. No se reescribieron productos, precios ni stock. Verificación final: los diez assets responden HTTP 200 con `Content-Type: image/png`; portada y ruta `/especial-fin-de-semana` responden 200.

## Ventana de entrega de la campaña

Por aprobación posterior se configuró para los 11 productos de `especial-fin-de-semana` la ventana explícita de entrega `2026-10-03` y `2026-10-05` a `2026-10-10`. Los domingos 4 y 11 quedan excluidos. La regla vive en la migración `20261001170000_especial_fin_de_semana_delivery_dates.sql`; el endpoint real de checkout devolvió la misma lista tanto para un producto individual como para un carrito con dos productos de campaña.

Antes de modificar el destino se generó el rollback root-only `/opt/supabase-lamanito/audits/weekend-delivery-20261001T175612Z/rollback.sql`.

## Estado de infraestructura tras el cambio

- Supabase: 11/11 contenedores `running|healthy`.
- Timers activos y programados: `lmv-supabase-healthcheck`, `lmv-supabase-backup`, `lmv-reconciliation`, `lmv-abandoned-carts`, `lmv-opportunities`.
- Backup previo al cambio: `/root/lmv-secrets/stack.env.before-admin-auth-20261001T153906Z`, root-only.

## Guardrails preservados

No se cambiaron Remy, Meta CAPI, Pixel, WhatsApp, Instagram, timers, Mercado Pago, pedidos, stock, clientes ni el Supabase administrado. No se reinició el VPS completo.

## Resultado final

La recuperación, el cambio de contraseña y el login administrador quedaron confirmados. Ninguna contraseña, hash o token fue impreso ni persistido en el repositorio o en este informe.
