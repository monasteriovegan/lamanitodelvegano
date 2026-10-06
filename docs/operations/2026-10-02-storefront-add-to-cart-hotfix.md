# Hotfix de selección y carrito público — 2026-10-02

## Incidente

Algunos productos con opciones obligatorias mostraban `Agregar al carrito` deshabilitado en gris. La pantalla no indicaba con claridad qué selección faltaba, por lo que el cliente podía interpretar que el producto no estaba disponible.

El problema afectaba dos flujos:

- selección única obligatoria, por ejemplo la preparación de Seitán;
- reparto obligatorio de unidades entre sabores o toppings, por ejemplo el box de rollitos.

## Causa raíz

El panel iniciaba todas las opciones obligatorias vacías y trasladaba el resultado de la validación directamente al atributo `disabled` del botón. La validación de negocio era correcta, pero la interfaz bloqueaba la acción sin explicar cómo completarla.

## Corrección

- Las opciones obligatorias de selección única comienzan con la primera alternativa seleccionada de forma visible y siguen pudiendo cambiarse.
- Los productos que requieren repartir unidades no inventan una combinación automática: muestran el objetivo, el avance y las unidades que faltan.
- Mientras falten sabores, la acción es amarilla y lleva al área de opciones; ya no aparece como un botón gris sin explicación.
- La validación estricta se conserva antes de agregar al carrito y en checkout.
- La misma lógica se usa en el detalle de producto y en catálogos de campaña.

Productos activos detectados con opciones obligatorias:

- Selección única: `seitan-parrillero`, `le-kostilles`, `pack-parrillero-vegano-1`, `pack-parrillero-vegano-2`.
- Reparto por cantidad: `alfajores-canamo`, `box-rollitos-canela`, `brigadeiros-trufas-surtidos`, `lomo-lyse`, `postres-en-frascos`, `protein-balls`.
- Ambos tipos: `empanada-del-18`.

## Verificación

- Suite completa: 548 pruebas aprobadas, 0 fallidas.
- Pruebas de regresión nuevas: selección única inicial, guía de reparto incompleto y habilitación al alcanzar el total exacto.
- Build Vercel Production: compilación, TypeScript y 67 páginas completadas.
- Despliegue: `dpl_3uBCKPQUmjQetoyEypd4cT55hQLr` (`READY`).
- Alias: `https://lamanitodelvegano.cl`.
- HTTP en `seitan-parrillero` y `box-rollitos-canela`: 200.
- API pública: ambos productos conservan su grupo obligatorio y sus opciones canónicas.
- Verificación visual de producción:
  - Seitán muestra `Seitán mongoliano` seleccionado y el botón verde activo.
  - Box Rollitos muestra `0/6`, instrucciones de reparto y una acción amarilla visible.
- Logs de error de Vercel posteriores al despliegue: ninguno.
- No se creó ningún pedido, pago, mensaje ni compra real durante la prueba.

## Señal de carritos abandonados

La tabla de carritos abandonados no tenía filas para el 2026-10-02 al momento de la auditoría. La analítica del 2026-10-01 sí mostraba vistas de productos configurables sin un `AddToCart` equivalente en varios casos, lo que confirma fricción, pero no permite atribuir todos los abandonos exclusivamente a este defecto.
