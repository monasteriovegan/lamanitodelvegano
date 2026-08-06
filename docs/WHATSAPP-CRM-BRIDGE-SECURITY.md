# Seguridad del puente

- Los mensajes desde Railway se autentican con HMAC SHA-256 mediante `GATEWAY_SHARED_SECRET`.
- Cada mensaje usa `messageId` como clave de idempotencia.
- Los enlaces de confirmación/descartar pedidos están firmados, expiran y no exponen secretos.
- Las credenciales de Supabase y Meta no se envían al Gateway.
- La API pública de Meta permanece separada del endpoint privado de Baileys.
