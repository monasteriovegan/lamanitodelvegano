# Diseño de cierre de producción para Meta, Instagram y Remy

## Objetivo

Dejar La Manito del Vegano tan cerca de producción total como permitan las credenciales, los pagos y las aprobaciones externas disponibles, sin reconstruir integraciones ya operativas ni duplicar la arquitectura comercial de WhatsApp.

El trabajo cubre la identidad básica de la app Meta principal, el correo corporativo, la recepción y respuesta de mensajes de Instagram, la persistencia omnicanal, CRM, Remy, carrito, pedidos, pruebas y preparación legítima para App Review.

## Límites y activos protegidos

- App Meta principal: `synthetiq Core sirve`, ID `1691394752113175`.
- App secundaria `Synthetiq Bridge - La Manito`, ID `1388581679803769`: no se modifica.
- Dataset/Pixel `1982469039131019`: se conserva.
- Cuenta publicitaria `2925426834477416`, campañas, presupuestos, anuncios y creativos: no se modifican.
- No se acepta Tech Provider sin una autorización posterior y explícita.
- No se efectúan cobros de Google Workspace sin aprobación del usuario después de mostrar plan, precio, periodicidad e impuestos visibles.
- No se generan compras, pagos ni eventos `Purchase` falsos.
- No se muestran ni registran secretos, tokens, contraseñas o claves privadas.

## Arquitectura constatada

El repositorio ya contiene un núcleo omnicanal que debe conservarse:

```text
Meta webhook Instagram ─┐
                       ├─> normalizador compartido ─> mensaje normalizado
Meta webhook WhatsApp ─┘                              │
                                                      ├─> identidad/CRM
                                                      ├─> conversación
                                                      ├─> persistencia/idempotencia
                                                      └─> Remy compartido
                                                               │
                                           catálogo <─ comercio ─> carrito
                                                               │
                                                             pedido
                                                               │
                                             transporte de respuesta por canal
```

Piezas principales existentes:

- `src/lib/messaging/types.ts`: contrato `NormalizedMessage`.
- `src/lib/messaging/normalize.ts`: normalización Meta WhatsApp, Instagram y Baileys.
- `src/lib/messaging/messages.ts`: persistencia, deduplicación y estado del transporte.
- `src/lib/messaging/identity.ts`: resolución central de identidad CRM.
- `src/lib/messaging/send.ts`: despacho común por canal.
- `src/lib/messaging/transports/instagram-meta.ts`: envío mediante Graph API.
- `src/app/api/instagram/route.ts` y `src/app/api/whatsapp/route.ts`: entradas webhook.
- `src/lib/ai/remy*.ts`: cerebro y capacidades comerciales compartidas.
- Repositorios de conversaciones, mensajes, clientes y pedidos.
- Migraciones aditivas para identidad, conversaciones, mensajes, carrito, pedidos y asociación comercial.
- Panel con conversaciones, CRM y control de automatización de Instagram.

## Decisión arquitectónica

Instagram será exclusivamente un adaptador de canal que produzca el contrato interno ya existente. No se crean un bot, CRM, catálogo, carrito o sistema de pedidos específicos para Instagram.

Solo se extraerá funcionalidad común cuando una comparación directa demuestre duplicación entre canales. Las correcciones se harán en el punto de origen compartido cuando el contrato sea común, o en el adaptador cuando el comportamiento sea exclusivo de Meta Instagram.

## Flujo entrante

1. El endpoint valida la verificación GET y la firma del POST según el contrato vigente de Meta.
2. El adaptador descarta cargas ajenas a Instagram y normaliza cada evento soportado.
3. El mensaje conserva ID externo, cuenta profesional, usuario externo, hilo, tiempo, dirección, tipo, texto y metadatos de adjuntos permitidos.
4. Los ecos y mensajes originados por la cuenta profesional se persisten como salida humana cuando corresponda, pero nunca invocan Remy.
5. El ID del proveedor es la clave primaria de idempotencia lógica. Una retransmisión no crea un segundo mensaje ni una segunda respuesta.
6. La persistencia resuelve identidad, actualiza o crea el contacto, crea o actualiza la conversación y registra el mensaje.
7. Remy solo se invoca para entradas nuevas elegibles y cuando la automatización esté habilitada y no exista takeover humano.

## Medios y tipos no soportados

El normalizador cubrirá texto, imagen, video, audio y adjuntos que Meta entregue. Los metadatos necesarios se conservarán sin almacenar tokens ni URLs sensibles de larga duración. Un tipo no soportado se persiste con una clasificación estable y una representación segura; no debe romper el webhook ni provocar reintentos infinitos.

## CRM e identidad

- La identidad primaria de Instagram será el ID scoped entregado por Meta y la unidad de negocio.
- El canal/origen queda registrado como Instagram y se actualiza la última interacción.
- El nombre de usuario solo se guarda cuando la API lo entregue legítimamente.
- No se unen contactos por nombre.
- Una vinculación posterior por teléfono o correo requiere una señal explícita y segura compatible con el modelo existente.
- Conversaciones, mensajes, carrito y pedidos permanecen relacionados con el contacto común.

## Remy, carrito y pedidos

Remy recibe el mismo contexto comercial usado por WhatsApp: historial, cliente, catálogo, carrito, pedido y canal. La memoria durable procede de Supabase, no de memoria de proceso, React o `localStorage`.

