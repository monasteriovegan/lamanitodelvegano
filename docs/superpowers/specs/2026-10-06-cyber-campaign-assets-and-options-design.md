# Cyber Day Chocolatoso 2026: assets y opciones aislados del catálogo maestro

Fecha: 2026-10-06  
Estado: diseño aprobado en conversación; pendiente revisión de esta especificación escrita  
Rama: `codex/cyber-campaign-assets-2026`  
Base: `origin/main` en `8845449`

## Objetivo

Publicar la experiencia completa de Cyber Day Chocolatoso sin volver a sustituir fotografías, nombres, precios base ni variantes del catálogo maestro. Los siete artes entregados pertenecen a la campaña y deben desaparecer de la presentación cuando la campaña termine; los productos canónicos deben conservarse intactos.

La experiencia debe permitir comprar exactamente lo anunciado en cada arte. Cada selección debe terminar en un producto y una variante reales, con precio resuelto por el servidor y trazabilidad correcta en carrito, pedido y pago.

## Alcance y restricciones

- Campaña: `cyber-day-chocolatoso-2026`.
- Vigencia comercial: desde el 5 de octubre de 2026 hasta el viernes 9 de octubre de 2026 a las 23:59, `America/Santiago`.
- Fecha única de entrega: sábado 10 de octubre de 2026.
- Se conservan los 18 precios especiales ya aprobados.
- Los demás formatos activos reciben 25% de descuento sobre su precio maestro vigente.
- Un formato con precio especial explícito no recibe además el 25%; no hay descuentos acumulados.
- No se modifican stock, pedidos, pagos, tracking, integraciones, preferencias de canal ni automatizaciones.
- Las verificaciones no crean pedidos ni cobros reales.
- Remy, WhatsApp, Instagram, Pixel y CAPI quedan fuera de este cambio.

## Decisión arquitectónica

Se separan cuatro conceptos que hoy están parcialmente mezclados:

1. **Catálogo maestro:** `productos`, `product_variants`, grupos de opciones y componentes. Contiene identidad, fotografías originales, precios normales y configuración permanente del producto.
2. **Presentación de campaña:** `seasons` y `season_products`. Contiene hero, arte, texto y posición temporal de cada oferta.
3. **Precio de campaña:** `season_variant_overrides` para los 18 valores explícitos; `applyCyberPricing` aplica 25% sólo a las variantes sin override.
4. **Destino de compra:** cada opción presentada debe apuntar a un `product_id` y `variant_id` canónicos. La tarjeta configurable de barras usará un mapa relacional de destinos y nunca un producto falso.

Esta estructura permite cambiar o retirar artes Cyber sin escribir en `productos.imagen_url`, `productos.images` ni `product_variants.image_url`.

## Alternativas consideradas

### Elegida: presentación estacional y destinos canónicos

Se agregan metadatos de presentación a `season_products` y una tabla de destinos para la tarjeta de barras. Es la opción con mejor aislamiento y conserva la identidad real en pedidos.

### Rechazada: volver a reemplazar imágenes maestras

Es simple, pero repite el incidente que dejó fotos rotas y obliga a restaurar el catálogo al finalizar la campaña.

### Rechazada: crear un producto genérico por cada flyer

Duplica productos, divide inventario y hace que los pedidos de Dubái, Terremoto o Supernova pierdan su asociación canónica.

## Modelo de datos

### Extensión de `season_products`

Una migración nueva, transaccional e idempotente agregará:

- `campaign_name text null`: título exclusivo de la tarjeta.
- `campaign_description text null`: descripción exclusiva de campaña.
- `campaign_image_url text null`: arte temporal, separado de la foto maestra.
- `campaign_alt_text text null`: texto alternativo del arte.
- `presentation_slot text not null default 'catalog'`, restringido a:
  - `hero_offer`: oferta comprable asociada al hero;
  - `featured`: una de las seis tarjetas Cyber;
  - `catalog`: resto del catálogo con 25%;
  - `target_only`: producto real usado por una oferta agrupada, sin tarjeta duplicada.

`is_featured` se conserva por compatibilidad durante la migración, pero la interfaz Cyber usará `presentation_slot` como fuente de verdad.

### Nueva tabla `season_product_variant_targets`

Representa las opciones de una tarjeta que vende variantes pertenecientes a productos diferentes:

