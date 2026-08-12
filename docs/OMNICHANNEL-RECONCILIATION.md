# Reconciliación omnicanal

Base: `origin/main` actual. No se fusionó `feature/wonka-whatsapp-gateway`.

- Se conserva: administración actual, catálogo `productos`, pedidos legacy, tablas canónicas `orders/order_items`, web y pagos existentes.
- Se traslada conceptualmente: contrato firmado del gateway, CRM de conversaciones/mensajes y control global de IA.
- Se refactoriza: resolución de identidad, persistencia y deduplicación en `src/lib/messaging`, compartida por Cloud API y Baileys.
- Se descarta: lógica CRM duplicada dentro de cada transporte y deduplicación basada en texto/hora.
- Railway/Baileys no se apaga, no se redespliega y no se borra su autenticación.
- Cloud API solo será transporte principal después de validar inbound, outbound, app móvil y ausencia de duplicados con el usuario presente.
- `pedidos` continúa por compatibilidad; todo código nuevo usa un repositorio que puede escribir la evolución canónica sin crear una tercera tabla.
- Cloud API no entrega necesariamente el historial anterior de la app. El CRM persiste desde la activación; no inventa ni importa historial.
