# Matriz de Paridad de Acciones Administrativas (Makangru vs La Manito del Vegano)

| ID | Módulo | Acción Makangru | Acción La Manito | Descripción | Estado |
|---|---|---|---|---|---|
| A01 | Pedidos | Confirmar Pago Transferencia | Confirmar Pago Transferencia | Actualiza `payment_status` a `paid` y registra `paid_at = NOW()` | COMPLETO |
| A02 | Pedidos | Cambiar Estado Operacional | Cambiar Estado Operacional | Modifica stepper (`pending` -> `confirmed` -> `processing` -> `shipped` -> `delivered`) | COMPLETO |
| A03 | Pedidos | Guardar Tracking | Guardar Tracking | Guarda número de seguimiento y fecha `shipped_at` | COMPLETO |
| A04 | Pedidos | Guardar Notas Internas | Guardar Notas Internas | Registra anotaciones visibles solo para el equipo | COMPLETO |
| A05 | Pedidos | Imprimir Orden | Imprimir Orden | Genera documento imprimible con branding de La Manito | COMPLETO |
| A06 | Pedidos | Contactar WhatsApp | Contactar WhatsApp | Abre chat directo de WhatsApp con mensaje personalizado | COMPLETO |
| A07 | Pedidos | Enviar Email | Enviar Email | Abre cliente de correo con asunto preconfigurado | COMPLETO |
| A08 | Productos | Crear/Editar Producto | Crear/Editar Producto | Administra SKU, precios, stock, alérgenos e historia | COMPLETO |
| A09 | Productos | Subir Imágenes | Subir Imágenes | Permite carga múltiple de imágenes de producto | COMPLETO |
| A10 | Clientes | Actualizar Ficha CRM | Actualizar Ficha CRM | Modifica etapa de venta, notas de seguimiento y etiquetas | COMPLETO |
| A11 | Cupones | Crear/Desactivar Cupón | Crear/Desactivar Cupón | Gestiona reglas de descuento en checkout | COMPLETO |
| A12 | Entregas | Bloquear Fechas | Bloquear Fechas | Agrega excepciones de días de despacho | COMPLETO |
| A13 | Ingredientes | Calcular Costo | Calcular Costo | Actualiza costos de insumos por gramo/unidad | COMPLETO |
| A14 | Recetas | Calcular Margen Neto | Calcular Margen Neto | Modifica mano de obra y costos generales | COMPLETO |
| A15 | Reservas | Confirmar Retiro | Confirmar Retiro | Cambia estado de slot de retiro en taller | COMPLETO |
| A16 | Temporadas | Publicar Menú | Publicar Menú | Activa banner y badge estacional | COMPLETO |
| A17 | Blog | Publicar/Borrador Post | Publicar/Borrador Post | Controla visibilidad pública de artículos del taller | COMPLETO |
| A18 | Mensajes | Marcar como Leído | Marcar como Leído | Procesa entradas de bandeja de contacto | COMPLETO |
| A19 | Ajustes | Guardar Ajustes Parcial | Guardar Ajustes Parcial | Actualiza `site_settings` aisladamente sin sobreescrituras | COMPLETO |

**Cobertura de Acciones: 100%**
