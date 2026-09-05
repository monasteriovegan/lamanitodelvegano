# Remy Opportunity Engine — Diseño

Fecha: 2026-09-05
Estado: aprobado conceptualmente por el usuario; pendiente revisión del documento antes de implementación

## 1. Objetivo

Convertir Remy desde un agente que responde mensajes y recupera carritos abandonados en un sistema de recuperación comercial multicanal que detecta conversaciones con probabilidad real de venta, propone la siguiente acción cuando Remy está apagado y puede ejecutar seguimientos seguros cuando Remy está encendido.

El sistema debe funcionar sobre Instagram y WhatsApp, usando la misma información comercial que ya existe: conversaciones, mensajes, carritos, pedidos, pagos, catálogo y contexto de origen cuando Meta lo provea.

No debe perseguir indiscriminadamente a todos los contactos. Debe priorizar oportunidades con señales de compra claras, respetar límites de frecuencia y detenerse cuando exista compra, rechazo, intervención humana o una condición de seguridad.

## 2. Principios de diseño

1. **Detector separado del ejecutor.** El motor que decide “esta conversación merece seguimiento” no envía mensajes por sí mismo.
2. **Mismo motor, dos modos.**
   - Remy apagado: modo copiloto, solo recomendaciones.
   - Remy encendido: modo vendedor, puede ejecutar recomendaciones permitidas.
3. **Una conversación, un estado comercial.** No crear sistemas paralelos de leads si la conversación ya existe en `conversations`.
4. **No inventar señales.** Si Meta no entrega lectura, origen de anuncio u otro dato, el sistema usa señales disponibles y lo marca como desconocido.
5. **No spam.** Máximo dos seguimientos automáticos por oportunidad y reglas de enfriamiento explícitas.
6. **Venta final manda.** Si aparece un pedido confirmado/pagado, la oportunidad se cierra inmediatamente.
7. **Human takeover gana siempre.** Si un humano toma la conversación, Remy deja de actuar automáticamente.
8. **Auditable.** Toda detección, recomendación, envío, respuesta, conversión y descarte debe quedar registrado.

## 3. Alcance

### Incluido

- Detector de oportunidades para Instagram y WhatsApp.
- Priorización por etapa comercial.
- Bandeja de “Oportunidades de venta” en CRM.
- Recomendación de canal, momento y texto de seguimiento.
- Envío manual desde CRM.
- Ejecución automática cuando Remy esté habilitado y el canal lo permita.
- Máximo de dos seguimientos automáticos.
- Cierre automático al comprar, rechazar, pedir no ser contactado o entrar human takeover.
- Medición de ventas recuperadas.
- Uso de origen de anuncio/referral cuando Meta lo entregue.
- Compatibilidad con carrito abandonado existente.

### Fuera de alcance inicial

- Campañas masivas o broadcast.
- Contactar por un canal distinto al usado por el cliente salvo consentimiento explícito.
- Lead scoring con modelos externos entrenados.
- Automatizaciones fuera de las ventanas permitidas por Meta mediante plantillas pagadas no aprobadas.
- Recontacto indefinido.
- Prospección fría a personas que nunca iniciaron conversación.

## 4. Fuentes de datos existentes

El sistema reutiliza datos actuales:

- `conversations`: canal, cliente, estado, `ai_enabled`, `human_takeover`, actividad.
- `omnichannel_messages`: dirección, contenido, `sent_at`, `delivered_at`, `read_at`, estado de proveedor.
- `carritos_abandonados`: items, subtotal, última actividad, contactado/recuperado, canal, conversación.
- `pedidos`: pedido creado, total, estado de pago y relación comercial.
- catálogo normalizado: producto, variante y opciones.
- payloads de Meta: referral/origen de anuncio cuando exista.

El sistema no debe basarse exclusivamente en `read_at`, porque hoy Instagram no entrega esa señal de forma confiable en el flujo existente y WhatsApp solo la tiene para una fracción de mensajes.

## 5. Modelo de oportunidad

Crear una entidad persistente `sales_opportunities` con, como mínimo:

