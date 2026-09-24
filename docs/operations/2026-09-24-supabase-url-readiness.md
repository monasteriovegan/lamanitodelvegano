# Supabase self-hosted — URL readiness

Fecha: 2026-09-24. No se ejecutó ninguna sustitución.

## Inventario funcional

| Tabla/campo | Filas | Tipo | Uso | Estado del binario |
|---|---:|---|---|---|
| `productos.imagen_url` | 7 | Storage público | Catálogo y ficha de producto | Recuperado y verificado |
| `seasons.banner_image` | 1 | Storage público | Banner de campaña | Recuperado y verificado |
| `ajustes.data` | 1 | Storage público | Flyer/promoción | Recuperado y verificado |
| `omnichannel_messages.payload` | 69 | Ruta Storage histórica | CRM/conversaciones | Binario pendiente por HTTP 402 |
| `wonka_jobs.input` | 1 | Storage firmado | Input histórico Wonka | Binario pendiente; firma no reutilizable |
| `wonka_messages.metadata` | 1 | Storage firmado | Adjunto histórico Wonka | Binario pendiente; firma no reutilizable |

No se detectaron URLs antiguas REST, Auth o Realtime entre estas 80 filas.

## Tratamiento reversible

- La migración `20260924145426_prepare_legacy_supabase_url_rewrite.sql` respalda valores y sustituye sólo el origin de URLs públicas.
- La migración no se ejecutará hasta disponer de un origin HTTPS definitivo.
- Las nueve referencias críticas recuperadas podrán cambiarse al nuevo origin cuando éste exista.
- Las 69 referencias omnichannel pendientes no se deben reescribir todavía: hacerlo produciría URLs aparentemente válidas con binarios ausentes.
- Las dos URLs firmadas deben regenerarse desde bucket/path después de recuperar el objeto; reemplazar el host invalidaría la firma.
- El rollback restaura el valor completo original desde `migration_support.legacy_supabase_url_backup`.

## Estado

La base continúa conservando las 80 referencias identificables al origen. Los nuevos fallbacks visuales evitan que una imagen ausente rompa catálogo o panel, pero no alteran pedidos, stock ni checkout.

