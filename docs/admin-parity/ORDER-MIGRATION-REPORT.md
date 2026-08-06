# Reporte de Migración de Pedidos y Modelo de Datos Canónico

## 1. Contexto y Objetivos

Se ha implementado la migración del modelo de datos de pedidos de La Manito del Vegano para pasar de la estructura monolítica simplificada (`pedidos` con JSON string en `items` y `cliente`) hacia el modelo normalizado canónico (`orders`, `order_items`, `customers`, `order_status_history`).

## 2. Separación Tridimensional de Estados

Se resolvió la ambigüedad anterior separando explícitamente:

### A. Estado Operacional (`status`)
- `pending`: Pendiente de procesar
- `confirmed`: Confirmado / Pago validado
- `processing`: En preparación en taller
- `shipped`: Despachado / En camino
- `delivered`: Entregado al cliente
- `cancelled`: Cancelado

### B. Estado del Pago (`payment_status`)
- `pending`: Pago no registrado
- `paid`: Pago verificado
- `failed`: Pago fallido / rechazado
- `refunded`: Reembolsado
- `partial`: Pago parcial

### C. Canal de Origen (`source`)
- `web`: Tienda online
- `whatsapp`: Vía WhatsApp direct
- `instagram`: Mensaje directo
- `manual`: Ingreso en taller
- `admin`: Panel administrativo

## 3. Mapeo de Registros Existentes

Los registros de la tabla legacy `pedidos` se migraron mediante el script SQL `supabase/migracion-orders-canonicas.sql` siguiendo las reglas:

1. `status = 'Pagado'` → `status = 'confirmed'`, `payment_status = 'paid'`, `source = 'web'`.
2. `status = 'Despachado'` → `status = 'shipped'`, `payment_status = 'paid'`, `source = 'web'`.
3. `status = 'Completado'` → `status = 'delivered'`, `payment_status = 'paid'`, `source = 'web'`.
4. `status = 'Cancelado'` → `status = 'cancelled'`, `payment_status = 'failed'`, `source = 'web'`.
5. `status = 'WhatsApp'` → `status = 'pending'`, `payment_status = 'pending'`, `source = 'whatsapp'`.

## 4. Preservación y Trazabilidad

- El identificador original se conserva en la columna `legacy_order_id`.
- Los ítems del JSON array se extraen y se insertan como filas en `order_items`.
- Los datos de cliente se vinculan o crean en la tabla `customers` unificando historial y CRM.