- `id`
- `business_unit_id`
- `conversation_id`
- `customer_id`
- `channel`
- `status`: `open`, `snoozed`, `dismissed`, `converted`, `expired`
- `priority`: `high`, `medium`, `low`
- `stage`: `payment_pending`, `cart_abandoned`, `shipping_or_price_question`, `product_interest`, `general_interest`
- `score`
- `reason_code`
- `reason_summary`
- `source_type`: `ad`, `organic`, `unknown`
- `source_campaign` / `source_ad` cuando existan
- `product_context` JSON
- `last_customer_message_at`
- `last_business_message_at`
- `last_activity_at`
- `recommended_at`
- `recommended_channel`
- `recommended_message`
- `followup_count`
- `last_followup_at`
- `next_followup_at`
- `converted_order_id`
- `converted_revenue`
- `created_at`, `updated_at`

Debe existir como máximo una oportunidad abierta por conversación y etapa comercial equivalente. El detector actualiza la oportunidad existente en vez de crear duplicados.

## 6. Detección y scoring

El detector corre de forma periódica y también puede reevaluar una conversación al recibir nueva actividad.

### Alta prioridad

- Link de pago/pedido iniciado sin pago y luego silencio.
- Carrito abandonado con items reales y subtotal.
- Conversación con datos de compra avanzados: precio + despacho/fecha + producto concreto.

### Prioridad media

- Pregunta por precio de producto concreto y silencio posterior.
- Pregunta por despacho o disponibilidad asociada a un producto.
- Conversación proveniente de anuncio con intención explícita de compra.

### Prioridad baja

- Consulta comercial general sin carrito ni producto concreto.

### Señales positivas

- producto concreto mencionado
- precio solicitado
- comuna/despacho consultado
- fecha de entrega consultada
- variante/sabor seleccionado
- carrito con items
- pedido creado pero no pagado
- mensaje nuestro enviado sin respuesta posterior
- origen de anuncio conocido

### Señales de exclusión

No crear o cerrar oportunidad si:

- existe pedido pagado/completado asociado
- cliente dijo explícitamente que no quiere comprar o no quiere mensajes
- conversación marcada personal
- `human_takeover = true`
- conversación bloqueada/cerrada por política
- ya se hicieron dos seguimientos automáticos sin respuesta
- oportunidad fue descartada manualmente y sigue dentro de su ventana de descarte

## 7. Timing

Regla inicial:

- Primer seguimiento recomendado: entre 2 y 4 horas después del último mensaje comercial nuestro sin respuesta, o después de 2 horas de inactividad de un carrito.
- Segundo seguimiento: al día siguiente, solo si no hubo respuesta y sigue existiendo intención comercial.
- Después del segundo intento: expirar oportunidad automática.

El sistema guarda `next_followup_at`; no depende de que un cron corra exactamente en el minuto objetivo.

Para WhatsApp se debe respetar la ventana de servicio vigente. Si la ventana está cerrada y no existe una plantilla aprobada para ese uso, la oportunidad permanece recomendada para acción humana/otro canal permitido, pero Remy no fuerza un envío.

## 8. Modo copiloto — Remy apagado

Cuando `ai_enabled = false`, el motor sigue detectando y clasificando oportunidades, pero no envía mensajes.

En CRM aparece una bandeja “Oportunidades de venta” con:

- cliente/conversación
- canal
- prioridad
- producto/interés
- motivo
- tiempo sin respuesta
- origen de anuncio si se conoce
- recomendación de cuándo contactar
- mensaje sugerido

Acciones:

- **Enviar ahora**
- **Editar mensaje**
- **Recordarme después**
- **Descartar**
- **Abrir conversación**

Enviar manualmente usa la ruta de envío canónica y persiste el outbound en `omnichannel_messages`.

## 9. Modo vendedor — Remy encendido

Cuando `ai_enabled = true`, el motor puede ejecutar una oportunidad solo si todos los gates de seguridad pasan:

- canal habilitado
- conversación habilitada para IA
- no `human_takeover`
- no contacto personal
- modo de envío del canal permite automatización
- oportunidad no descartada
- no compra ya convertida
- `followup_count < 2`
- dentro de ventana permitida del proveedor o política explícitamente permitida

El texto de seguimiento no debe ser generado libremente sin contexto. Se construye a partir de una plantilla comercial segura y, opcionalmente, una redacción de Remy limitada por los hechos conocidos de la conversación y catálogo.

Ejemplo de intención:

