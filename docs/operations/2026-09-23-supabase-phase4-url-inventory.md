# Phase 4: inventario de URLs absolutas antiguas

No se modificó ninguna URL. Los conteos del origen vivo y del destino aislado coinciden exactamente.

| Tabla | Campo | Filas con `*.supabase.co` | Storage público | Storage firmado | Otra API |
|---|---|---:|---:|---:|---:|
| `ajustes` | `data` | 1 | 1 | 0 | 0 |
| `omnichannel_messages` | `payload` | 69 | 69 | 0 | 0 |
| `productos` | `imagen_url` | 7 | 7 | 0 | 0 |
| `seasons` | `banner_image` | 1 | 1 | 0 | 0 |
| `wonka_jobs` | `input` | 1 | 0 | 1 | 0 |
| `wonka_messages` | `metadata` | 1 | 0 | 1 | 0 |
| **Total** |  | **80** | **78** | **2** | **0** |

## Clasificación y tratamiento

- Las 78 referencias públicas usan la ruta `/storage/v1/object/public/`. Podrán sustituirse por el origin HTTPS definitivo manteniendo el resto de la ruta.
- Las dos referencias firmadas usan `/storage/v1/object/sign/`. No se deben arreglar cambiando solo el host: la firma pertenece al proyecto administrado. Deben regenerarse desde el bucket/path correspondiente en el self-hosted cuando la aplicación tenga el hostname definitivo.
- No se detectaron referencias a REST, Auth, Realtime ni otras APIs de Platform dentro de estas 80 filas.
- El recuento es por fila/campo con host antiguo. Los valores no se incluyeron en este documento.

## Migración preparada y reversible

La migración `20260924145426_prepare_legacy_supabase_url_rewrite.sql` se creó mediante `supabase migration new`. No se aplicó al origen ni al destino.

La migración prepara dos funciones restringidas en el esquema no expuesto `migration_support`:

- `apply_legacy_supabase_url_rewrite(new_origin)`: exige un origin HTTPS sin ruta, respalda los 80 valores originales y sustituye únicamente las URLs públicas.
- `rollback_legacy_supabase_url_rewrite()`: restaura los valores completos desde la tabla de respaldo.

La función de avance no toca las dos URLs firmadas y devuelve su cantidad como pendiente. La ejecución queda bloqueada operativamente hasta fijar el hostname definitivo, completar Storage y aprobar el cutover.
