# Dominio y Meta en producción

Fecha de auditoría: 20 de agosto de 2026. Este documento no contiene secretos.

## DOMINIO

- Dominio oficial: `https://lamanitodelvegano.cl`
- Estado DNS: pendiente en el proveedor DNS. Vercel solicita `A lamanitodelvegano.cl 76.76.21.21` y `A www.lamanitodelvegano.cl 76.76.21.21`.
- SSL: pendiente de emisión hasta que los registros resuelvan y Vercel verifique el dominio.
- Canonical: `https://lamanitodelvegano.cl` en metadata, OpenGraph, sitemap y robots.
- www redirect: preparado como redirección permanente hacia el dominio raíz.
- Vercel project: `lamanitodelvegano`, ID `prj_tjGEPQ9gFAGOFLRAKgqkrxj1NUfU`, equipo `team_n7nS5veSRB7KWvBYFWH8VTlG`.
- Compatibilidad temporal: `https://lamanitodelvegano.vercel.app` permanece disponible y es el fallback operativo de callbacks hasta activar `NEXT_PUBLIC_SITE_URL` después de verificar DNS/HTTPS.

## META

- Business ID: `1210930218761819`.
- Dataset: `1982469039131019`.
- App principal: `synthetiq Core sirve`, App ID `1691394752113175`. Es la app usada por el secreto del servidor y aparece suscrita a la Página con `messages,messaging_postbacks`.
- App secundaria: `Synthetiq Bridge - La Manito`, App ID `1388581679803769`. No hay referencias runtime ni suscripciones comprobadas que justifiquen migrar responsabilidades hacia ella.
- App mode principal: sin publicar (Development).
- Instagram: `@lamanitodelvegano`, Business ID `17841419477422736`.
- Facebook Page: ID `1210803402107834`, con tareas `MANAGE`, `CREATE_CONTENT`, `MODERATE`, `MESSAGING`, `ADVERTISE`, `ANALYZE`.
- WhatsApp: WABA configurado en runtime `1129249369256097`; el número y Phone Number ID no se modificaron.
- Webhooks directos: `/api/instagram` y `/api/whatsapp`.
- Webhooks de compatibilidad/proxy: `/api/meta/webhooks/messaging`, `/api/meta/webhooks/whatsapp`, `/api/meta/webhooks/leads`.
- OAuth real: `/api/meta/oauth/start` y `/api/meta/oauth/callback`, delegados al backend HTTPS configurado en `META_PROXY_UPSTREAM_URL`. El proxy conserva cookies, `Authorization`, `state` y cabeceras de respuesta; los secretos no llegan al browser desde Next.js.
- URLs oficiales preparadas para Meta:
  - `https://lamanitodelvegano.cl/api/meta/oauth/callback`
  - `https://lamanitodelvegano.cl/api/meta/webhooks/messaging`
  - `https://lamanitodelvegano.cl/api/meta/webhooks/whatsapp`
  - `https://lamanitodelvegano.cl/api/meta/webhooks/leads`
  - `https://lamanitodelvegano.cl/api/instagram`
  - `https://lamanitodelvegano.cl/api/whatsapp`
- No retirar aún las URLs equivalentes bajo `lamanitodelvegano.vercel.app`.

## PERMISOS Y MENSAJERÍA

- Activos en el token auditado: `pages_show_list`, `ads_read`, `business_management`, `pages_messaging`, `instagram_basic`, `leads_retrieval`, `whatsapp_business_management`, `instagram_manage_messages`, `pages_read_engagement`, `pages_manage_metadata`, `whatsapp_business_messaging`, `public_profile`.
- Página encontrada y suscripción de app activa: sí.
- Perfil Instagram legible: sí.
- Lectura de conversaciones Instagram: bloqueada con Graph error `#3 Application does not have the capability to make this API call`.
- Infraestructura implementada: sí.
- Webhook configurado en la app/página histórica: sí, con la app principal.
- Usuarios externos y DM reales: no demostrados; bloqueados por capacidad/App Review mientras la app siga sin publicar.
- Clasificación: los permisos aparecen concedidos al usuario administrador, pero la capacidad de conversaciones requiere acceso/capacidad aprobada para producción. No se solicitarán permisos adicionales fuera de mensajería, Pages, WhatsApp y Leads ya usados.

## PIXEL

- Estado: operativo.
- Dataset: `1982469039131019`.
- Eventos browser instrumentados: `PageView`, `ViewContent`, `AddToCart`, `InitiateCheckout`, `Contact`; `Purchase` solo tras pago real.

## CAPI

- Estado: operativo y autorizado.
- Dataset: `1982469039131019`.
- Token: `META_CONVERSIONS_API_ACCESS_TOKEN`, solo servidor.
- Deduplicación: `event_name=Purchase`, `event_id=purchase_<orderId>` en browser y servidor.
- Atribución: conserva `fbp`, `fbc` y `event_source_url` cuando existen; el tráfico por el dominio oficial conservará su URL real.

## GA4

- Estado: operativo.
- Measurement ID: `G-1Q7QB5EZ33`.
- El guard de PageView inicial/SPA continúa evitando duplicados.

## APP PUBLICATION

- Listo: Business asociado, app principal identificada, Page e Instagram vinculados, webhook histórico suscrito, permisos del administrador visibles, política de privacidad, términos y eliminación de datos implementados.
- Pendiente en configuración básica de `synthetiq Core sirve`: agregar `lamanitodelvegano.cl`, URL del sitio, política, términos, eliminación de datos, categoría e ícono 1024×1024. Mantener el dominio Vercel durante la transición.
- Requiere App Review/capacidad: mensajería Instagram para conversaciones de usuarios externos y cualquier acceso avanzado que Meta marque en el caso de uso.
- Requiere acción humana: publicar DNS; aportar ícono; completar datos comerciales/contacto que no deben inventarse; adjuntar video de prueba e instrucciones con un usuario/rol permitido cuando se solicite App Review; enviar la revisión y esperar aprobación de Meta.
- No se debe activar Live hasta que DNS/HTTPS, URLs legales, pruebas del caso de uso y requisitos visibles en el panel estén completos.

## ACTIVACIÓN DESPUÉS DEL DNS

1. Crear exactamente los dos registros A indicados por Vercel y esperar resolución.
2. Verificar HTTPS en raíz y www.
3. Configurar `NEXT_PUBLIC_SITE_URL=https://lamanitodelvegano.cl` para Production y Preview en el proyecto existente y redeploy.
4. Probar pagos/callbacks, webhooks, OAuth, Pixel, GA4 y CAPI en el dominio oficial.
5. Añadir en la app principal el dominio y URLs oficiales, conservando temporalmente las antiguas.