> “Hola, te escribo por el Pack Parrillero que estabas viendo. Si quieres, te ayudo a dejarlo listo para entrega.”

No debe inventar descuento, stock, plazo ni precio.

## 10. Origen de anuncios

Cuando Meta entregue referral/ad context, persistirlo de forma normalizada asociado a conversación/mensaje y copiar el resumen relevante a la oportunidad:

- tipo de origen
- campaña/anuncio si está disponible
- producto o creativo referido cuando pueda resolverse

Si no está disponible, `source_type = unknown`.

El motor no depende de esta señal para funcionar.

## 11. Integración con carrito abandonado existente

El cron actual de `carritos-abandonados` deja de ser un ejecutor paralelo de recuperación y pasa a alimentar o disparar el mismo motor de oportunidades.

Objetivo: una sola lógica decide seguimiento, frecuencia, exclusiones y medición.

Durante migración:

1. mantener el flujo actual operativo
2. activar detector nuevo en modo observación/copiloto
3. comparar decisiones
4. mover ejecución de carrito al motor nuevo
5. retirar duplicación

Nunca deben existir dos seguimientos por el mismo carrito/conversación.

## 12. Conversión y atribución

Una oportunidad se marca `converted` cuando aparece un pedido real relacionado con la conversación/cliente después de la detección y antes de expirar la ventana comercial.

Guardar:

- `converted_order_id`
- `converted_revenue`
- tiempo desde seguimiento hasta conversión
- si la conversión ocurrió después de seguimiento manual, automático o sin envío

Para “venta recuperada” en métricas, contar solo si hubo al menos un seguimiento enviado desde esa oportunidad antes de la creación/confirmación del pedido.

## 13. Métricas

Panel mínimo:

- oportunidades detectadas
- oportunidades contactadas
- tasa de respuesta
- pedidos creados después de seguimiento
- ventas recuperadas
- monto recuperado
- conversión por canal
- conversión por prioridad
- conversión por origen/anuncio cuando exista

No mezclar estas métricas con ingresos generales del dashboard; deben mostrarse como atribución comercial de recuperación.

## 14. Seguridad y anti-spam

- Máximo 2 seguimientos automáticos por oportunidad.
- No contacto cruzado entre canales sin consentimiento.
- `human_takeover` detiene automatización.
- Detección explícita de frases de rechazo/opt-out cierra oportunidad.
- No seguimiento si ya existe pedido pagado/completado.
- No usar contactos personales.
- Respetar capacidad/mode del proveedor.
- Toda salida automática debe registrar agente `remy`, oportunidad y reason code.
- Botón/flag de emergencia global debe seguir pudiendo detener todas las salidas automáticas.

## 15. Cambios de aplicación esperados

### Base de datos

- Nueva tabla `sales_opportunities`.
- Índices por `business_unit_id`, `status`, `next_followup_at`, `conversation_id`.
- Restricción/índice para evitar oportunidades abiertas duplicadas por conversación/etapa.
- Campos o tabla auxiliar para referral/ad context si el payload actual no tiene una ubicación normalizada suficiente.

### Backend

Crear unidades pequeñas:

- `opportunity-detector`: lee conversación y contexto, produce etapa/score/razón.
- `opportunity-policy`: decide si puede recomendar/enviar y cuándo.
- `opportunity-message`: genera borrador seguro desde hechos conocidos.
- `opportunity-service`: crea/actualiza/cierra oportunidades.
- `opportunity-runner`: procesa las oportunidades vencidas (`next_followup_at`).
- `opportunity-attribution`: marca conversión y revenue.

### Admin/CRM

- Nueva vista o pestaña “Oportunidades de venta”.
- Filtros por prioridad/canal/estado.
- Acciones manuales de enviar, editar, posponer, descartar.
- Acceso directo a conversación y pedido relacionado.

### Cron

Aumentar frecuencia del runner a un intervalo útil, sin prometer precisión al minuto. El runner procesa por `next_followup_at` y es idempotente.

## 16. Flujo de datos

