# Tracking Meta + GA4 — La Manito del Vegano

Fecha de validación: 2026-08-19. Producción: `https://lamanitodelvegano.vercel.app`.

## Estado inicial

- Next.js 16.2.9, React 19 y App Router.
- La inicialización de GA4/Meta ya existía en `AnalyticsScripts.tsx` y obtenía los IDs desde `integraciones_secretas`.
- Ambos IDs estaban vacíos en producción; por ello no salía tráfico GA4 ni Meta.
- Había llamadas `fbq`/`gtag` dispersas, sin PageView SPA, sin Contact y con eventos que podían perderse antes de cargar los scripts.
- `Purchase` aceptaba `?status=success` sin exigir pago verificado.
- No hay CMP/banner de cookies. No se añadió uno improvisado; queda como decisión legal/producto pendiente.

## Google Analytics

- Measurement ID histórico recuperado desde la versión Firebase anterior: `G-1Q7…EZ33`.
- El ID se restauró en `integraciones_secretas` mediante el panel admin, sin reemplazarlo.
- Carga única mediante `next/script` en el layout raíz.
- `gtag('config')` conserva el PageView inicial. El observador App Router emite un solo `page_view` por URL nueva.
- Los eventos tempranos se encolan hasta que `gtag` queda configurado.
- Red validada: solicitudes reales a `https://analytics.google.com/g/collect` para `/`, `/nosotros`, producto atribuido, contacto y checkout.

## Meta Pixel

- No existía Pixel/Dataset web en ninguna de las tres cuentas publicitarias accesibles ni entre los `owned_pixels` del Business Manager.
- El token Meta existente es válido y permite auditoría (`ads_read`, `business_management`), pero Meta rechazó la creación con HTTP 400 por permisos insuficientes sobre el Business `1210930218761819`.
- No se inventó ni se guardó un Pixel ID. La inicialización y todos los eventos quedan listos para activarse automáticamente al guardar el ID real.
- `PageView` inicial se emite desde una única inicialización. Las navegaciones App Router usan un guard por URL para no duplicar.
- Los eventos Meta tempranos se encolan y se drenan tras `fbq('init')`.

## Eventos

| Evento | Trigger real | Ubicación | Parámetros principales | Browser/Server | Estado |
|---|---|---|---|---|---|
| PageView | Carga inicial y URL SPA nueva | `AnalyticsScripts.tsx` | URL | Browser | GA4 activo; Meta listo, sin Pixel ID |
| ViewContent / view_item | Página o modal de producto | `VistaProducto.tsx`, `ProductDetailModal.tsx` | content_ids UUID, name, value, CLP, UTMs | Browser | GA4 validado; Meta listo |
| AddToCart / add_to_cart | Producto agregado realmente | `ProductCard.tsx`, `ProductPurchasePanel.tsx` | IDs, contenido, cantidad, value, CLP, UTMs | Browser | GA4 validado; Meta listo |
| InitiateCheckout / begin_checkout | Carrito hidratado con productos al abrir checkout | `checkout/page.tsx` | items, num_items, value, CLP | Browser | GA4 validado; Meta listo; guard de una vez |
| Contact / contact | Clic WhatsApp/Instagram o checkout WhatsApp | `contacto/page.tsx`, `checkout/page.tsx` | contact_method, producto cuando existe, value, CLP, UTMs | Browser | GA4 Instagram validado; Meta listo |
| Purchase / purchase | Pedido con `status=Pagado` **y** `payment_status=paid` | `pedido/[id]` | transaction/order ID, items, value, CLP | Browser | Implementado; no se ejecutó compra de prueba |

La capa central está en `src/lib/analytics/client.ts`. No quedan llamadas de negocio directas a `window.fbq`/`window.gtag` fuera de la inicialización central.

## CAPI

Estado: **bloqueada**.

No hay Pixel/Dataset ID y el token vigente no puede crear/administrar el dataset. No se reutilizó el token de mensajería como supuesto token CAPI ni se expuso al browser. Para habilitarla se necesita un Dataset real y un token server-side con acceso a Conversions API.

La aplicación ya conserva atribución (`fbclid`, `fbc`, `fbp`, `gclid`, UTMs) en checkout. No se fabrican `_fbc`/`_fbp`.

## Deduplicación

- `Purchase` usa `event_id = purchase_<orderId>`, estable por pedido.
- Hoy no se envía el mismo evento por browser+server porque CAPI está bloqueada.
- Al habilitar CAPI, el backend debe reutilizar exactamente ese `event_name` + `event_id`.

## Variables/configuración

Sin valores secretos:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `META_APP_SECRET`
- `META_GRAPH_VERSION`
- Tabla `integraciones_secretas`: `meta_pixel_id`, `ga4_measurement_id`, `wa_access_token`

## 🍫 Barra Dubái — Meta Ads

La auditoría Graph API encontró cuatro promociones del mismo post/producto en `act_2603401496786510` (Manito Vegano). Aunque ad sets/anuncios tienen estado configurado `ACTIVE`, las cuatro campañas están `PAUSED` y el `effective_status` de anuncios es `CAMPAIGN_PAUSED`; por tanto no hay campaña con delivery activo al 2026-08-19.

