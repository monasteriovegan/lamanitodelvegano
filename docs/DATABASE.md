# Arquitectura y Diseño de la Base de Datos

Este documento describe la estructura, relaciones, políticas RLS y triggers de la base de datos de **La Manito del Vegano**, hospedada en Supabase (PostgreSQL).

---

## 1. Esquema de Tablas

### 1.1 Multinegocio y Organización

#### `businesses`
Representa las marcas o negocios del sistema. Inicialmente, contiene un registro para La Manito del Vegano.
- `id` (UUID, PK): Identificador único.
- `slug` (VARCHAR, Unique): Slug único del negocio (ej: `la-manito-del-vegano`).
- `name` (VARCHAR): Nombre comercial del negocio.
- `created_at` (TIMESTAMPTZ): Marca de tiempo de creación.

---

### 1.2 CRM & Clientes

#### `customers`
Contiene la información de los clientes unificada a nivel de negocio para el CRM.
- `id` (UUID, PK): Identificador del cliente.
- `business_id` (UUID, FK -> `businesses.id`): Negocio al que pertenece.
- `email` (VARCHAR): Correo electrónico del cliente.
- `phone` (VARCHAR): Teléfono de contacto.
- `nombre` (VARCHAR): Nombre del cliente.
- `direccion` (TEXT): Dirección de despacho por defecto.
- `crm_status` (VARCHAR): Etapa en el CRM (`new`, `contacted`, `interested`, `order_started`, `payment_pending`, `customer`, `follow_up`, `repeat_customer`, `inactive`, `lost`).
- `total_spent` (DECIMAL): Suma acumulada de compras exitosas.
- `total_orders` (INTEGER): Número total de pedidos realizados.
- `created_at` (TIMESTAMPTZ): Fecha de registro en el sistema.
- `updated_at` (TIMESTAMPTZ): Última actualización de datos.
*Índices Únicos*:
- Único por combinación de `business_id` + `email` (donde email no es nulo).
- Único por combinación de `business_id` + `phone` (donde phone no es nulo).

#### `customer_notes`
Notas internas ingresadas por los administradores sobre el seguimiento de un cliente.
- `id` (UUID, PK): Identificador de la nota.
- `customer_id` (UUID, FK -> `customers.id` ON DELETE CASCADE).
- `content` (TEXT): Contenido de la nota.
- `created_by` (UUID, FK -> `auth.users.id` ON DELETE SET NULL).
- `created_at` (TIMESTAMPTZ): Fecha de creación.

#### `customer_tags`
Etiquetas disponibles a nivel de negocio.
- `id` (UUID, PK): Identificador de la etiqueta.
- `business_id` (UUID, FK -> `businesses.id`).
- `name` (VARCHAR): Nombre de la etiqueta (ej: `VIP`, `Sin Gluten`).
- `color` (VARCHAR): Color hexadecimar para UI.

#### `customer_tag_assignments`
Relación N:M que asocia etiquetas a clientes.
- `customer_id` (UUID, PK, FK -> `customers.id` ON DELETE CASCADE).
- `tag_id` (UUID, PK, FK -> `customer_tags.id` ON DELETE CASCADE).

#### `crm_activities`
Log cronológico de todas las interacciones del CRM sobre el cliente.
- `id` (UUID, PK): Identificador del registro.
- `customer_id` (UUID, FK -> `customers.id` ON DELETE CASCADE).
- `type` (VARCHAR): Tipo de actividad (`status_change`, `note_added`, `order_created`, `tag_added`, etc.).
- `description` (TEXT): Detalle o glosa de la actividad.
- `created_by` (UUID, FK -> `auth.users.id`).
- `created_at` (TIMESTAMPTZ): Fecha de registro.

---

### 1.3 Ventas y Pedidos

#### `pedidos` (Existente, ampliada)
Almacena los pedidos y cobros realizados.
- `id` (TEXT, PK): Identificador único (consecutivo o alfanumérico).
- `business_id` (UUID, FK -> `businesses.id`): Negocio.
- `customer_id` (UUID, FK -> `customers.id`): Cliente CRM asociado.
- `cliente` (JSONB): Datos estáticos del cliente en el momento de la compra (nombre, dirección, email, teléfono).
- `items` (JSONB): Desglose del carrito (`productoId`, `nombre`, `precio`, `qty`, `formato`, `variedad`).
- `total` (NUMERIC): Monto total cobrado.
- `descuentoFidelidad` (NUMERIC): Descuento canjeado por puntos.
- `puntosCanjeados` (INTEGER): Puntos restados.
- `puntosGanados` (INTEGER): Puntos acumulados en la compra.
- `status` (VARCHAR): Estado operacional (`Pendiente`, `Pagado`, `Despachado`, `Completado`, `Cancelado`, `WhatsApp`).
- `zonaEnvio` (VARCHAR): Nombre de la zona de despacho.
- `costoEnvio` (NUMERIC): Costo de envío cobrado.
- `metodoPago` (VARCHAR): Medio de pago (`flow`, `mercadopago`, `whatsapp`).
- `admin_notes` (TEXT): Notas administrativas de seguimiento.
- `tracking_number` (VARCHAR): Código de seguimiento del courier.
- `createdAt` (TIMESTAMPTZ): Fecha de creación del pedido.

