# Diseño: Catálogo Master + Temporadas genéricas + promociones visibles

## Objetivo

Dejar el catálogo preparado como una pieza reutilizable del producto: `Catálogo Master` es la única fuente permanente de productos, variantes, precio base y stock; `Temporadas & Colecciones` agrega configuración temporal sin duplicar productos ni modificar el dato maestro.

El resultado debe servir igual para Fiestas Patrias, Navidad, San Valentín o cualquier otra campaña, y un negocio que no use temporadas debe poder ignorar el módulo sin afectar su catálogo normal.

## Estado actual y problema

- `/admin/productos` ya funciona como Catálogo Master general.
- `/admin/temporadas` ya permite crear y editar temporadas genéricas con nombre, fechas, banner y selección de productos.
- `/admin/catalogo-master` se presenta como `Canales & Precios`, pero su API está fijada a `campaign_tag = fiestas-patrias-2026`.
- La pantalla de Fiestas Patrias modifica `product_variants.price`, por lo que un precio temporal puede alterar el precio maestro.
- `ProductCard` ya sabe mostrar precio anterior y resumen de packs, pero la carga principal de productos no entrega siempre las variantes normalizadas.
- La sección `Destacados & Ofertas` imprime directamente `producto.precio`, por lo que puede ocultar una promoción real.

## Principios

1. Un producto existe una sola vez en Catálogo Master.
2. Una temporada referencia productos/variantes; no los copia.
3. Un override estacional nunca modifica `productos.precio` ni `product_variants.price`.
4. Al finalizar o desactivar una temporada, el override deja de aplicarse automáticamente.
5. Todos los canales consumen el mismo catálogo efectivo: Web, WhatsApp, Instagram y Remy.
6. La administración queda scoped por `business_unit_id`; no se agregan conceptos específicos de La Manito al modelo genérico.
7. El stock físico sigue teniendo una sola fuente de verdad. Esta tarea no crea un segundo inventario estacional que pueda desincronizarse.

## Modelo de datos

Agregar `season_variant_overrides`:

- `season_id uuid not null` → `seasons.id`
- `variant_id uuid not null` → `product_variants.id`
- `price_override integer null`
- `compare_at_price_override integer null`
- `is_active boolean not null default true`
- timestamps
- PK/unique `(season_id, variant_id)`

Reglas:

- `price_override >= 0` cuando exista.
- `compare_at_price_override >= effective price` cuando exista.
- Al borrar temporada, borrar overrides.
- El precio maestro nunca se actualiza desde el editor de temporada.

`season_products` sigue siendo responsable de pertenencia del producto, orden, destacado y visibilidad Web/WhatsApp/Instagram/Remy.

### Stock / cupos

El stock permanece en `product_variants.stock` / catálogo maestro y el editor de temporada lo muestra como referencia. No se agrega en este cierre un `stock_override` o contador de cupo temporal separado, porque eso duplicaría inventario y requeriría conciliación adicional con pedidos/cancelaciones.

Si más adelante un cliente SaaS necesita cupos de preventa independientes del stock físico, se diseña como una capacidad opcional separada con su propio ledger. No se deja un campo semánticamente incompleto en esta versión.

## Resolución del catálogo efectivo

Crear una función/repositorio de resolución estacional que reciba:

- business unit
- season/campaign
- channel

Para cada variante devuelve:

- precio efectivo = `price_override ?? variant.price`
- precio anterior efectivo = `compare_at_price_override ?? variant.compareAtPrice`
- stock = stock maestro de la variante
- activo únicamente si producto, variante, temporada y vínculo están activos/visibles para el canal

La función no muta filas maestras.

Cuando una temporada terminó (`ends_at`) o está desactivada, no se aplica ningún override en canales públicos.

## Administración

### Navegación

Eliminar `🎛️ Canales & Precios` como módulo principal del sidebar.

Bajo Catálogo deben quedar:

- `🌿 Catálogo Master`
- `📅 Temporadas & Colecciones`
- `🏷️ Categorías`

No se elimina ninguna capacidad; solo se ubica donde corresponde.

### Temporadas & Colecciones

`/admin/temporadas` sigue siendo la lista genérica.

Cada temporada tendrá acción `Gestionar productos y canales`, que abre:

`/admin/temporadas/[id]/catalogo`

Ese editor reutiliza la UI útil que hoy vive en `/admin/catalogo-master`, pero recibe el `seasonId` dinámicamente y muestra el nombre real de la temporada.

Por producto permitirá:

- estado del producto maestro en modo informativo
- visible Web
- visible WhatsApp
- visible Instagram
- disponible para Remy
- variantes de catálogo
- precio normal maestro en modo lectura
- precio temporal opcional
- precio anterior/promocional opcional
- stock maestro en modo lectura
- opciones/sabores activos

