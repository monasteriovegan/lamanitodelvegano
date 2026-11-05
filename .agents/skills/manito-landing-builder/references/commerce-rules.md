# MLS · Reglas de catálogo, promociones y envío v1

## Fuentes y estados
- **Producción:** leer productos, SKU, variantes, imágenes, precios, disponibilidad y reglas activas desde fuentes autorizadas de La Manito. El backend recalcula SIEMPRE subtotal, descuentos, impuestos si aplican, envío y total; el cliente nunca determina el precio a cobrar.
- **Demo:** usar datos claramente identificados como simulados. Nunca realizar cobros, reservas de stock ni escrituras de pedidos.
- No reutilizar datos de afiches con precios de campañas anteriores como precios actuales.

## Cross-sell y catálogo
- Mostrar inicialmente 3–4 recomendaciones contextualizadas; permitir "Ver todos los productos" con buscador, filtros, fotografía, precio, estado de stock, promo y acción de añadir.
- Catálogo dinámico: permitir orden por afinidad, disponibilidad, temporada, margen permitido, popularidad basada en datos y override manual desde admin. Eliminar de las recomendaciones productos agotados o no elegibles.
- Mantener selección principal, cantidades y complementos al abrir/cerrar el drawer. Evitar duplicar líneas; si se agrega dos veces, incrementar cantidad según límites.
- Precios promocionales: mostrar **valor anterior tachado** solo si es precio normal real vigente para el SKU, **nuevo precio**, **ahorro** y condición "Exclusivo por compra conjunta" cuando corresponda.
- Si desaparece el producto principal que activa oferta, quitar el beneficio y avisar antes de finalizar.
- Definir reglas explícitas de combinación: descuento SKU + escalonado + envío; priorizar evitar duplicidad y vender bajo costo. Límites de unidades, presupuesto, fechas y zonas desde admin.

## Envío gratis
El umbral inicial propuesto es **CLP 50.000**; debe ser editable en admin, no codificado en componentes.

Modalidades:
1. `threshold`: subtotal de productos elegibles **después de descuentos** >= umbral, sujeto a cobertura y método.
2. `trigger_whole_cart`: un producto elegible, presente y con cantidad válida, libera despacho del pedido completo en zonas y servicios configurados. Agregar complementos mantiene el envío gratis mientras persista ese producto y se cumplan condiciones.
3. `trigger_item_only`: el costo correspondiente al artículo elegible queda cubierto, no implica envío gratis para el resto; presupuestar costo del pedido según política logística real.
4. `manual_override`: operador autorizado puede aplicar una excepción con motivo, alcance, fechas y auditoría.

UX:
- Si aún falta para la meta: mostrar **cuánto falta** y progreso; sugerir artículos que realmente permitan llegar al umbral.
- Si el envío ya está desbloqueado por monto o promoción: **no presentar la barra como deuda pendiente**; mostrar "¡Ya tienes envío gratis!" e invitar a agregar otros productos.
- Si es gratis solo para una línea: "Envío de [producto] incluido; otros productos pueden cambiar el costo final".
- Siempre condicionar a comuna, cobertura, disponibilidad, peso/volumen, método de entrega y cualquier máximo configurado. Confirmar en checkout tras dirección.

## Configuración editable en administrador (futuro desarrollo, NO actual)
- Habilitar/deshabilitar landing y módulos por campaña.
- Elegir SKU principal y SKU complementarios; excluir algunos, fijar orden, condiciones y stock mínimo.
- Precios promocionales por monto o porcentaje, escalones por número de complementos y tope de descuento total.
- Umbral, zonas, tipo de envío, productos habilitadores, prioridad de reglas, fechas, uso máximo.
- Edición/preview seguro, control de publicación, historial y registro de operadores.
- Métricas de conversión, AOV, tasa de complementos, margen y costo de envío.

## Seguridad y pruebas mínimas
- Verificar precios nuevamente del lado servidor al ir a pagar. No confiar en `localStorage`, query params ni JS del navegador.
- Pago Mercado Pago con idempotencia, pedido único y stock coherente; no romper webhook ni deduplicación Pixel/CAPI.
- Probar quitar producto habilitador, bajar de umbral, cambiar comuna, producto agotado, promo caducada, 2 promociones incompatibles, redondeos CLP y oferta manual.
- Marcar contenido nutricional/cosmético con cuidado: solo propiedades respaldadas y autorizadas; no atribuir efectos médicos.
