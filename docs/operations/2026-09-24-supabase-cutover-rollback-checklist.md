# Supabase self-hosted — checklist de cutover y rollback

Este runbook es una propuesta. No autoriza ni ejecuta DNS, Vercel Production, endpoints públicos, OAuth, pagos, webhooks ni mensajería.

## Gate de decisión

No iniciar cutover si cualquiera de estos puntos está incompleto:

- [ ] Existe aprobación explícita para la ventana y responsables de decisión/rollback.
- [ ] Se aceptó por escrito la pérdida funcional de los 100 binarios Storage pendientes, o se recuperaron y verificaron.
- [ ] La clave S3 temporal de Platform fue revocada y eliminada del bloc de notas.
- [ ] Existe segundo escrow offline de la clave de backups, separado del VPS y de este PC.
- [ ] El hostname definitivo fue aprobado, DNS tiene TTL planificado y Caddy entrega TLS público confiable.
- [ ] Sólo 22, 80 y 443 están permitidos públicamente; 5432, 6543, 8000 y Studio siguen cerrados.
- [ ] Studio devuelve 404 desde el hostname público y continúa disponible sólo por túnel/VPN.
- [ ] Vercel Preview usa variables exclusivas de Preview y claves nuevas del self-hosted; ninguna variable compartida con Production fue sobrescrita.
- [ ] Preview pasó login admin, catálogo, producto, pedido read-only, carga firmada, objeto público y URL firmada privada.
- [ ] `META_TOKEN_ENCRYPTION_KEY` fue preservada exactamente y su descifrado se validó sin outbound.
- [ ] Meta/WhatsApp, Flow, Mercado Pago, Google, Gemini, SMTP/Resend, cron y gateway tienen decisión por entorno.
- [ ] Google OAuth y callbacks usan el hostname definitivo y fueron probados sólo después de habilitación explícita.
- [ ] `META_SEND_MODE`/WhatsApp están `disabled` o `read_only`; cron Preview está desactivado.
- [ ] Backup cifrado reciente pasó checksum y restore drill.
- [ ] `supabaseops` ya no tiene sudo global NOPASSWD, o el riesgo fue aceptado temporalmente con fecha de retiro.

## Preparación de la ventana

- [ ] Registrar en un almacén seguro —no en Git— los valores actuales de las variables Production y DNS necesarios para rollback.
- [ ] Congelar cambios de esquema, catálogo, pedidos y configuración durante el corte.
- [ ] Definir un periodo de sólo lectura o mantenimiento; sin dual-write improvisado.
- [ ] Tomar dump final Platform oficial de roles, schema y data por separado; verificar hashes.
- [ ] Tomar backup cifrado del destino y confirmar copia offsite.
- [ ] Importar el dump/delta final con triggers controlados y verificar `session_replication_role=origin` al terminar.
- [ ] Comparar 108 tablas, 136 FK, 4 secuencias, 25 fingerprints críticos, Auth y Storage físico.
- [ ] Confirmar 0 filas huérfanas y 0 diferencias no aceptadas.
- [ ] Aplicar la reescritura reversible de 78 URLs públicas sólo con el origin HTTPS definitivo.
- [ ] Regenerar las 2 URLs firmadas antiguas; nunca reemplazarles sólo el host.

## Activación controlada

- [ ] Crear/confirmar DNS del subdominio y activar Caddy.
- [ ] Abrir UFW únicamente para TCP 80/443 y volver a comprobar `ss -tulpn` desde dentro y fuera.
- [ ] Validar TLS, HSTS, WebSocket Realtime, límites de upload y denegación de Studio.
- [ ] Crear variables Vercel Preview exclusivas y desplegar Preview.
- [ ] Repetir el smoke completo sin side effects externos.
- [ ] Con aprobación separada, cambiar variables Vercel Production en una sola ventana y desplegar el artefacto ya validado.
- [ ] Actualizar callbacks/webhooks externos de uno en uno, verificando recepción e idempotencia antes de habilitar outbound.
- [ ] Mantener pagos, CAPI y mensajería saliente deshabilitados hasta sus pruebas explícitas.

## Criterios de rollback inmediato

- TLS inválido, endpoint incorrecto o Studio expuesto.
- Diferencia no explicada de conteos/FK/secuencias.
- Login admin o RLS falla cerrado/abierto incorrectamente.
- Catálogo, checkout, stock o lectura de pedidos falla.
- Storage crítico devuelve 404/500 después de la reescritura.
- Duplicación de webhooks, pedidos, pagos o mensajes.
- Uso sostenido de recursos o errores 5xx fuera de umbrales acordados.

## Rollback

1. Deshabilitar primero cron, outbound, webhooks nuevos y cualquier productor de escrituras en el self-hosted.
2. Restaurar en Vercel Production las variables anteriores desde el almacén seguro y desplegar el último artefacto conocido; no reconstruir valores desde memoria.
3. Restaurar callbacks/webhooks externos y DNS anteriores si fueron cambiados.
4. Confirmar que el Supabase administrado vuelve a servir Auth, catálogo, pedidos y Storage.
5. Si el self-hosted recibió escrituras, exportar el delta antes de apagarlo. No copiarlo automáticamente al origen: revisar pedidos, pagos, stock y mensajes para evitar duplicados.
6. Mantener el self-hosted aislado y preservar logs/backups para análisis; no destruirlo.
7. Documentar timestamps, última escritura válida de cada lado y decisión de reconciliación.

## Cierre exitoso

- [ ] Observar errores, latencia, Auth, DB, Storage y colas durante la ventana acordada.
- [ ] Ejecutar backup post-cutover y restore drill aislado.
- [ ] Rotar secretos temporales y revocar credenciales antiguas sólo después del periodo de rollback.
- [ ] Endurecer sudo/root, configurar alertas externas y mantener Studio privado.
- [ ] Cerrar el periodo de rollback sólo con aprobación explícita.