- Objective: `OUTCOME_ENGAGEMENT`
- Buying type: `AUCTION`
- Optimization: `CONVERSATIONS`
- Billing: `IMPRESSIONS`
- Bid strategy: `LOWEST_COST_WITHOUT_CAP`
- Destination/placements: Instagram; feed, stories, explore, reels y profile feed.
- Facebook Page: `1210803402107834` — La manito del vegano.
- Instagram Business: `17841419477422736`.
- Dataset/Pixel web: ninguno.
- Atribución web: no hay URL web en los creatives auditados; son publicaciones compartidas de Instagram con CTA `VIEW_PRODUCT` y optimización de conversaciones. No se añadieron UTMs porque no existe destino web que modificar.

### Campañas y creativos

Valores monetarios en CLP; métricas acumuladas 2026-07-03 a 2026-08-18.

| Campaign ID | Daily budget | Ad set ID | Ad ID | Creative ID | Estado final | Spend | Impressions | CTR | CPC | Conversaciones iniciadas | Costo/conversación |
|---|---:|---|---|---|---|---:|---:|---:|---:|---:|---:|
| 120248560911700419 | 6.521 | 120248560911880419 | 120248560912800419 | 1354716613270353 | CAMPAIGN_PAUSED | 7.727 | 4.958 | 1,6337% | 95,40 | 7 | 1.103,86 |
| 120248591212930419 | 3.244 | 120248591213130419 | 120248591213540419 | 1563560408818563 | CAMPAIGN_PAUSED | 3.383 | 1.891 | 3,1729% | 56,38 | 1 | 3.383,00 |
| 120248645149940419 | 2.780 | 120248645150230419 | 120248645151300419 | 1799475054175612 | CAMPAIGN_PAUSED | 8.223 | 3.859 | 3,0060% | 70,89 | 13 | 632,54 |
| 120248774950170419 | 7.912 | 120248774950370419 | 120248774950700419 | 1345752520371348 | CAMPAIGN_PAUSED | 18.640 | 10.291 | 1,9240% | 94,14 | 10 | 1.864,00 |

No se declara “ganador” sin contexto temporal adicional. El creative `1799475054175612` muestra el menor costo por conversación iniciada entre estos datos acumulados.

### Cambios realizados

- Auditoría de cuentas, campañas, ad sets, anuncios, creatives, métricas y datasets mediante ruta admin de solo lectura.
- Tracking web centralizado y UTMs conservadas en eventos de negocio.
- GA4 restaurado y validado con tráfico real.

### Cambios no realizados

- No se creó ni duplicó campaña/ad set/anuncio.
- No se pausó/reactivó nada.
- No se aumentó presupuesto ni se cambió puja/objetivo/creative.
- No se forzó Pixel ni Purchase sobre una campaña de conversaciones.

### Problemas encontrados

- Las cuatro campañas Barra Dubái están pausadas, pese a que se describieron como campaña activa.
- La cuenta `act_2603401496786510` reporta `account_status=3` y no pertenece al Business retornado; requiere revisión administrativa en Meta antes de reactivar delivery.
- No existe producto “Barra Dubái” en el catálogo web actual. No se inventó content_id/precio/URL.
- No existe Dataset web y el token no tiene permiso suficiente para crearlo.

Estado final Barra Dubái: **PARCIAL**. La campaña real, creatives y rendimiento están identificados sin alterar gasto; la medición web funciona para productos existentes, pero Barra Dubái no tiene ficha web y Meta no autoriza crear el Pixel con la credencial actual.

## Validaciones

- Lint de archivos modificados (salvo dos reglas preexistentes del checkout): correcto.
- TypeScript `tsc --noEmit`: correcto.
- Tests nuevos tracking: 5/5.
- Suite completa: 31/32; falla preexistente `webhook inbound no importa ni invoca proveedores LLM`, incompatible con la implementación actual de Remy y no causado por tracking.
- Lint completo: falla preexistente con 270 errores/23 warnings fuera del alcance del tracking.
- Build Vercel: correcto, 54 páginas, deployment READY.
- Smoke producción: home/producto/contacto/checkout sin errores de consola introducidos.
- Network GA4: `page_view` inicial/SPA, `view_item`, `add_to_cart`, `begin_checkout`, `contact` verificados.
- Meta Test Events/network Pixel: bloqueado porque no existe Pixel ID autorizado.

## Producción

- Deployment final: `dpl_DqYMF4EwrE27FR7kSm4dpYyQztfp` (seguido de despliegues correctivos READY).
- URL: `https://lamanitodelvegano.vercel.app`.
- Rama: `codex/tracking-meta-ga4-barra-dubai`.
- Commits principales: `1605bfa`, `267e1b2`, `fc85470`, `f8f64b5`, `c71c068`, `ca9db3e`.

## Pendientes genuinos

1. Otorgar a una credencial Meta server-side permiso de administración del Business/Dataset o crear manualmente el Pixel en Events Manager; luego guardar su ID público en `/admin/integraciones`.
2. Crear/publicar la ficha real de Barra Dubái en el catálogo con UUID, precio y stock reales antes de apuntar anuncios web o emitir ViewContent específico.
3. Decidir si se reactivará alguna campaña pausada y resolver `account_status=3`; no se hizo automáticamente para no afectar gasto/delivery.
4. Definir política de consentimiento/CMP con asesoría aplicable.
5. Resolver la deuda preexistente de lint y el test de mensajería ajeno a este cambio.
