# WhatsApp inbound — resultado de Entrega 1 (2026-08-31)

## Resultado

La aplicación quedó desplegada en producción con recepción/persistencia observable y política `read_only` fail-closed. La entrega real de nuevos webhooks permanece bloqueada en el límite externo Meta WABA → app: Meta acepta `POST /{WABA_ID}/subscribed_apps`, pero el `GET` posterior continúa vacío.

## Causa raíz comprobada

- El último inbound persistido y `last_inbound_at` son del 23 de agosto de 2026.
- El callback configurado en Meta es `https://lamanitodelvegano.vercel.app/api/meta/webhooks/whatsapp` y el campo `messages` figura suscrito en el producto Webhooks.
- WABA `1129249369256097` contiene realmente el Phone Number ID `1022209807648757`.
- El token server-side está válido, fue emitido para la app principal `1691394752113175` y contiene `whatsapp_business_management` y `whatsapp_business_messaging`.
- Lectura antes: app principal no suscrita (`GET` 200).
- Mutación canónica sin parámetros: `POST` 200 y `{ success: true }`.
- Lectura obligatoria después: app principal no suscrita (`GET` 200); la lista completa de apps suscritas sigue vacía.

Por tanto, la causa operativa es que Meta no materializa la asociación app principal ↔ WABA aunque acepte la mutación. No es un fallo del callback, Phone Number ID, validez/permisos del token ni persistencia local.

## Seguridad y comportamiento

- `META_WHATSAPP_SEND_MODE=read_only` está configurado sólo en Production.
- `read_only` permite recibir y persistir, pero bloquea envíos manuales/automáticos antes de consultar credenciales o Graph.
- Remy se detiene antes de Supabase, IA y herramientas comerciales en WhatsApp mientras el modo no sea `live`.
- No se registran payloads, remitentes, cuerpos, tokens ni secretos.
- La observabilidad distingue firma inválida, JSON inválido, payload ignorado, Phone Number ID incorrecto, duplicado, asset ausente, error Supabase y persistencia correcta.
- `/api/admin/whatsapp/status` ya no inventa WABA, teléfono, calidad ni salud; usa mediciones o `unknown`.

## Verificación

- Suite: 113/113 tests pasando.
- Build de producción: compilación y TypeScript exitosos en Vercel.
- Deployment: `dpl_6rS7wiwtXynZUwRHp3tN98MWunS8`, READY y alias `https://lamanitodelvegano.cl`.
- Runtime: cero errores agrupados en la última hora; solicitudes observadas con HTTP 200.
- Supabase: cero WhatsApp inbound en las últimas 24 horas; último inbound `2026-08-23 03:39:01.748974+00`.
- No fue posible demostrar un inbound real nuevo porque Meta aún no entrega eventos sin materializar la suscripción WABA.

## Bloqueo externo preciso

Meta debe materializar la asociación de la app `1691394752113175` al WABA `1129249369256097`. El siguiente paso requiere intervención en la configuración/soporte de WhatsApp Manager o regenerar la asociación desde Meta; repetir el mismo POST no cambia el estado y no constituye confirmación.
