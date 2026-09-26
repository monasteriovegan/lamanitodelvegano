# Auditoría final de precutover — Supabase self-hosted

Fecha: 2026-09-26. Alcance: resolución de bloqueadores y preparación de cutover, sin ejecutar producción.

## Resultado ejecutivo

La plataforma self-hosted, la base de datos migrada y la Preview son técnicamente estables. La comparación read-only del origen administrado contra el snapshot de Fase 4 no encontró cambios de filas en ninguna de las 108 relaciones exportadas. Roles y esquema son idénticos byte a byte. El E2E principal y las 498 pruebas continúan aprobados.

El cutover no está listo porque faltan tres controles funcionales imprescindibles: recuperar o reemplazar mediante reconexión explícita la clave de cifrado Meta, configurar un SMTP real para Supabase Auth y configurar/verificar el secreto de firma del webhook de Mercado Pago. También falta colocar el segundo escrow en un medio físicamente desconectado.

No se cambió Vercel Production, sus variables, el dominio principal, los webhooks productivos, los proveedores de pago ni el Supabase administrado.

## Evidencia consolidada

- Backend: `https://supabase.lamanitodelvegano.cl`.
- Preview: `https://lmv-selfhost-preview.vercel.app`.
- Stack: Supabase `self-hosted/v0.8.1`, commit `8c7a4d9dbbaf8b552893822e89d7bf06f33f9220`, PostgreSQL `17.6.1.136`, Envoy `1.39.1` y Caddy `2.11.4-alpine`.
- Contenedores: 11/11 servicios Supabase healthy; Caddy running.
- Red pública: sólo TCP 22, 80 y 443. TCP 3000, 5432, 6543 y 8000 no son accesibles desde Internet. Envoy escucha únicamente en `127.0.0.1:8000`; Studio no se publica.
- UFW: activo; `deny incoming`, `deny routed`; permite únicamente SSH, HTTP y HTTPS, IPv4/IPv6.
- Recursos: 11 GiB RAM, 2.0 GiB usados y 9.7 GiB disponibles; swap 4 GiB activa; disco 193 GiB, 19 GiB usados (10%); DB 36,670,611 bytes; `/opt/supabase-lamanito` 1,906,482,237 bytes.
- Backup y healthcheck: ambos timers enabled + active. No existe sudo global NOPASSWD ni la regla temporal de la auditoría.
- Repositorio: 498/498 pruebas, TypeScript correcto y build Next.js 16.2.9 correcto con configuración de build no secreta.
- Preview E2E: catálogo, producto, checkout dry-run, login/refresh/logout, nueve vistas admin, pedidos, CRM, conversaciones, Wonka, Storage público/privado y signed URL aprobados. Mercado Pago y Flow fueron bloqueados antes de contactar proveedores.

## Delta vivo del origen

La auditoría read-only terminó a `2026-09-26 20:46:10 UTC`. Generó roles, schema, data y metadatos por separado, con permisos `root:root 0600` y checksums verificados. La contraseña temporal y la regla sudo temporal fueron eliminadas al terminar.

Comparación contra el snapshot de Fase 4:

| Evidencia | Resultado |
|---|---|
| Roles | idénticos byte a byte, 297 bytes |
| Schema | idéntico byte a byte, 242,075 bytes y 274 objetos contados |
| Data | 108 bloques `COPY` en ambos dumps; mismos conteos y fingerprints por tabla |
| INSERT | 0 |
| UPDATE | 0 |
| DELETE | 0 |
| Usuarios Auth nuevos | 0; siguen 2 usuarios, 2 hashes de contraseña y 2 confirmados |
| Identidades nuevas | 0; siguen 2 identidades, ambas `email` |
| Pedidos nuevos/cambiados | 0 |
| Mensajes nuevos/cambiados | 0 |
| Stock modificado | 0 |
| Configuración nueva/cambiada | 0 |
| Objetos Storage nuevos/cambiados | 0 |

El archivo completo de data difiere sólo por orden físico de filas; la comparación normalizada por PK o multiset confirmó cero cambios. Esta medición deja de ser definitiva ante cualquier escritura posterior a la hora indicada, por lo que debe repetirse después del freeze final.

Estado Storage del origen en esa lectura:

| Bucket | Visibilidad | Objetos | Bytes |
|---|---:|---:|---:|
| `omnichannel-media` | privado | 87 | 12,759,213 |
| `productos` | público | 33 | 60,141,883 |
| `wonka-attachments` | privado | 7 | 1,907,722 |
| **Total** |  | **127** | **74,808,818** |

