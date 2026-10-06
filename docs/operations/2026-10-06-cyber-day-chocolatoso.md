# Cyber Day Chocolatoso — octubre 2026

Implementado en rama; **no aplicado en producción**. Base: `5325517`.

| Oferta | Normal CLP | Cyber CLP |
|---|---:|---:|
| Dúo 2 barras 120 g, Dubái/Supernova combinables | 21.800 | 17.900 |
| XL 240 g, Dubái/Terremoto/Supernova | 22.900 | 17.900 |
| Bombones, Protein Balls, trufas: 9 unidades | 11.900 | 9.900 |
| Bombones, Protein Balls, trufas: 15 unidades | 19.900 | 14.900 |
| Bombones, Protein Balls, trufas: 24 unidades | 23.900 | 17.900 |
| Alfajores de cáñamo pack 4 | 11.900 | 8.900 |
| Box Chocolatosa con barra 80 g | Sin anterior anunciado | 21.900 |

Barra individual 120 g: $10.900. Box: barra 80 g a elección, 3 alfajores, 3 bombones, 3 trufas, barrita proteica de cáñamo y bolsita de chocolate en rama 30 g. Flyer de 9 bombones conserva un error «antes $19.900»; el usuario confirmó anteriormente $11.900. El flyer final adjunto se conserva sin editar y los precios estructurados usan el monto confirmado.

Cierre elegido por el usuario: **viernes 9 octubre 23:59, America/Santiago**. Entrega: **sábado 10 octubre 2026**. Los formatos restantes reciben 25% sobre precio maestro vigente, sin acumularlo sobre ofertas explícitas. La temporada activa en BD determina precios; el campaignTag del cliente no decide descuentos. Al vencer/desactivar la temporada vuelven valores normales.

## Implementación

- Banner home y ruta `/cyber-day-chocolatoso-2026`, nueve destacados Cyber y resto del catálogo con 25%.
- Siete flyers WebP, completos en tarjetas de campaña, precios anteriores visibles.
- Migración transaccional e idempotente `supabase/migrations/20261006013933_cyber_day_chocolatoso_2026.sql`. Reutiliza productos/variantes, agrega Terremoto/dúo/Box, crea temporada y 18 overrides. Valida seis productos y catorce SKUs antes de cambiar datos.
- Supernova actualiza presentación 110/230 a 120/240 g conservando IDs/SKUs históricos.
- Regla compartida para catálogo, API, fichas y cálculo del servidor, incluyendo formatos antiguos válidos. Formatos obsoletos requieren actualizar carrito.
- Checkout fija 10 octubre durante Cyber y conserva fechas bloqueadas. No reabre productos agotados.
- Rutas de campañas anteriores redirigen al Cyber mientras esté activo. Home oculta la promoción vieja durante Cyber.
- Sin cambios a pedidos, pagos, estado Remy, mensajería o configuración Pixel/CAPI.

## Verificación

- `npm test`: 531 tests pasan, incluyendo PostgreSQL local PGlite, migración doble sin duplicados, abortado atómico por SKU ausente, combinación requerida de dos barras y recálculo ignorando precio manipulado del cliente.
- `npx tsc --noEmit`: pasa.
- Build Next.js pasa con configuración ficticia local. Sin variables falla por la protección existente de configuración Supabase, que se conserva.
- ESLint de página/componentes Cyber y regla de precios pasa. CatalogRepository conserva un `any` previo.
- Revisión independiente sin hallazgos importantes pendientes.
- Catálogo productivo consultado sólo en lectura. No se crearon pedidos/cobros/Purchase para probar.
- Navegador automatizado no disponible: agent-browser no inicia; descarga de Chromium falló. No se afirma validación visual ni E2E productivo.

## Aplicación pendiente

1. Obtener acceso autorizado a PostgreSQL del Supabase **self-hosted** y respaldar tablas de catálogo afectadas; no usar el proyecto gestionado antiguo.
2. Confirmar catálogo actual y aplicar la migración completa como una transacción.
3. Verificar 18 overrides, nueve destacados Cyber y cierre viernes 9.
4. Desplegar el commit del PR en Vercel `lamanitodelvegano`, dominio `lamanitodelvegano.cl`.
5. Verificar home, rutas antiguas, página Cyber, formatos 120/240, dúo, alfajores, Box, carrito mixto y única fecha 10 octubre. Revisar visualmente escritorio/móvil antes de publicar. Un pedido real requiere autorización específica.

Desactivar temporada Cyber revierte descuentos. Los precios normales acordados permanecen en el maestro. Para rollback completo usar respaldo de catálogo y rollback del deployment; no generar un SQL inverso con valores supuestos.