#### `order_status_history`
Registro cronológico de los cambios de estado operacional de un pedido.
- `id` (UUID, PK): Identificador único.
- `pedido_id` (TEXT): ID del pedido.
- `old_status` (VARCHAR): Estado anterior.
- `new_status` (VARCHAR): Estado nuevo.
- `changed_by` (UUID, FK -> `auth.users.id`): Usuario que realizó el cambio.
- `changed_at` (TIMESTAMPTZ): Fecha y hora del cambio.
- `notes` (TEXT): Motivo o contexto del cambio.

---

### 1.4 Logística & Fechas de Entrega

#### `delivery_settings`
Configuraciones globales del calendario de entregas por negocio.
- `id` (UUID, PK): Identificador de la fila.
- `business_id` (UUID, Unique, FK -> `businesses.id`): Negocio asociado.
- `enabled_weekdays` (INTEGER[]): Array de días permitidos (0 = Domingo, 1 = Lunes, etc.).
- `min_advance_days` (INTEGER): Días mínimos de anticipación requeridos.
- `max_advance_days` (INTEGER): Ventana máxima de días futuros para programar.
- `cutoff_hour` (INTEGER): Hora de corte diaria para sumarle +1 día de anticipación.
- `delivery_message` (TEXT): Mensaje informativo para desplegar en el calendario.
- `max_orders_per_day` (INTEGER): Límite diario de pedidos (0 para ilimitados).
- `updated_at` (TIMESTAMPTZ): Fecha de actualización.

#### `blocked_delivery_dates`
Fechas bloqueadas de forma excepcional en el calendario (feriados, cierres de cocina).
- `id` (UUID, PK): Identificador de la fecha bloqueada.
- `business_id` (UUID, FK -> `businesses.id`).
- `date` (DATE): Fecha a bloquear en el calendario.
- `reason` (VARCHAR): Razón o motivo del bloqueo (ej: "Año Nuevo").
- `created_at` (TIMESTAMPTZ): Fecha de creación.
*Índices Únicos*:
- Único por combinación de `business_id` + `date`.

---

## 2. Políticas de Seguridad (RLS)

Todas las tablas operacionales tienen Row Level Security (RLS) habilitado para garantizar la seguridad en producción.

### 2.1 Principios Generales
- **Lectura Pública**: Tablas como `productos`, `categorias`, `zonas`, `businesses`, `delivery_settings` y `blocked_delivery_dates` permiten la lectura de usuarios anónimos (`anon`) para que el sitio público funcione sin credenciales.
- **Acceso Administrativo**: Todo el acceso de escritura, creación, actualización y eliminación de configuraciones, CRM y pedidos está estrictamente restringido a usuarios autenticados con un rol permitido en la tabla `admin_roles`.
- **Bypass en Backend**: Las operaciones de checkout y sincronización ocurren del lado del servidor (Next.js Server Actions / API Routes) utilizando `service_role` (bypass completo de RLS), validando internamente los datos para que el usuario no pueda manipular precios ni estados directamente.

### 2.2 Función Helper de Roles
La verificación de rol se realiza en la base de datos mediante la función `is_admin()`:
```sql
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_roles WHERE user_id = auth.uid()
  );
$$;
```
Las políticas aplican `is_admin()` en los bloques de verificación (`USING` y `WITH CHECK`) para todas las operaciones administrativas.

---

## 3. Sincronización Inicial de Clientes

Para migrar los clientes existentes dentro de `pedidos.cliente` a la tabla estructurada `customers` del CRM de manera limpia, se definió y ejecutó el procedimiento `sync_customers_from_pedidos()` que realiza lo siguiente:
1. Recorre cada fila de la tabla `pedidos`.
2. Extrae las claves `email`, `phone`, `nombre` y `direccion` desde la columna JSONB `cliente`.
3. Valida y unifica coincidencias por email o teléfono para evitar duplicar fichas de clientes recurrentes.
4. Rellena las columnas agregadas `total_spent` y `total_orders`.
5. Actualiza la columna `pedidos.customer_id` vinculando el pedido de forma definitiva con el ID estructurado del cliente en el CRM.
