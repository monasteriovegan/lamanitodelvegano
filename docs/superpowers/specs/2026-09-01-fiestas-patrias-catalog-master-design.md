# Fiestas Patrias 2026 — Catálogo Master

## Propósito

Incorporar siete ofertas de Fiestas Patrias 2026 a la arquitectura comercial existente de La Manito del Vegano, manteniendo Supabase como única fuente de verdad para precios, variantes, opciones, packs, disponibilidad y visibilidad por canal.

La implementación es aditiva y compatible con productos, pedidos, conversaciones, integraciones y tracking existentes. No activa respuestas automáticas nuevas ni convierte Meta Catalog en fuente primaria.

## Estado de partida verificado

- La unidad canónica es `business_units.id = f3b57ce7-0796-40e5-94f1-07cb2b48ba85`.
- `productos` contiene cinco filas y representa formatos/sabores mediante `gramaje` y `variedades` de texto.
- No existen tablas normalizadas de variantes, opciones o componentes de packs.
- Ya existen `seasons` y `season_products`, pero no tienen filas.
- Web, checkout, Remy y Wonka leen directamente `productos`; el checkout recalcula server-side mediante `calcularPedido`.
- `carts.cart_items` soporta una clave de variante textual, mientras el carrito web y `pedidos.items` conservan `formato` y `variedad`.
- WhatsApp e Instagram están en `read_only` y no deben habilitar envío automático.
- La conexión Meta no tiene un asset `product_catalog` ni el scope `catalog_management`.
- Hay cambios locales previos sin commit; se preservarán y no se incluirán en commits de esta entrega.

## Alternativas consideradas

### 1. Normalización aditiva integrada — elegida

Crear tablas enfocadas para variantes, grupos de opciones, valores de opciones y componentes de packs; extender temporadas y consumidores existentes. Los productos antiguos continúan funcionando mediante el parser legado cuando no poseen variantes normalizadas.

Ventajas: precios canónicos, selecciones mixtas validadas, packs consultables y migración gradual sin duplicar catálogos.

### 2. Mantener `gramaje` y `variedades`

No permite expresar una selección de 10 o 3 sabores con cantidades exactas, ni relacionar componentes de packs. Se descarta por incumplir los casos comerciales y la validación server-side.

### 3. Crear un producto por sabor/formato

Simplifica el carrito actual, pero duplica productos y fragmenta métricas, URLs, administración y sincronización Meta. Se descarta.

## Modelo de datos

### `product_variants`

Cada fila representa una modalidad vendible con ID y SKU estables.

- `id uuid primary key`
- `business_unit_id uuid not null`
- `product_id uuid not null`
- `sku text not null`
- `name text not null`
- `price integer not null`
- `compare_at_price integer null`
- `weight_grams integer null`
- `units_included integer not null default 1`
- `selection_quantity integer not null default 0`: cantidad total de opciones que debe asignarse para vender una unidad de esta variante.
- `stock integer null`, `manages_stock boolean`, `capacity integer null`
- `is_active boolean`, `sort_order integer`
- `metadata jsonb`

Un índice único por negocio y SKU evita duplicados. Otro índice único por producto y nombre mantiene variantes deterministas.

### `product_option_groups`

Define una dimensión seleccionable del producto, por ejemplo `sabor`, `adobo` o `modalidad`.

- `id uuid primary key`
- `business_unit_id`, `product_id`
- `code`, `name`
- `selection_mode`: `single` o `quantity`
- `is_required`, `sort_order`, `is_active`

`quantity` permite distribuir la cantidad exigida por la variante entre valores repetidos. `single` exige un único valor.

### `product_option_values`

- `id uuid primary key`
- `business_unit_id`, `option_group_id`
- `code`, `label`, `price_delta`, `sort_order`, `is_active`

Para esta campaña todos los `price_delta` son cero. El precio reside en `product_variants`.

### `product_pack_components`

- `id uuid primary key`
- `business_unit_id`, `pack_product_id`
- `component_product_id uuid null`
- `component_name text not null`
- `quantity numeric not null`
- `unit text not null`
- `weight_grams integer null`
- `sort_order integer`

Se usa `component_product_id` cuando existe un producto comercial inequívoco; de lo contrario se conserva el componente estructurado sin crear productos artificiales.

### Temporadas y canales

Se extiende `seasons` con:

- `campaign_tag text`
- `visible_web`, `visible_whatsapp`, `visible_instagram`, `available_to_remy`

Se extiende `season_products` con:

- `visible_web`, `visible_whatsapp`, `visible_instagram`, `available_to_remy`
- `is_featured`, `sort_order`

La temporada tendrá `campaign_tag = fiestas-patrias-2026`. Dulces Típicos estará activo en catálogo pero inicialmente no vinculado como visible a la landing principal; podrá activarse desde administración sin código.

### Compatibilidad

- No se eliminan ni renombran columnas antiguas.
- Los consumidores leen primero variantes/opciones normalizadas y caen al parser `gramaje`/`variedades` solo para productos antiguos.
- El carrito y `pedidos.items` agregan `variantId`, `variantSku` y `selections`, conservando `formato` y `variedad` para pedidos antiguos.
- El RPC de checkout recibe el detalle ya validado por el backend y lo conserva íntegro en el JSON histórico.