- `id uuid primary key`;
- `business_unit_id uuid not null`;
- `season_id uuid not null`;
- `display_product_id uuid not null`: producto cuyo vínculo estacional contiene el arte y texto de la tarjeta;
- `target_product_id uuid not null`: producto real que entrará al carrito;
- `target_variant_id uuid not null`: variante real que entrará al carrito;
- `group_label text not null`: universo, por ejemplo `Dubái`;
- `option_label text not null`: formato, por ejemplo `120 g`;
- `sort_order integer not null default 0`;
- timestamps;
- unicidad por `(season_id, display_product_id, target_variant_id)`;
- claves foráneas hacia campaña, producto de presentación, producto destino y variante destino;
- índice por `(season_id, display_product_id, sort_order)`.

La migración validará que campaña, tarjeta, producto destino y variante pertenezcan a la misma unidad de negocio. La aplicación volverá a validar que `target_variant_id` pertenezca a `target_product_id` antes de exponerlo o comprarlo.

La tabla tendrá RLS habilitado. `service_role` podrá administrarla; no se concederá escritura pública. La lectura de storefront continuará ocurriendo del lado servidor mediante el cliente de servicio y sólo el DTO saneado llegará al navegador.

### Migraciones aplicadas

No se editarán las migraciones ya ejecutadas `20261006013933_cyber_day_chocolatoso_2026.sql` ni `20261006024500_restore_cyber_catalog_images.sql`. La implementación creará una migración posterior mediante `supabase migration new`, con precondiciones que aborten si faltan productos o variantes esperados.

## Matriz de assets

Los archivos se convertirán a formatos web optimizados y vivirán solamente bajo `public/campaigns/cyber-day-chocolatoso-2026/`. Los PNG originales no se guardarán en columnas maestras.

| Posición | Producto/oferta | Archivo fuente | Uso |
|---|---|---|---|
| Hero + oferta hero | Dúo de barras rellenas de 120 g | `Chocolate vegano_ Cyber Chocolatoso.png` | `seasons.banner_image`; el CTA abre la oferta canónica `duo-barras-rellenas` |
| Destacado 1 | Brigadeiros y trufas | `Cajita Vegana de Brigadeiros y Trufas.png` | `campaign_image_url` de `brigadeiros-trufas-surtidos` |
| Destacado 2 | Alfajores de cáñamo | `Alfajores de Cáñamo_ Sabores Irresistibles.png` | `campaign_image_url` de `alfajores-canamo` |
| Destacado 3 | Protein Balls | `Cyber Day de Chocolate Vegano.png` | `campaign_image_url` de `protein-balls` |
| Destacado 4 | Box Chocolatosa | `Caja Cyber Day de Chocolates Veganos.png` | `campaign_image_url` de `box-chocolatosa` |
| Destacado 5 | Barras configurables | `Barra Terremoto_ Chocolate Vegano Artesanal.png` | tarjeta agrupada presentada desde `barra-terremoto` |
| Destacado 6 | Bombones artesanales | `Bombones Veganos Premium_ Seis Sabores.png` | `campaign_image_url` de `promocion-24-bombones` |

El hero es el séptimo asset y no cuenta como una de las seis tarjetas destacadas. `barra-dubai` y `explosion-supernova` quedan como destinos reales de la tarjeta agrupada y no generan tarjetas Cyber duplicadas.

## Ofertas y opciones comprables

### Oferta hero: dúo de barras

- Producto real: `duo-barras-rellenas`.
- Variante: `LMV-CYBER-DUO-120G`.
- Cantidad de selecciones: 2.
- Opciones canónicas: Dubái y Explosión de Supernova; se permiten dos iguales o una de cada una.
- Precio Cyber: $17.900; comparación: $21.800.
- La página Cyber mostrará esta oferta inmediatamente después del hero, separada de las seis tarjetas.

### Tarjeta agrupada de barras

Se mostrará una sola tarjeta con seis destinos reales:

| Universo | 120 g | 240 g |
|---|---:|---:|
| Dubái | `LMV-DUBAI-120G` · $10.900 | `LMV-DUBAI-240G` · $17.900 |
| Terremoto | `LMV-TERREMOTO-120G` · $10.900 | `LMV-TERREMOTO-240G` · $17.900 |
| Explosión de Supernova | `LMV-SUPERNOVA-110` presentado como 120 g · $10.900 | `LMV-SUPERNOVA-230` presentado como 240 g · $17.900 |

El selector debe hacer visible universo y gramaje antes de habilitar “Agregar al carrito”. El carrito recibirá el producto y variante destino, no `barra-terremoto` de forma fija.

### Brigadeiros y trufas

- Variantes: 9, 15 y 24 unidades.
- Precios Cyber: $9.900, $14.900 y $17.900.
- Se conserva el grupo canónico de seis sabores y la cantidad exacta requerida por variante.

### Protein Balls