1. Entra mensaje -> se persiste en `omnichannel_messages`.
2. Conversación se actualiza.
3. Detector evalúa intención/etapa y contexto de carrito/pedido.
4. `opportunity-service` crea/actualiza/cierra oportunidad.
5. Si Remy apagado -> CRM muestra recomendación.
6. Si Remy encendido -> runner consulta oportunidades listas.
7. `opportunity-policy` aplica gates.
8. Se envía mediante `sendMessage` canónico.
9. Se persiste mensaje outbound y se incrementa seguimiento.
10. Nueva respuesta/pedido reevalúa oportunidad.
11. Si compra -> `converted`, guardar revenue.

## 17. Manejo de errores e idempotencia

- El runner debe tomar oportunidades de forma idempotente para evitar dos envíos si dos ejecuciones coinciden.
- Un fallo de proveedor no incrementa `followup_count` como enviado exitoso; se registra error y se reprograma de forma limitada.
- Un mensaje enviado pero con respuesta de persistencia fallida debe reconciliarse por `provider_message_id` antes de reintentar.
- Si falla scoring/detector, no se bloquea recepción de mensajes.
- Ningún error del motor de oportunidades debe impedir que el webhook devuelva 200 cuando el mensaje principal ya fue persistido.

## 18. Pruebas requeridas

### Unitarias

- scoring por etapa
- exclusiones
- máximo de seguimientos
- cálculo de `next_followup_at`
- política por canal
- generación de borrador sin inventar datos
- cierre por opt-out/human takeover/compra

### Integración

- Instagram inbound -> oportunidad
- WhatsApp inbound -> oportunidad
- carrito abandonado -> oportunidad sin duplicado
- pedido pagado -> cierre
- Remy apagado -> no envío
- Remy encendido pero WhatsApp read_only -> no envío
- Remy encendido/live -> un único envío y persistencia
- retry idempotente

### End-to-end/admin

- bandeja visible
- enviar/edit/posponer/descartar
- contador de oportunidades
- métricas de conversión

## 19. Despliegue gradual

Fase 1 — **Observación**
- migración y detector activo
- Remy sigue apagado
- CRM muestra oportunidades
- no hay envío automático

Fase 2 — **Copiloto real**
- acciones manuales desde bandeja
- validar calidad de ranking y mensajes sugeridos

Fase 3 — **Automatización controlada**
- habilitar Remy para un subconjunto seguro
- un solo seguimiento automático inicialmente
- revisar conversiones/errores

Fase 4 — **Dos seguimientos**
- habilitar segundo intento solo tras evidencia positiva de la fase anterior

El despliegue a producción no implica activar automáticamente a Remy. Código y motor pueden estar desplegados con `ai_enabled = false`; la activación sigue siendo una decisión operativa separada.

## 20. Criterios de aceptación

1. Con Remy apagado, el CRM puede sugerir oportunidades sin enviar mensajes.
2. Una conversación comercial sin respuesta puede aparecer con prioridad y razón explicable.
3. Un carrito abandonado no genera seguimientos duplicados.
4. Una venta completada cierra la oportunidad automáticamente.
5. Human takeover y opt-out bloquean automatización.
6. WhatsApp read_only nunca envía automáticamente.
7. Máximo dos seguimientos automáticos.
8. Instagram y WhatsApp usan el mismo modelo de oportunidad.
9. Las recomendaciones indican canal y momento.
10. El sistema mide ventas y monto recuperado.
11. Ningún fallo de oportunidad rompe recepción de mensajes o checkout.
12. El sistema queda desplegable con Remy apagado por defecto.

## 21. Decisiones explícitas

- Se elige **detector universal + dos modos** sobre un recuperador exclusivo de carritos.
- No se depende de `read_at` como señal primaria.
- No se contacta automáticamente por un canal distinto al de origen.
- No se implementa broadcast ni prospección fría.
- No se elimina el recuperador actual hasta validar el nuevo motor en observación.
- La activación automática de Remy se mantiene separada del despliegue de código.

## 22. Revisión de consistencia

- No quedan decisiones técnicas marcadas como TBD/TODO.
- El detector y el ejecutor están separados en todo el diseño.
- El modo copiloto funciona aunque Remy esté apagado.
- El envío automático sigue subordinado a las capacidades del canal y a `human_takeover`.
- La fase inicial de producción es de observación, por lo que desplegar el sistema no implica enviar mensajes automáticamente.
- El cron de carrito actual no se retira hasta comprobar que el nuevo motor evita duplicados y produce decisiones equivalentes o mejores.
