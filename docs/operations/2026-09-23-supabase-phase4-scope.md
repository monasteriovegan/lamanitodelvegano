# Alcance autorizado de Fase 4

Fecha: 2026-09-23

Objetivo: copiar datos, Auth y Storage desde el proyecto administrado al Supabase self-hosted aislado, sin cutover.

Restricciones vinculantes:

- Origen read-only: no modificar ni eliminar datos o esquema.
- No cambiar DNS, Vercel Production, variables de producción ni endpoints públicos.
- No copiar ni reutilizar JWT/API keys del proyecto administrado.
- No imprimir ni registrar secretos.
- No exponer PostgreSQL, Supavisor, Studio, Envoy ni servicios internos.
- Usar el procedimiento oficial Platform → Self-hosted para los dumps y `rclone` S3→S3 para Storage.
- No usar copia directa a `volumes/storage/`.
- No ejecutar compras, pagos, webhooks, Meta CAPI, WhatsApp outbound ni otras acciones reales.
- Detener Storage si la cuota o las credenciales S3 del origen impiden una copia completa y verificable.

Entregables: backup cifrado fuera del VPS, restore de datos/Auth, validaciones de integridad, inventario de secretos sin valores, inventario de URLs antiguas, copia Storage verificable si el origen lo permite, informe final y parada antes de cualquier cutover.
