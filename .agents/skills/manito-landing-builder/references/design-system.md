# Manito Landing System (MLS) · Diseño y experiencia v1

**Objetivo:** páginas de producto de alta claridad comercial, coherentes con La Manito del Vegano, sin convertir todo el sitio en una copia exacta de la misma landing.

## Referencia e identidad
- Prototipo base: V6 de Bombones `public/demo/bombones-v6.html` en la rama `demo/bombones-landing-v5-temporal`.
- Paleta aproximada tomada de la V6: verde bosque `#173f31`, verde profundo `#102e25`, crema `#faf8f2`, papel `#fffcf7`, dorado `#b48a52`, verde menta `#e7efe3`, texto `#282b26`, bordes `#e7e5db`.
- Tipografía: títulos estilo `Playfair Display` (fallback Georgia), cuerpo `DM Sans` (fallback system-ui). Mantener contraste y legibilidad, no depender de fuentes remotas.
- Fotografías de producto **auténticas**, grandes y sin corte abrupto: hero con `object-fit: contain`, relación proporcional al archivo; planos de detalle opcionales. No reemplazar imágenes reales por IA. Si una variante tiene fotografía real, mostrar la variante correcta.
- Tarjetas con bordes suaves, fondo claro, respiración y jerarquía visual. Evitar banners y contadores agresivos.

## Estructura base (orden adaptable)
1. Banner superior pequeño de confianza / beneficio de envío realmente vigente.
2. Encabezado de marca y acceso a carrito; botón de compra visible en móvil sin tapar controles.
3. Hero: foto completa, título específico y propuesta de valor verificable, precio/variantes, CTA principal.
4. Beneficios y detalles de producto: composición, tamaños, contenido del pack y condiciones aplicables.
5. Bloques de prueba visual: fotos de sabores/rellenos, videos propios, descripción de la experiencia.
6. Configurador de cantidad, caja o variante. Selecciones claras y feedback inmediato.
7. Complementos destacados con precios normales/promocionales y condiciones expresas.
8. CTA "Ver todos los productos" abre catálogo tipo drawer/modal **sin abandonar la landing**.
9. Estado de envío: progreso hasta umbral **o** estado ya desbloqueado; mostrar producto habilitador cuando corresponda.
10. Resumen de compra: subtotales, descuentos, ahorro visible, elegibilidad y carrito.
11. Preguntas frecuentes, entrega/cobertura, seguridad de pago y cierre sin afirmaciones falsas.

## Módulos reusables
- `ProductHero`
- `VariantSelector` o `BuildYourBox`
- `ProductStory` / `FlavorGrid` / `Ingredients`
- `CrossSellShelf` y `CatalogDrawer`
- `PromotionBadge`, `SavingsSummary` y `ShippingProgress`
- `CartDrawer`, `StickyPurchaseCTA`, `FAQ`

**No son nombres de componentes ya existentes**: son nombres sugeridos para una futura implementación. Verifica el código primero.

## Variantes de composición por producto
| Producto | Componentes protagonistas |
|---|---|
| Bombones | Caja configurable, seis sabores reales, selector por cantidad |
| Barra Dubái | Fotografía grande del corte y capas, gramaje, packs |
| Alfajores de cáñamo | Rellenos, ingredientes, caja individual/packs si existen |
| Protein Balls | Sabores, nutrición real verificada, formato |
| Empanadas | Sabores, cantidad, fecha/zona de entrega |
| Pack parrillero | Contenido exacto, unidades, conservación, preparaciones |

Conserva color, navegación, lógica y estilo; varía hero, orden de bloques, acentos y fotografías para evitar páginas repetitivas.

## Estándar móvil
- Revisar anchos 360, 390 y 430 px; después tablet y escritorio.
- Sin scroll horizontal, texto cortado, imágenes recortadas ni superposición del carrito con CTA fijo.
- Drawer con altura y scroll propios, cierre visible y foco accesible.
- Botones suficientemente grandes; estados de carga, error y sin stock visibles.
- Revisar que la elección de sabores y cantidades persista al abrir/cerrar el catálogo.

## Medición
Instrumentar eventos diferenciados: `view_item`, `select_variant`, `add_to_cart`, `view_cart`, `begin_checkout`, `purchase` (solo pagos reales). Medir conversión, ticket promedio, attach rate, margen postdescuento y costo de envío. Hacer A/B si existe tráfico comparable.

## Revisión final
Aprobar coherencia con V6, fidelidad del catálogo, utilidad real de las recomendaciones, claridad de oferta y ausencia de falsas promesas. Si algo falta, declarar el dato pendiente en lugar de inventarlo.
