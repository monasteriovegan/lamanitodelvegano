# Matriz de Paridad de Rutas Administrativas (Makangru vs La Manito del Vegano)

| ID | Módulo | Ruta Makangru | Ruta La Manito | Capacidad | Estado |
|---|---|---|---|---|---|
| R01 | Dashboard | `/admin` | `/admin` | Resumen de ventas, pedidos pendientes, alertas de stock, reservas | COMPLETO |
| R02 | Pedidos List | `/admin/pedidos` | `/admin/pedidos` | Tabla operativa, tabs con contadores por estado, búsqueda multi-campo | COMPLETO |
| R03 | Pedidos Detail | `/admin/pedidos/[id]` | `/admin/pedidos/[id]` | Stepper de progreso, confirmación de transferencia, impresión, tracking | COMPLETO |
| R04 | Productos List | `/admin/productos` | `/admin/productos` | Filtros, alertas de stock, activar/desactivar, reordenar | COMPLETO |
| R05 | Productos Crear | `/admin/productos/nuevo` | `/admin/productos/nuevo` | Formulario completo con SKU, precios, historia, ingredientes, alérgenos | COMPLETO |
| R06 | Productos Editar | `/admin/productos/[id]` | `/admin/productos/[id]` | Edición de variaciones, imágenes múltiples, SEO | COMPLETO |
| R07 | Destacados | `/admin/destacados` | `/admin/destacados` | Gestión de is_featured e is_new | COMPLETO |
| R08 | Categorías | `/admin/categorias` | `/admin/categorias` | CRUD de categorías con slug e ícono | COMPLETO |
| R09 | Clientes CRM | `/admin/clientes` | `/admin/clientes` | Directorio de clientes con métricas RFM, etapas y etiquetas | COMPLETO |
| R10 | Ficha Cliente | `/admin/clientes/[id]` | `/admin/clientes/[id]` | Historial de compras, notas y estado VIP | COMPLETO |
| R11 | Cupones | `/admin/cupones` | `/admin/cupones` | Cupones por porcentaje, monto fijo o envío gratis | COMPLETO |
| R12 | Envíos | `/admin/envios` | `/admin/zonas` | Zonas logísticas y umbrales de despacho gratis | COMPLETO |
| R13 | Entregas | `/admin/entregas` | `/admin/entregas` | Días de reparto, días de anticipación y fechas bloqueadas | COMPLETO |
| R14 | Ingredientes | `/admin/ingredientes` | `/admin/ingredientes` | CRUD insumos, alérgenos, costos unitarios y tabla nutricional | COMPLETO |
| R15 | Recetas | `/admin/recetas` | `/admin/recetas` | Costeo de recetas en tiempo real con mano de obra y margen | COMPLETO |
| R16 | Reservas | `/admin/reservas` | `/admin/reservas` | Retiros en taller, slots horarios y notas de equipo | COMPLETO |
| R17 | Temporadas | `/admin/temporadas` | `/admin/temporadas` | Menús estacionales, banners y menús temáticos | COMPLETO |
| R18 | Blog List | `/admin/blog` | `/admin/blog` | Listado de posts del taller con estado borrador/publicado | COMPLETO |
| R19 | Blog Crear | `/admin/blog/nuevo` | `/admin/blog/nuevo` | Editor de posts, tiempo de lectura y SEO | COMPLETO |
| R20 | Blog Editar | `/admin/blog/[id]` | `/admin/blog/[id]` | Edición de contenido y portada | COMPLETO |
| R21 | Mensajes | `/admin/mensajes` | `/admin/mensajes` | Inbox de mensajes de contacto y botón directo a WhatsApp | COMPLETO |
| R22 | Métricas | `/admin/metricas` | `/admin/metricas` | KPIs de conversión, ingresos mensuales, ranking de productos | COMPLETO |
| R23 | Ajustes | `/admin/ajustes` | `/admin/ajustes` | Identidad, datos bancarios, redes y banners | COMPLETO |
| R24 | Integraciones | N/A | `/admin/integraciones` | Píxeles Meta, WhatsApp Gateway, Webhooks (Propio de La Manito) | COMPLETO |
| R25 | Promo Flyer | N/A | `/admin/promo-flyer` | Generador de flyers promocionales (Propio de La Manito) | COMPLETO |

**Cobertura de Rutas: 100%**