- Variantes: 9, 15 y 24 unidades.
- Precios Cyber: $9.900, $14.900 y $17.900.
- Se conservan sus tres sabores canónicos y la cantidad exacta requerida por variante.

### Alfajores de cáñamo

- Variante: pack de 4.
- Precio Cyber: $8.900; comparación: $11.900.
- Se conservan sus cuatro sabores canónicos y la selección total de cuatro unidades.

### Box Chocolatosa

- Precio: $21.900.
- Debe exigir una barra de 80 g: Dubái, Terremoto o Explosión de Supernova.
- Los demás componentes se muestran como contenido del pack, sin crear opciones engañosas.

### Bombones artesanales

- Variantes: 9, 15 y 24 unidades.
- Precios Cyber: $9.900, $14.900 y $17.900.
- Se creará o completará el grupo canónico `sabores`, modo `quantity`, obligatorio.
- `selection_quantity` debe ser 9, 15 o 24 según la variante.
- Sabores permanentes del producto:
  1. Ganache cremoso de té chai.
  2. Compota de naranja, jengibre y trufa bitter de maracuyá.
  3. Manzana confitada y ganache choco-canela.
  4. Caramelo salado estilo Snickers.
  5. Confitura de frutos rojos y ganache de chocolate 55%.
  6. Mokkachino Whisky.

Estas opciones describen el producto real, por lo que permanecen en el catálogo maestro después de Cyber; el flyer y los precios Cyber no.

## Resolución de precios

La regla del servidor es:

1. Si la campaña no está activa o está fuera de ventana, devolver producto y precio maestro sin transformación.
2. Si la variante tiene un override Cyber activo, usar `price_override` y `compare_at_price_override`.
3. Si no tiene override, usar `round(precio_maestro * 0.75)` y mostrar el maestro como precio anterior.
4. Los `price_delta` de opciones sólo reciben 25% cuando el producto no participa de una oferta explícita; no se descuenta dos veces.
5. Checkout y creación de pedido vuelven a calcular la misma regla en servidor. Nunca confían en el precio enviado por el navegador.

La batería de pruebas fijará los 18 overrides y demostrará que los precios almacenados en `product_variants.price` no cambian.

## Flujo de datos y componentes

### Lectura

`loadDefaultCatalogCampaign` ampliará su consulta de `season_products` y cargará los destinos agrupados. `CatalogCampaignProduct` y el DTO público expondrán:

- presentación de campaña (`campaignName`, `campaignDescription`, `campaignImageUrl`, `campaignAltText`);
- `presentationSlot`;
- una lista saneada de `purchaseTargets`, cada uno con producto, variante, etiqueta, precio efectivo y stock efectivo.

La foto maestra seguirá disponible como fallback. La presentación Cyber nunca se copia de vuelta al maestro.

### Home

- `Hero` usa `seasons.banner_image` y enlaza a la página Cyber.
- La sección “Destacados & Ofertas” consume directamente los productos `featured` de la campaña y su `campaignImageUrl`; no vuelve a buscarlos en el arreglo legado `productos`.
- El catálogo general usa fotografías maestras y precios efectivos.

### Página Cyber

Orden:

1. Hero e introducción.
2. Oferta hero del dúo de barras, con sus opciones canónicas.
3. Seis tarjetas `featured`, usando arte y texto de campaña.
4. Resto del catálogo `catalog`, bajo el título de 25%.

Los productos `target_only` no se renderizan como tarjetas adicionales. La tarjeta de barras usará los `purchaseTargets`; las demás continuarán usando variantes y grupos de opciones canónicos.

### Carrito y checkout

- Una selección normal conserva `productId`, `variantId`, `variantSku`, selecciones y `campaignTag`.
- Una selección de la tarjeta agrupada utiliza los IDs del destino elegido.
- El nombre visual puede incluir “Universo · formato”, pero la identidad de pedido sigue siendo canónica.
- El resolvedor del servidor rechaza destinos inactivos, sin stock o que no pertenezcan al producto indicado.
- La fecha de entrega efectiva sigue siendo únicamente `2026-10-10`.

## Comportamiento al terminar la campaña

Fuera de la ventana o con `is_active = false`:

- el hero Cyber deja de mostrarse;
- no se leen artes ni textos de `season_products`;
- no se aplican overrides ni el 25%;
- desaparecen los selectores agrupados de campaña;
- el catálogo maestro, sus fotografías, opciones permanentes y precios normales continúan disponibles.

No se requiere una migración de restauración para cerrar la campaña.

## Manejo de errores