## Catálogo autorizado

### Productos reutilizados

- `Seitan de la Manito` se reutiliza como `Seitán Parrillero` si la inspección confirma identidad comercial.
- `Le Kostilles` se reutiliza y corrige.

### Productos nuevos

- La Empanada del 18
- Pack Parrillero Vegano 1
- Pack Parrillero Vegano 2
- Postres en Frascos
- Dulces Típicos

### Dulces Típicos

Se registra como caja de 25 unidades mixtas por $14.900, compuesta por cinco chilenitos, cinco empolvados, cinco merenguitos, cinco alfajores decorados y cinco cachitos. Se mantiene fuera de la landing principal inicialmente mediante flags de campaña, no mediante código.

## Selecciones mixtas

- Empanada unidad: variante con `units_included = 1`, `selection_quantity = 1`.
- Empanada pack 10: `units_included = 10`, `selection_quantity = 10`.
- Postre unidad: `units_included = 1`, `selection_quantity = 1`.
- Postres pack 3: `units_included = 3`, `selection_quantity = 3`.
- El frontend permite cantidades por sabor y solo habilita el CTA cuando la suma coincide exactamente.
- El backend valida IDs, pertenencia al tenant, estado, combinación, suma exacta y precio. Un precio enviado por el cliente nunca se usa.

## Flujo de datos

1. `CatalogRepository` carga producto, variantes, opciones, componentes y campaña por `business_unit_id`.
2. La web y las páginas de producto reciben el mismo DTO de catálogo.
3. El carrito conserva `productId`, `variantId`, selecciones y un precio de presentación; este último no es confiable para checkout.
4. `calcularPedido` resuelve nuevamente todo desde Supabase y produce items canónicos.
5. `OrderRepository` almacena el detalle de variante y opciones en `pedidos.items`, sin alterar pedidos anteriores.
6. Remy usa las mismas funciones de catálogo para `catalog_search`, detalle, variantes, opciones, campaña y carrito.
7. WhatsApp e Instagram usan esa capa compartida con envío automático aún bloqueado por `read_only`.
8. Un feed Meta se genera desde el DTO canónico. La sincronización solo se activa si existe asset y permiso reales.

## Web y administración

- Landing `/fiestas-patrias-2026` y sección visible en portada, reutilizando `SiteShell`, tarjetas y carrito actuales.
- El detalle de producto muestra variantes, selección cuantitativa, composición del pack, fechas y condiciones.
- El admin de productos se amplía para variantes, opciones, visibilidad y packs.
- El admin de temporadas controla flags por campaña y producto, orden y destacado.

## Assets

- Empanadas: flyer específico.
- Postres en Frascos: flyer específico.
- Seitán Parrillero y Le Kostilles: el flyer combinado puede asociarse a ambos productos porque representa realmente a ambos, sin fusionarlos.
- Dulces Típicos: flyer específico.
- Pack Parrillero 1/2: no tienen flyer inequívoco; no se les asignará una imagen engañosa. Quedará registrada la ausencia de asset individual.

Los archivos se suben al bucket público `productos` con rutas estables bajo `campaigns/fiestas-patrias-2026/`.

## Seguridad

- Todas las tablas nuevas en `public` tendrán RLS.
- Lectura pública se limita a productos activos y relaciones activas asociadas a productos visibles; administración se realiza server-side y con las políticas existentes de administrador.
- Se conceden privilegios explícitos mínimos a `anon`, `authenticated` y `service_role` porque las tablas SQL nuevas ya no se exponen automáticamente en proyectos actuales de Supabase.
- Se indexan todas las foreign keys y columnas usadas por tenant/campaña.
- No se exponen service keys, tokens ni secretos.

## Meta Catalog

Se crea un feed determinista con ID/SKU, nombre, descripción, disponibilidad, condición, precio CLP, URL web e imagen. El feed deriva de Supabase.

La conexión final no se marcará como exitosa mientras falten:

- asset `product_catalog` asociado a la conexión;
- permiso `catalog_management` o token con capacidad equivalente;
- catálogo/commerce account apto para vincular a WhatsApp.

## Pruebas y verificación

- Migración idempotente, constraints, RLS y aislamiento por tenant.
- Resolución canónica de precio y rechazo de precios manipulados.
- Selecciones 10 iguales, 5+5, combinación múltiple, 3 iguales y 2+1.
- Variantes Seitán 550 g/1 kg y adobos de Kostilles.
- Componentes de ambos packs.
- Visibilidad de Dulces Típicos configurable.
- API y renderizado de landing/producto.
- Persistencia de carrito y pedido con selección completa.
- Remy consulta datos reales en contextos web, WhatsApp e Instagram.
- `read_only` impide outbound automático.
- Feed Meta refleja el catálogo canónico.
- Suite completa, lint, build y pruebas browser en producción.

No se generará una compra ni un evento Purchase falso durante la verificación.
