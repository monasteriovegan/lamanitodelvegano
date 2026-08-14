# Remy auto-reply state

Remy solo puede responder automáticamente cuando se cumplen ambas condiciones:

1. `integraciones_secretas.ai_enabled = true` (global).
2. La conversación/contacto está habilitada para IA y no está marcada como personal.

Con `ai_enabled = false`, ningún mensaje nuevo dispara respuesta automática aunque una conversación individual esté habilitada.