## Secretos e integraciones

### Meta, Instagram y WhatsApp

`META_TOKEN_ENCRYPTION_KEY` existe como variable sensible de Vercel Production, pero Vercel no permite recuperar su valor mediante exportación. No se encontró ningún candidato utilizable en Preview/Development, archivos locales protegidos, VPS, configuración versionada ni historial Git. Por ello no se inventó ni instaló una clave nueva y no se intentó descifrar o llamar a Meta.

Quedarían ilegibles en el self-hosted dos credenciales cifradas existentes:

- una conexión activa `meta`;
- una conexión activa `meta_instagram_login`, con expiración registrada el 2026-11-02;
- activos asociados: una página, una cuenta Instagram y un número WhatsApp seleccionados.

Intervención humana requerida si la clave no aparece en un gestor externo:

1. Un administrador del Business/App de Meta define una nueva clave aleatoria en el almacén seguro del futuro entorno Production y self-hosted.
2. Sin borrar la conexión anterior, inicia una reconexión OAuth de Meta/Facebook y otra de Instagram Login desde una sesión administrativa controlada.
3. Vuelve a seleccionar Page, Instagram Business Account, WABA y phone ID.
4. Verifica scopes, expiración y descifrado sólo por estado OK/ERROR.
5. Mantiene Instagram/WhatsApp en read-only y outbound/CAPI deshabilitados.
6. Tras la validación, archiva las credenciales cifradas antiguas; no las sobrescribe silenciosamente.

### SMTP y Auth email

No se encontró proveedor SMTP/Resend personalizado en Vercel Production ni una clave Resend activa en la DB. La evidencia indica que el Auth administrado depende del mailer del propio Supabase Platform. El self-hosted conserva el placeholder `localhost:25`, que no es alcanzable desde el contenedor Auth; remitente y nombre también son locales.

El login por email/password funciona, pero reset de contraseña, confirmación de correo y cualquier email generado por Auth no pueden entregarse. Signup está deshabilitado y Google OAuth también, pero el reset de contraseña sigue siendo un requisito operativo. Antes del cutover se debe configurar un proveedor SMTP real, remitente/dominio verificado, credenciales protegidas y probar con una casilla controlada, no con clientes reales. Las plantillas deben conservar rutas `/auth/v1/verify`, `SITE_URL` de producción y redirects aprobados.

### Google OAuth

No está en uso: Auth reporta sólo identidades `email`, Google está deshabilitado y no existen `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` en el entorno auditado. No bloquea el cutover. Si se habilita en el futuro, debe agregarse `https://supabase.lamanitodelvegano.cl/auth/v1/callback` sin retirar antes el callback del origen administrado.

### Mercado Pago

Production contiene un Access Token, pero no se detectó `MERCADOPAGO_WEBHOOK_SECRET`. La implementación actual acepta la firma cuando el secreto está vacío y luego valida el pago consultando al proveedor, importe, moneda, pedido, idempotencia y transiciones. Esa defensa posterior no reemplaza la autenticidad del webhook.

Antes del cutover debe crearse/configurarse el secreto de webhook en Mercado Pago y en el futuro entorno Production, conservar el Access Token, confirmar la URL canónica de notificación/retorno y verificar una notificación de prueba firmada sin realizar un cobro real. El código conserva asociación `external_reference` → pedido y evita degradar un pedido ya pagado.

### Flow, Gemini/Google, Wonka y crons

- Flow: deshabilitado y sin credenciales; no bloquea mientras el negocio confirme que no se usa. Preview lo bloquea por safe mode.
- Gemini: `GEMINI_API_KEY` existe en Production, no en Preview/self-hosted. Debe trasladarse de forma segura durante el cutover si Wonka/Remy lo requiere. La DB declara AI deshabilitada y no se hizo una llamada real.
- Wonka: DB, jobs, threads, mensajes y UI funcionan. Google Calendar no tiene credenciales ni tokens y queda como función opcional no disponible.
- Crons: existen exactamente tres: carritos abandonados `0 13 * * *`, oportunidades `0 14 * * *` y reconciliación `0 8 * * *`. `CRON_SECRET` existe. Debe mantenerse no vacío; los dos primeros handlers degradan su autenticación si falta. No se ejecutó ningún cron en esta auditoría.

## Independencia del backend administrado

