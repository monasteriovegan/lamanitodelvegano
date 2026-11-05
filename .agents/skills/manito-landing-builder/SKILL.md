---
name: manito-landing-builder
description: Diseñar, crear, adaptar, revisar o mejorar landing pages de productos para La Manito del Vegano siguiendo Manito Landing System (MLS). Usar cuando se soliciten nuevas páginas de producto, rediseños, ofertas por compra conjunta, catálogo de complementos, recomendaciones, carrito o envío gratis. No usar para cambios genéricos de backend que no afecten la experiencia de compra.
---

# Manito Landing System (MLS) · v1

Estándar de diseño y conversión para las landings de La Manito del Vegano. La **V6 de bombones** es la referencia funcional inicial; NO es el catálogo ni el motor de promociones de producción.

## Lee antes de construir
- [Sistema visual y experiencia](references/design-system.md).
- [Reglas comerciales y técnicas](references/commerce-rules.md).
- [Modelo de configuración](assets/landing-config.example.json).
- Referencia visual y de interacción: `public/demo/bombones-v6.html` en la rama `demo/bombones-landing-v5-temporal`. Si no está disponible, usa los documentos de esta skill sin inventar su contenido.
- Antes de cambiar Next.js 16, sigue `AGENTS.md` y consulta la documentación local de `node_modules/next/dist/docs/`.

## Flujo obligatorio
1. Identifica **producto real** (ID/SKU, variantes, inventario, fotos, sabores, información verificable), público, mensaje y objetivo de campaña. Lee la fuente de catálogo; jamás infieras precio, ingredientes, stock, opiniones o promociones desde la demo.
2. Parte de **un layout/base reutilizable**. No copies y pegues una landing completa por SKU: componentes compartidos + configuración por producto/campaña.
3. Conserva los invariantes de MLS: identidad visual, hero legible con foto completa, CTA principal claro, selección de variantes, recomendaciones, resumen de ahorro, carrito y reglas de envío.
4. Personaliza las secciones específicas: sabores para bombones, relleno/textura para barras, información nutricional para snacks, formato/uso para cosmética; incluye solo afirmaciones confirmadas.
5. Configura ofertas de forma **declarativa**: complementos automáticos del catálogo y destacados manuales; monto/porcentaje por regla, condiciones, fechas y elegibilidad. Precios y promociones reales se validan en el servidor.
6. Para demo: datos simulados y aviso visible de DEMOSTRACIÓN, sin pagos reales, sin escribir pedidos, `noindex`. Para producción: reutiliza carrito, checkout, stock y tracking existentes sin alterar su integridad.
7. Revisa móvil (360/390/430), escritorio, accesibilidad, teclado, variantes, cambio de cantidad, descuentos acumulados, falta de stock, carrito, zonas de entrega y funcionamiento sin imagen.
8. Entrega resultados verificables: URL de preview o archivo, controles probados, limitaciones, origen de datos y archivos modificados. No afirmar tasa de conversión superior sin experimento.

## Protección
- Nunca desplegar demos ni promociones en `main`/producción sin autorización explícita.
- No modificar precios maestros en Supabase para simular descuentos: calcular y validar beneficios en servidor.
- No repetir cobros, pedidos ni eventos `purchase`; preservar deduplicación Meta Pixel/CAPI y Mercado Pago.
- Sin testimonios falsos, escasez artificial ni precios 'anteriores' que no hayan sido reales.
- Los estilos de la V6 son referencia, no licencia para reemplazar las fotografías originales del catálogo.

## Siguiente nivel
La skill es la **guía para construir**. El futuro **constructor de landings del admin** será una funcionalidad aparte que permitirá operar MLS sin programar cada producto.