- Si falta un arte, `SafeStorageImage` usa la foto maestra y registra el fallo sin romper la tarjeta.
- Si un destino agrupado no puede validarse, se omite ese destino; si no queda ninguno, la tarjeta no permite comprar y el servidor registra el error.
- Si una variante queda sin stock, se deshabilita sólo esa opción.
- Si la configuración de sabores no alcanza la cantidad requerida, el botón permanece visible pero deshabilitado y explica cuántas unidades faltan.
- La migración aborta completa ante una precondición fallida; no deja datos parciales.

## Accesibilidad y presentación responsive

- Los siete assets mantendrán su proporción vertical completa con `object-contain`; no se cortará texto ni precio del flyer.
- Desktop: máximo dos columnas en la página Cyber para que el texto del arte sea legible.
- Móvil: una columna, sin overflow horizontal y con controles de al menos 44 px.
- Cada arte tendrá `alt` descriptivo; los selectores usarán botones con estado seleccionado, foco visible y etiquetas no dependientes sólo del color.
- Los estados incompletos o sin stock tendrán mensajes de texto asociados.

## Estrategia de pruebas

La implementación seguirá TDD: primero se agregarán pruebas que fallen y luego el cambio mínimo para hacerlas pasar.

### Datos y migración

- La migración corre dos veces sin duplicar filas.
- Existen siete asignaciones de assets: un hero y seis destacados.
- Hay exactamente seis tarjetas `featured`, una `hero_offer` y los targets necesarios.
- La matriz de barras contiene seis destinos y cada variante pertenece al producto esperado.
- Bombones tiene seis sabores y cantidades 9/15/24.
- Las imágenes maestras, precios base, stock, pedidos y tracking conservan sus hashes o agregados previos.
- RLS y privilegios bloquean escritura pública.

### Dominio y precios

- Los 18 overrides tienen los valores aprobados.
- Una variante con override no recibe el 25% adicional.
- Una variante sin override recibe exactamente 25% sobre el maestro.
- Fuera de ventana todos los productos vuelven al precio maestro.
- El servidor ignora un precio de cliente manipulado.

### Interfaz y carrito

- Home usa `campaignImageUrl` para destacados y foto maestra para el catálogo general.
- Hero y seis tarjetas corresponden a los archivos correctos.
- Cada variante de 9/15/24 exige la cantidad correcta de sabores.
- La barra agrupada no se puede agregar sin elegir un destino y agrega el producto/variante real elegido.
- Los siete artes se ven completos en 390 px y en escritorio.
- No hay tarjetas duplicadas para Dubái, Terremoto y Supernova.
- La fecha disponible es sólo el 10 de octubre de 2026.

### Regresión

- Suite completa `npm test`.
- `npm run lint` y `npm run build`.
- Prueba de carrito y checkout con dobles/mocks; no se crea un pedido real.
- Verificación visual de home, página Cyber, producto y carrito en escritorio y móvil.

## Despliegue y verificación de producción

La implementación tendrá dos artefactos independientes: código/assets y migración de datos. Antes de aplicar en el Supabase self-hosted se respaldarán:

- `season_products`;
- `season_variant_overrides`;
- la nueva tabla de destinos si ya existe;
- opciones/valores y variantes de los seis productos afectados;
- agregados e inventarios de `productos`, `pedidos` y tracking para verificar invariantes.

Orden previsto:

1. CI y preview sin escrituras externas.
2. Respaldo de producción.
3. Migración transaccional en Supabase self-hosted.
4. Despliegue de código y assets.
5. Healthcheck, logs y verificación visual desktop/móvil.
6. Pruebas de selección y carrito sin finalizar checkout.
7. Comparación de invariantes y registro de evidencia.

El rollback desactiva la presentación nueva y revierte el despliegue; como las fotos y precios maestros nunca se sustituyen, el catálogo normal queda operativo inmediatamente.

## Criterios de aceptación

1. El hero muestra el asset combinado y las seis tarjetas muestran el flyer correcto, sin recortes.
2. La foto maestra de ningún producto cambia.
3. Todas las opciones anunciadas se pueden seleccionar y agregan la variante real correcta.
4. Bombones ofrece seis sabores con totales 9/15/24.
5. La tarjeta de barras permite Dubái, Terremoto y Supernova en 120/240 g.
6. Los 18 precios especiales y el 25% del resto se aplican sin acumulación.
7. La entrega disponible es sólo el sábado 10 de octubre de 2026.
8. Al cerrar la campaña desaparecen assets y precios Cyber sin restaurar el catálogo maestro.
9. Todas las pruebas, lint, build y verificaciones visuales pasan sin pedidos ni cobros reales.