El escaneo de runtime en `src`, `public` y `workers` encontró cero referencias ejecutables al hostname administrado. La prueba E2E sobre Preview cubrió homepage, catálogo, producto, checkout dry-run, Auth, admin, pedidos, CRM y Wonka sin dependencia operativa del host `*.supabase.co`.

Permanecen 71 URLs históricas sólo en datos: 69 en payloads omnichannel y 2 URLs firmadas Wonka. No intervienen en catálogo, checkout, pedidos, stock o login/admin. Las nueve URLs públicas críticas fueron reescritas y responden HTTP 200.

La deuda Storage sigue siendo 100 objetos / 35,403,712 bytes: 87 de `omnichannel-media`, 7 de `wonka-attachments` y 6 históricos de `productos`. Cero son críticos para ventas; 76 afectan contexto histórico CRM/Wonka y 24 son históricos. Los fallbacks de CRM/Wonka fueron probados.

## Escrow offline

Existe `lmv-selfhost-backup-key-escrow-2.dpapi`, protegido con DPAPI y fuera del VPS. No se detectó un medio removible disponible, por lo que aún reside en el mismo computador Windows.

**Requiere que el usuario copie este archivo a un USB/medio offline y lo desconecte.**

## Procedimiento idempotente de delta

1. Congelar nuevas compras y mutaciones admin; pausar crons, outbound y automatizaciones; anotar UTC exacta y el último pedido conocido.
2. Dejar que finalicen requests en curso y hacer que webhooks mutantes respondan temporalmente con reintento, sin confirmar eventos no persistidos.
3. Generar dumps finales oficiales de roles, schema y data, además del inventario Auth/Storage; verificar checksums.
4. Crear un backup cifrado del destino y verificar su restauración en una DB temporal.
5. Comparar los 108 bloques por PK/fingerprint y producir una allowlist exacta de filas insertadas, actualizadas y eliminadas desde el snapshot.
6. Separar explícitamente registros temporales del self-hosted; nunca truncar ni reemplazar tablas completas a ciegas.
7. Aplicar el delta en transacción con advisory lock, orden FK y `session_replication_role=replica`; usar upsert por PK, conservar UUID/timestamps y revisar manualmente cada delete.
8. Restaurar `session_replication_role=origin`, ejecutar `setval` para secuencias y validar FK, constraints, RPC, triggers y RLS.
9. Reaplicar únicamente diferencias deliberadas del destino: URLs recuperadas, canales read-only y policy Storage endurecida.
10. Sincronizar Auth por ID sólo si cambió, preservando hashes; invalidar sesiones antiguas para forzar login nuevo.
11. Sincronizar únicamente objetos Storage nuevos con S3/rclone cuando Platform lo permita; no copiar al volumen interno.
12. Repetir conteos, hashes y controles de último pedido, stock, usuarios, conversaciones e integraciones. Si cualquier comparación falla, abortar antes de Production.

El proceso es repetible: los upserts están identificados por PK, las eliminaciones requieren allowlist y los fingerprints permiten confirmar un segundo pase sin cambios.

## Secuencia exacta de cutover preparada — no ejecutada

Ventana esperada: **60–90 minutos**, más una observación intensiva de 60 minutos. Abortar si al minuto 60 no se alcanzó la validación de datos o si quedan eventos de pago sin reconciliar.

1. Activar mantenimiento/freeze de escrituras; pausar cron, outbound y automatizaciones.
2. Registrar UTC, último pedido, últimos eventos de pago/mensajería y deployment Production actual.
3. Ejecutar último dump/delta de roles, schema, data, Auth y Storage con checksums.
4. Hacer backup cifrado del destino y aplicar el delta idempotente, sin tocar el origen.
5. Verificar todas las tablas críticas, FK, RPC, triggers, RLS y fingerprints.
6. Verificar el último pedido por ID, timestamp, estado e identificador del proveedor.
7. Verificar stock de productos/variantes y reservas contra el origen congelado.
8. Verificar usuarios, identidades, `admin_roles` y capacidad de login/reset controlado.
9. Verificar conversaciones, mensajes, CRM, Meta y Wonka sin outbound.
10. Generar y verificar un backup pre-cutover final; confirmar copia offsite y escrow offline.
11. Actualizar sólo las variables Vercel Production aprobadas, conservando un inventario/fingerprint y el deployment anterior.
12. Desplegar Production y comprobar que apunta al self-hosted; mantener pagos/outbound deshabilitados.
13. Cambiar callbacks/webhooks necesarios uno por uno, conservar los anteriores durante rollback y verificar firmas.
14. Reactivar primero pagos entrantes y luego mensajería, Meta/CAPI y crons de forma gradual, con idempotencia.
15. Ejecutar smoke de catálogo, producto, checkout controlado, Auth, admin, pedidos, stock, Storage y webhooks de prueba.
16. Quitar mantenimiento sólo si todos los gates pasan; registrar fin UTC y comenzar observación intensiva.