El carrito conserva productos y cantidades entre mensajes, refresh, redeploy y nuevas instancias serverless. Al confirmar, se reutiliza el mecanismo existente de creación idempotente de pedidos y sus estados actuales. La conversación y el contacto se asocian al pedido mediante las estructuras existentes.

Crear un pedido no equivale a pagarlo. `Purchase` se mantiene protegido por la transición real a pago y conserva:

- `event_name = Purchase`
- `event_id = purchase_<orderId>`
- el mismo `event_id` en Pixel y CAPI para deduplicación
- `_fbp`, `_fbc`, `event_source_url` y atribución cuando existan

## Respuesta saliente y control humano

El transporte de Instagram reutiliza `sendMessage` y el cliente Graph existente. Antes de responder se exige autorización automática explícita o una acción manual. Los mensajes se limitan a las ventanas y políticas actuales de Meta.

Se distinguen errores permanentes de permisos o token, límites de tasa y fallos reintentables. Los logs registran códigos y contexto no sensible, nunca tokens o cuerpos que contengan credenciales.

Cuando Remy esté pausado o exista takeover humano, los mensajes entrantes se guardan y actualizan CRM, pero no generan respuesta automática.

## Identidad de la app Meta

El logo adjunto por el usuario es la única fuente autorizada. Se producirá mecánicamente un PNG RGB/RGBA de 1024 × 1024, centrado, sin deformación ni recorte del círculo exterior. El origen quedará documentado y el resultado se verificará visualmente antes de subirlo a la app principal.

En Settings → Basic se seleccionará `Negocios y páginas` si Meta continúa mostrando ese nombre. El correo corporativo solo se guardará después de demostrar recepción real en `contacto@lamanitodelvegano.cl`.

## Google Workspace y DNS

Se audita primero el DNS vigente. La contratación se prepara mediante el flujo oficial de Google y se detiene exactamente antes de aceptar cualquier cargo no aprobado.

Cuando exista el tenant y buzón, se publican los valores exactos entregados por Google Admin para MX, SPF y DKIM. DMARC comienza en observación (`p=none`) salvo que Google recomiende otro valor específico. No se declara operativo hasta verificar una recepción desde una cuenta externa y una respuesta saliente desde el buzón corporativo.

## Meta, permisos y App Review

La auditoría verificará asociación Page–Instagram, ID profesional, validez y scopes del token, suscripciones de Página y app, campos webhook, Advanced Access, App Mode, Access Verification y entregas observables.

Los estados se reportan por separado:

- endpoint verificable;
- webhook suscrito;
- evento de prueba Meta recibido;
- DM de tester real recibido;
- persistencia;
- CRM;
- Remy;
- respuesta saliente;
- carrito;
- pedido;
- usuario externo en producción.

Un evento del panel no se presenta como un DM real. Si Meta obliga a aceptar Tech Provider para solicitar un permiso, se captura el mensaje exacto y se detiene esa acción. App Review solo se envía con evidencia verdadera y un flujo realmente reproducible.

## Estrategia de diagnóstico y pruebas

El fallo previo de WhatsApp se investigará antes de editar: reproducción, traza del flujo, comparación con ejemplos funcionales y una hipótesis única. No se cambia el test para ocultar un defecto.

Cada corrección o comportamiento nuevo sigue rojo–verde–refactor:

1. prueba mínima que falle por la carencia correcta;
2. cambio mínimo de producción;
3. prueba específica en verde;
4. suite relacionada en verde;
5. refactor únicamente con todas las pruebas verdes.

Cobertura mínima:

- verificación GET válida e inválida;
- firma POST cuando aplique;
- parsing de texto y adjuntos;
- evento duplicado;
- protección de eco/self-message;
- persistencia de conversación;
- creación y actualización CRM;
- invocación y pausa de Remy;
- conservación del carrito;
- creación y asociación del pedido;
- construcción de respuesta saliente;
- errores Meta y límites de tasa;
- takeover humano;
- regresión WhatsApp;
- protección de `Purchase`.

La verificación final ejecuta typecheck, lint, pruebas relevantes, suite completa y build de producción. Las comprobaciones con servicios externos se documentan separando evidencia directa, inferencias y bloqueos.

## Secuencia de entrega y checkpoints

1. Especificación y plan versionados.
2. Icono oficial y documentación de origen.
3. Categoría e icono en Meta Basic Settings.
4. Auditoría de Meta, Instagram, Vercel, DNS y logs.
5. Reproducción del fallo WhatsApp.
6. Correcciones y ampliaciones Instagram por TDD.
7. Pruebas locales completas.
8. Deploy autorizado y verificaciones de producción.
9. Tester legítimo o herramientas de prueba Meta, claramente etiquetados.
10. Preparación de Workspace hasta pago, o configuración completa si se autoriza.
11. Documentación de App Review y reporte final.

Cada bloque sensible recibe un commit pequeño y descriptivo. No se reescribe el historial.

## Criterio de terminación

El resultado se clasifica como `READY` únicamente si el flujo externo está aprobado y demostrado. Si el código, persistencia y transporte están validados pero Meta aún no autoriza usuarios externos, se clasifica `READY FOR META APPROVAL` o `PARTIAL`, indicando exactamente el bloqueo externo. Ninguna respuesta HTTP aislada basta para declarar Instagram operativo.
