# Supabase Storage recovery — Fase 4B

Fecha: 2026-09-24.

## Resultado

- Objetos inventariados: 127 / 74.808.818 bytes.
- Recuperados, verificados y cargados: 27 / 39.405.106 bytes.
- Pendientes por HTTP 402 y sin copia local verificada: 100 / 35.403.712 bytes.
- Objetos CRÍTICOS: 9; recuperados: 9; pendientes: 0.
- Objetos IMPORTANTES: 76; todos son adjuntos privados CRM/Wonka pendientes.
- Objetos HISTÓRICOS: 42; 18 recuperados y 24 pendientes.

El manifiesto entregable usa identificadores opacos derivados de SHA-256 para las rutas privadas. El mapa completo de rutas permanece en un archivo protegido fuera de Git.

## Búsqueda

- Se inspeccionaron 33.529 archivos en Desktop, Downloads, Documents, Codex, Antigravity, scratch, workspaces y cachés temporales útiles.
- Se inspeccionaron 8.501 objetos Git en todas las ramas y el historial.
- Sólo se aceptaron candidatos cuyo tamaño y MD5 coincidían con el ETag simple de Storage.
- No se aceptaron coincidencias por nombre o tamaño solamente.
- La única muestra oficial de URL pública respondió HTTP 402; no se hicieron más intentos remotos ni se probó el endpoint privado.

## Carga self-hosted

Los 27 objetos verificados pertenecen al bucket público `productos`. Se cargaron por `/storage/v1/s3` conservando bucket y path. La carga no escribió directamente en `volumes/storage/`.

Verificaciones:

- `rclone check --download --one-way`: 27 archivos coincidentes, 0 diferencias.
- URL pública interna: HTTP 200, tamaño y MIME esperados.
- Configuración temporal de rclone eliminada.
- Los 100 objetos pendientes conservan metadata SQL, pero el binario no existe en el destino.

## Impacto operativo

El catálogo, las páginas de producto, promociones activas y checkout ya disponen de todos los assets clasificados como críticos. Los archivos pendientes corresponden a adjuntos CRM/Wonka y a material histórico/no referenciado; deben continuar visibles como pendientes y no deben bloquear un futuro cutover si las pruebas funcionales confirman los fallbacks.