El Supabase administrado debe permanecer intacto y disponible durante todo el periodo de rollback.

## Rollback preparado

Disparadores: fallo de Auth/RLS, catálogo, checkout, pedidos, stock, Storage crítico, integridad, pagos o degradación grave de Meta/WhatsApp.

1. Volver a mantenimiento y deshabilitar crons, outbound y productores de escritura nuevos.
2. Promover el deployment Production anterior, que conserva su snapshot de variables, y restaurar las variables anteriores desde el almacén seguro si fuera necesario.
3. Restaurar callbacks/webhooks anteriores y confirmar recepción en el Supabase administrado.
4. Validar login, catálogo, pedidos y Storage en el origen antes de reabrir.
5. Mantener el self-hosted aislado, preservar logs/backups y no destruir ni modificar el origen.
6. Reconciliar el intervalo desde el freeze usando ambos orígenes y los proveedores como autoridad de pagos: unir por ID de pedido, `external_reference`, ID de pago y timestamp; nunca degradar `paid/refunded`; resolver duplicados manualmente y ajustar stock sólo tras aprobar cada diferencia.
7. Reprocesar eventos idempotentes pendientes y documentar cada pedido/mensaje reconciliado antes de quitar mantenimiento.

No debe intentarse una sincronización automática bidireccional durante rollback.

## Matriz final

| Componente | Estado | Evidencia | Bloquea cutover |
|---|---|---|---|
| DB | OK | PG17 healthy; schema idéntico; delta de filas 0/0/0 | No |
| Auth | Parcial | 2 usuarios/2 identidades; login/refresh/logout OK; reset depende de SMTP | Sí, por SMTP |
| Storage crítico | OK | 27 objetos críticos/recuperados; 100 pendientes no críticos; fallbacks probados | No |
| SMTP | ERROR | `localhost:25` inaccesible; sin proveedor real configurado | **Sí** |
| Google OAuth | No utilizado | sólo identidades email; provider deshabilitado | No |
| Meta | ERROR | clave de cifrado no recuperable; 1 conexión cifrada | **Sí** |
| Instagram | ERROR | token `meta_instagram_login` cifrado no descifrable en destino | **Sí** |
| WhatsApp | Parcial | activo/phone ID inventariados y canal read-only; dependencia Meta no validable | **Sí** |
| Mercado Pago | ERROR | Access Token presente; secreto de webhook ausente y firma fail-open | **Sí** |
| Wonka | OK parcial | DB/UI/jobs aprobados; Google Calendar opcional no configurado | No |
| Flow | No utilizado | deshabilitado y sin credenciales | No, si negocio confirma desuso |
| Gemini/Google | Parcial | Gemini existe en Production; no trasladado aún; Google Calendar no configurado | No independiente |
| Crons | Preparado | tres schedules y `CRON_SECRET`; no ejecutados | No, si el secreto se conserva |
| Backups | Parcial | cifrados, restore drill y timers OK; escrow offline físico pendiente | **Sí, operativo** |
| HTTPS | OK | TLS público; API/JWKS/Storage disponibles; Studio 404 | No |
| Preview | OK | E2E principal aprobado; pagos/outbound bloqueados | No |
| Secretos | ERROR | secretos core nuevos protegidos; clave Meta y webhook MP pendientes | **Sí** |
| Delta | OK al corte | 108 tablas sin cambios a 20:46:10 UTC; repetir tras freeze | No ahora; gate obligatorio |
| Rollback | Preparado | pasos, triggers y reconciliación documentados | No |

## Bloqueadores técnicos objetivos

1. `META_TOKEN_ENCRYPTION_KEY` no es recuperable desde los almacenes auditados y dos conexiones Meta cifradas quedarían ilegibles; requiere recuperar la clave o reconectar OAuth con intervención humana.
2. Self-hosted Auth no tiene SMTP operativo; reset/confirmación/emails Auth no pueden entregarse.
3. Mercado Pago no tiene secreto de webhook y la implementación actual acepta la firma si el secreto está vacío.
4. El segundo escrow todavía no está en un USB/medio físicamente desconectado.

**NOT READY FOR CUTOVER**