El mensaje de UI debe distinguir claramente `Precio maestro` de `Precio de esta temporada`.

`/admin/catalogo-master` queda como redirección compatible a `/admin/temporadas`, para no dejar enlaces viejos rotos.

## Vitrina pública y promociones

### Catálogo general

`getProductosActivos()` debe entregar también las variantes normalizadas activas para que `formatPriceSummary()` tenga todos los precios disponibles.

Las tarjetas normales usarán una sola función de resumen de precio.

Ejemplo esperado:

- `$2.900 unidad`
- `🔥 10 por $23.900`

Cuando exista precio anterior/promoción:

- precio efectivo destacado
- precio anterior tachado
- etiqueta de oferta cuando corresponda

### Destacados & Ofertas

La sección de portada dejará de imprimir `p.precio` directamente y usará el mismo `formatPriceSummary()` que `ProductCard`.

Así la promoción visible es consistente en toda la web.

### Página de temporada

`CampaignCatalog` recibe el catálogo efectivo de esa temporada, por lo que las variantes muestran automáticamente precios temporales sin alterar el Master.

## Canales y Remy

`loadCatalogCampaign()` y el catálogo usado por Remy deben resolver la misma combinación de:

- temporada activa
- visibilidad de temporada
- visibilidad de producto en temporada
- overrides efectivos de variante

WhatsApp, Instagram y Remy nunca deben recibir un precio diferente por tener lógica duplicada.

## Migración de Fiestas Patrias 2026

Los precios actualmente aprobados de Fiestas Patrias se mantienen como valores efectivos.

Durante la migración:

1. no inventar un precio maestro histórico que no esté respaldado por datos;
2. copiar a overrides estacionales los precios efectivos de las variantes de Fiestas Patrias que hoy administra la pantalla específica, conservando el valor visible actual;
3. no cambiar `product_variants.price` durante esa migración;
4. mantener vínculos y visibilidad existentes de `season_products`;
5. verificar que la página `/fiestas-patrias-2026` conserva exactamente los precios/variantes aprobados.

Esto introduce la separación correcta hacia adelante sin alterar retrospectivamente precios maestros sin evidencia. Los productos pueden permanecer en el Master aunque una temporada quede finalizada; su exposición pública sigue las reglas de canal/temporada existentes.

No se borran productos ni temporadas históricas.

## Compatibilidad / venta del modelo

- Sin temporada activa, Catálogo Master sigue funcionando normalmente.
- El módulo de temporadas es opcional y no invade la operación diaria.
- No hay nombres de fiestas específicos en API/repositorios genéricos.
- Las campañas específicas son datos (`seasons`), no código.
- Un nuevo negocio puede crear `Navidad`, `Semana Santa`, `Black Friday` o ninguna temporada sin cambios de código.

## Errores y seguridad

- Todas las escrituras verifican rol admin y `business_unit_id`.
- Un override no puede apuntar a una variante de otro negocio.
- Si falta una temporada, API devuelve 404 y no modifica el Master.
- Si un override es inválido, la actualización falla completa para ese cambio.
- Si no hay override, siempre hay fallback explícito al dato maestro.

## Pruebas requeridas

1. Temporada genérica carga por ID y no por tag hardcodeado.
2. Editor de temporada no actualiza `product_variants.price` al guardar precio temporal.
3. Override se aplica solamente dentro de la temporada correspondiente.
4. Temporada expirada/desactivada deja de aplicar override.
5. Visibilidad por Web/WhatsApp/Instagram/Remy sigue respetándose.
6. Restricción de business unit evita cross-tenant writes.
7. Catálogo general entrega variantes a `ProductCard`.
8. ProductCard muestra unitario + pack/promoción cuando corresponda.
9. `Destacados & Ofertas` usa el mismo resumen promocional.
10. Fiestas Patrias conserva precios y variantes aprobados después de la migración.
11. Sidebar ya no muestra `Canales & Precios`; muestra `Temporadas & Colecciones`.
12. `/admin/catalogo-master` redirige de forma compatible y no queda como módulo operativo independiente.
13. Stock mostrado y descontado sigue proviniendo del Catálogo Master; no aparece un segundo contador estacional.

## Criterio de cierre

La tarea se considera terminada solo cuando:

- migración aplicada en Supabase;
- CI completo verde;
- cambios fusionados a `main`;
- deployment production `READY`;
- Catálogo Master mantiene los precios maestros;
- Fiestas Patrias funciona mediante el editor genérico y sus overrides de precio;
- se puede crear una segunda temporada de prueba sin código específico y luego eliminar/desactivar esa prueba;
- las tarjetas de la home muestran promociones/packs correctamente;
- sidebar y navegación reflejan la jerarquía final.
