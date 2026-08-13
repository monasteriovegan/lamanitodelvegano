# Reconciliación omnicanal

Base administrativa congelada: `1a85a7e935dbb5d5113f010ad8c3d433167a0772` (`ADMIN BASELINE v1`). La rama de integración es `codex/omnichannel-admin-baseline-v1`. No se fusionaron `codex/omnichannel-commerce-core` ni `feature/wonka-whatsapp-gateway`.

- Se conserva: administración actual, catálogo `productos`, pedidos legacy, tablas canónicas `orders/order_items`, web y pagos existentes.
- Se traslada conceptualmente: contrato firmado del gateway, CRM de conversaciones/mensajes y control global de IA.
- Se refactoriza: resolución de identidad, persistencia y deduplicación en `src/lib/messaging`, compartida por Cloud API y Baileys.
- Se descarta: lógica CRM duplicada dentro de cada transporte y deduplicación basada en texto/hora.
- Railway/Baileys no se apaga, no se redespliega y no se borra su autenticación.
- Cloud API solo será transporte principal después de validar inbound, outbound, app móvil y ausencia de duplicados con el usuario presente.
- `pedidos` continúa por compatibilidad; todo código nuevo usa un repositorio que puede escribir la evolución canónica sin crear una tercera tabla.
- Cloud API no entrega necesariamente el historial anterior de la app. El CRM persiste desde la activación; no inventa ni importa historial.
