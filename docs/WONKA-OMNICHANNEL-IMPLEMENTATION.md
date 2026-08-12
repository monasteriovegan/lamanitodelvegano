# Implementación Wonka / Remy omnicanal

Estado de diseño aprobado:

- Mensajería y CRM permanecen activos siempre.
- IA automática se mantiene apagada por defecto durante la fase de validación.
- Registrar mensajes, clientes, pedidos y actividades no debe consumir tokens de modelo.
- Remy se usa bajo demanda para resumir conversaciones, extraer pedidos, redactar respuestas y analizar oportunidades.
- Cada conversación debe permitir modo `human`, `manual_ai` o `auto`.
- Debe existir un interruptor global de IA automática, independiente del transporte de mensajes.
- Debe existir una acción de un clic `Registrar como venta`, que abra un formulario prellenado con el cliente y permita crear el pedido sin IA.
- Supabase es la fuente de verdad. El CRM es la interfaz operativa. Railway/Baileys solo transporta WhatsApp. Meta Webhooks transportan Instagram/Messenger. La IA es una capa opcional.

Flujo base sin IA:

WhatsApp / Instagram / Messenger -> Messaging Core -> Supabase/CRM -> humano -> pedido.

Flujo bajo demanda:

Conversación -> acción manual de IA -> resultado propuesto -> confirmación humana -> operación determinista en CRM/pedidos.
