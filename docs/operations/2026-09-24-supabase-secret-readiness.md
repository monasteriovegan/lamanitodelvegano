# Supabase self-hosted — secret readiness

Fecha: 2026-09-24. Este documento registra decisiones y dependencias; no contiene valores.

| Grupo | Clasificación | Acción antes de Preview/cutover |
|---|---|---|
| `META_TOKEN_ENCRYPTION_KEY` | **CONSERVAR** | Debe ser exactamente la misma para descifrar los tokens Meta migrados. Cargar sólo por canal secreto servidor. |
| Tokens cifrados Meta/Instagram/WhatsApp de `meta_connections` | **CONSERVAR** | Validar descifrado en modo read-only. No enviar outbound ni CAPI. |
| App IDs, WABA, Page, Instagram Business y Phone Number IDs | **RECONFIGURAR** | Confirmar que cada ID corresponde al asset migrado; no son secretos, pero controlan enrutamiento. |
| App secrets y webhook verify token Meta | **CONSERVAR** | Mantener mientras los endpoints continúen en Vercel. Una rotación posterior requiere coordinación con Meta. |
| `META_SEND_MODE` / `META_WHATSAPP_SEND_MODE` | **RECONFIGURAR** | Preview debe usar `disabled`/`read_only`. |
| Flow | **RECONFIGURAR** | Conservar credenciales cifradas existentes, pero usar sandbox/dry-run y no invocar cobros reales. |
| Mercado Pago | **RECONFIGURAR** | Unificar alias, usar credenciales sandbox en Preview y mantener webhooks productivos sin cambios. |
| Google Auth | **RECONFIGURAR** | Añadir URI de callback del futuro hostname; no habilitar hasta disponer de HTTPS probado. |
| Google Calendar/Wonka OAuth | **RECONFIGURAR** | Conservar cliente/refresh token mientras sea válido y añadir callback Preview separado. |
| Gemini y otros proveedores IA | **RECONFIGURAR** | Elegir una fuente canónica servidor/DB; nunca exponer en el cliente. |
| SMTP / Resend | **RECONFIGURAR** | Verificar dominio y remitente. Preview no debe enviar correos reales sin prueba controlada. |
| Cron secrets | **REGENERAR** | Generar por entorno; mantener cron Preview desactivado para evitar doble ejecución. |
| Gateway/bridge/internal secrets | **REGENERAR** | Generar por entorno y coordinar ambos extremos antes de activarlos. |
| MCP tokens | **REGENERAR** | Emitir tokens nuevos y revocar los antiguos cuando el nuevo endpoint esté operativo. |
| Wonka signing/worker secrets | **REGENERAR** | Generar por entorno; conservar sólo credenciales externas que deban seguir accediendo al mismo proveedor. |
| Self-hosted anon/publishable, service-role, JWT y JWKS | **CONSERVAR** | Conservar exclusivamente el juego nuevo del VPS. No copiar claves de Platform. |
| Password PostgreSQL y claves internas del stack | **CONSERVAR** | Permanecen en `.env` protegido del VPS; rotación sólo mediante procedimiento coordinado. |
| Claves anon/service-role/JWT/password DB de Platform como configuración futura | **ELIMINAR** | No deben existir en Preview/self-hosted. Mantenerlas únicamente en Production hasta un cutover aprobado. |
| Clave S3 temporal creada para la extracción Platform | **ELIMINAR** | Revocar en Dashboard y borrar cualquier copia del bloc de notas. La revocación no puede confirmarse desde el flujo read-only. |

## Estado

- Los secretos propios del self-hosted fueron generados durante Fase 3 y permanecen fuera de Git.
- El snapshot conserva la fila cifrada de `integraciones_secretas` y los tokens cifrados Meta sin mostrar valores.
- No se configuraron secretos nuevos en Vercel Production.
- Preview continúa bloqueado hasta disponer de un endpoint HTTPS alcanzable.

