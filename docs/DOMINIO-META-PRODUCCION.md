# Dominio y Meta en producción

Fecha de auditoría: 20 de agosto de 2026. Este documento no contiene secretos.

## DOMINIO

- Dominio oficial: `https://lamanitodelvegano.cl`.
- DNS, HTTPS y SSL: verificados externamente; el dominio raíz responde HTTP 200.
- `www`: resuelve y Vercel aplica redirección permanente al dominio raíz.
- Canonical: `https://lamanitodelvegano.cl` en metadata, OpenGraph, sitemap y robots.
- Proyecto Vercel existente: `lamanitodelvegano`, ID `prj_tjGEPQ9gFAGOFLRAKgqkrxj1NUfU`.
- `NEXT_PUBLIC_SITE_URL=https://lamanitodelvegano.cl` está configurada para Production y para el preview de la rama activa.
- `https://lamanitodelvegano.vercel.app` permanece como fallback temporal, pero no es canonical.

## META

- Business ID: `1210930218761819`.
- Dataset: `1982469039131019`.
- App principal: `synthetiq Core sirve`, App ID `1691394752113175`.
- App secundaria: `Synthetiq Bridge - La Manito`, App ID `1388581679803769`; clasificada como `BRIDGE/LEGACY`, sin responsabilidad runtime comprobada.
- App principal: sin publicar.
- Configuración básica actualizada y persistida: dominio `lamanitodelvegano.cl`, sitio oficial, privacidad, términos y eliminación de datos. El dominio Vercel se conserva temporalmente.
- Pendientes básicos: correo de contacto operativo, elección de categoría e ícono oficial 1024×1024. No existe un logo oficial utilizable dentro del repositorio.
- Verificación del negocio: `Verificado` desde la comprobación del 20 de agosto de 2026.
- Instagram: `@lamanitodelvegano`, Business ID `17841419477422736`.
- Facebook Page: `1210803402107834`.
- WhatsApp WABA: `1129249369256097`; número y Phone Number ID sin cambios.

## OAUTH Y WEBHOOKS

- OAuth público: `/api/meta/oauth/start` y `/api/meta/oauth/callback`.
- Callback oficial: `https://lamanitodelvegano.cl/api/meta/oauth/callback`.
- El entrypoint temporal `https://lamanitodelvegano.vercel.app/api/meta/oauth/start` permanece accesible, pero también dirige el callback al dominio oficial.
- El intercambio de token se delega al backend Vercel existente `synthetiq-meta-dev-proxy`; se retiró del camino crítico el túnel temporal `trycloudflare.com`. Next.js conserva cookies, `Authorization`, `state` y cabeceras de respuesta. App Secret y tokens no se exponen al navegador.
- El inicio OAuth fue verificado: devuelve HTTP 302 a Meta con `redirect_uri=https://lamanitodelvegano.cl/api/meta/oauth/callback`.
- Webhooks directos: `/api/instagram` y `/api/whatsapp`.
- Webhooks proxy: `/api/meta/webhooks/messaging`, `/api/meta/webhooks/whatsapp` y `/api/meta/webhooks/leads`.
- Todos los endpoints oficiales son públicos por HTTPS y rechazan una verificación sin token correcto con HTTP 403.
- La suscripción de app Instagram fue migrada y verificada por Graph API con HTTP 200 a `https://lamanitodelvegano.cl/api/instagram`; la Página y el WABA también devolvieron HTTP 200.
- El panel de Meta confirma que una app sin publicar solo recibe webhooks de prueba desde el panel; no entrega datos de producción, ni siquiera de administradores/evaluadores, hasta publicar la app.

## PERMISOS Y MENSAJERÍA

- Concedidos al token auditado: `pages_show_list`, `pages_messaging`, `instagram_basic`, `instagram_manage_messages`, `pages_read_engagement`, `pages_manage_metadata`, `whatsapp_business_management`, `whatsapp_business_messaging`, además de permisos ya usados por Ads/Leads.
- Meta muestra `instagram_basic`, `instagram_manage_messages`, `pages_manage_metadata`, `pages_messaging`, `pages_read_engagement` y `pages_show_list` como `Listo para la prueba`.
- Los permisos modernos de Instagram Login (`instagram_business_basic`, `instagram_business_manage_comments`, `instagram_business_manage_messages`) aparecen disponibles para agregar, pero no son el flujo activo actual basado en Facebook Login/Page; no se agregaron para evitar duplicar arquitectura.
- Lectura de conversaciones reales: Graph error `#3 Application does not have the capability to make this API call`.
- Al intentar preparar `instagram_manage_messages` para App Review, Meta exige convertirse primero en Tech Provider, completar Business Verification y Access Verification. La conversión es irreversible y requiere decisión humana.
- Estado del flujo: código, persistencia, Remy y respuesta están implementados; token y suscripción de Página son válidos. Usuarios externos, entrega de DM de producción y respuesta real siguen bloqueados por publicación/capacidad.

## TRACKING

- Pixel/Dataset `1982469039131019`: operativo. Eventos browser: `PageView`, `ViewContent`, `AddToCart`, `InitiateCheckout`, `Contact`.
- CAPI: operativo y autorizado; `META_CONVERSIONS_API_ACCESS_TOKEN` es server-side. `Purchase` solo después de pago real, con `event_name=Purchase` y `event_id=purchase_<orderId>` compartido con browser.
- Atribución: conserva `_fbp`, `_fbc`, `fbclid`, UTMs y `event_source_url`; en el dominio oficial la URL de origen usa `.cl`.
- GA4: operativo con `G-1Q7QB5EZ33`; el guard SPA evita duplicar `page_view`.

## PUBLICACIÓN

- Meta habilita el botón `Publicar`, pero no se publicó la app. La identidad básica aún debe completarse correctamente antes de usarlo.
- Bloqueos operativos: correo corporativo no creado, categoría sin decisión, ícono oficial 1024×1024 y conversión irreversible a Tech Provider/Access Verification para solicitar acceso avanzado.
- No se inventó correo, categoría ni icono de marca.
- La evidencia e instrucciones para el revisor están en `docs/META-APP-REVIEW.md`.
