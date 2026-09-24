# Supabase self-hosted — URL readiness

Fecha: 2026-09-24. La sustitución selectiva se ejecutó únicamente en el self-hosted después de validar HTTPS.

## Inventario funcional

| Tabla/campo | Filas | Tipo | Uso | Estado del binario |
|---|---:|---|---|---|
| `productos.imagen_url` | 7 | Storage público | Catálogo y ficha de producto | Reescrito y HTTP 200 |
| `seasons.banner_image` | 1 | Storage público | Banner de campaña | Reescrito y HTTP 200 |
| `ajustes.data` | 1 | Storage público | Flyer/promoción | Reescrito y HTTP 200 |
| `omnichannel_messages.payload` | 69 | Ruta Storage histórica | CRM/conversaciones | Binario pendiente por HTTP 402 |
| `wonka_jobs.input` | 1 | Storage firmado | Input histórico Wonka | Binario pendiente; firma no reutilizable |
| `wonka_messages.metadata` | 1 | Storage firmado | Adjunto histórico Wonka | Binario pendiente; firma no reutilizable |

No se detectaron URLs antiguas REST, Auth o Realtime entre estas 80 filas.

## Tratamiento reversible

- La migración `20260924145426_prepare_legacy_supabase_url_rewrite.sql` respalda las 80 referencias y sustituye sólo el origin de las relaciones públicas cuyo binario fue recuperado.
- Una prueba RED→GREEN impide que la función directa reescriba `omnichannel_messages`, `wonka_jobs` o `wonka_messages`.
- El ensayo transaccional actualizó 9 filas, dejó 2 firmadas pendientes, guardó 80 valores, restauró 80 y terminó con `ROLLBACK`.
- La ejecución real actualizó las nueve referencias críticas recuperadas y las nueve respondieron HTTP 200 desde el hostname nuevo.
- Las 69 referencias omnichannel pendientes permanecen en el origin antiguo para no fabricar URLs aparentemente válidas con binarios ausentes.
- Las dos URLs firmadas deben regenerarse desde bucket/path después de recuperar el objeto; reemplazar el host invalidaría la firma.
- El rollback restaura el valor completo original desde `migration_support.legacy_supabase_url_backup`.

## Estado

El destino conserva 71 referencias antiguas: 69 objetos omnichannel pendientes y 2 URLs firmadas históricas. Tiene 9 referencias nuevas, todas verificadas HTTP 200. La tabla privada de respaldo contiene las 80 filas originales y la función de rollback permanece disponible. El origen administrado no fue modificado.
