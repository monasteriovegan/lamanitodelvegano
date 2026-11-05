# Manito Landing System (MLS) · Estándar oficial propuesto

**Nombre comercial interno:** Manito Landing System (MLS)  
**Skill Codex:** `manito-landing-builder`  
**Modelo visual inicial:** Landing V6 de bombones (rama `demo/bombones-landing-v5-temporal`, archivo `public/demo/bombones-v6.html`).

## Decisión arquitectónica
Una **única familia de plantillas**, con componentes compartidos y datos del catálogo; cada producto/campaña puede usar una combinación diferente. NO hacer copia manual del HTML V6 por cada producto.

### Siempre
Marca y paleta, fotografía original correctamente encuadrada, encabezado claro, CTA móvil, carrito, selección de variante, descuentos transparentes, recomendaciones, reglas de envío, accesibilidad y seguridad.

### Cambia por producto
Hero, subtítulos, galería, historias de sabores/rellenos, ingredientes, atributos, formatos, paquetes, recomendaciones, temporales, creativos y beneficio de campaña.

## Familias de plantillas sugeridas
- `box-builder`: bombones, cajas mixtas personalizables.
- `single-hero`: Barra Dubái, Explosión de Supernova, manjar.
- `bundle`: packs parrilleros, sets, cajas surtidas.
- `flavors`: alfajores, Protein Balls, brigadeiros.
- `seasonal`: preventas y campañas con fechas, sujeto a disponibilidad.

## Ruta de implementación
1. **Skill de desarrollo (ahora):** guía para Codex y equipo. En `.agents/skills/manito-landing-builder/`.
2. **Componentes compartidos (futuro):** una sola lógica de producto, carrito, complementos y envío.
3. **Constructor de landings (futuro):** sección del admin para gestionar landing/orden/bloques/fotos/promociones sin código.
4. **Motor comercial (futuro):** reglas administrables de ofertas, combinaciones y zonas, calculadas en servidor.
5. **Medición (futuro):** embudo, A/B y valor incremental neto, no solo ventas brutas.

## Ejemplos de activación
- "Usa `$manito-landing-builder` y crea la landing de Barra Dubái siguiendo MLS."
- "Usa `$manito-landing-builder` para adaptar la V6 a las cajas de alfajores y recomendar complementos reales."
- "Revisa esta landing con `$manito-landing-builder`: imágenes, descuentos, envío gratis, móvil y CTA."

## Importante
Esta documentación **no activa automáticamente descuentos ni crea herramientas de admin**. Las promociones siguen siendo demo hasta su implementación y validación de negocio. La skill será descubierta por Codex cuando exista en la rama que tiene abierta y, tras revisión/aprobación, en la rama principal. No fusionar cambios de la rama demo con producción para instalar la skill.
