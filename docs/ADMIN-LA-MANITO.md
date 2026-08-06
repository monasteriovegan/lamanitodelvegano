# Manual del Panel Administrativo — La Manito del Vegano

Este documento detalla el funcionamiento, estructura, administración de accesos y configuración del panel de control administrativo de **La Manito del Vegano** (`/admin`).

---

## 1. Módulos del Panel Administrativo

El panel está organizado en base a grupos funcionales visibles en la barra lateral (sidebar):

### 1.1 Inicio (Dashboard)
- **KPIs**: Ventas del período (pedidos pagados), Cantidad de pedidos, Ticket Promedio (ingresos / pedidos pagados), Clientes totales.
- **Distribución**: Tarjetas operativas con el conteo de pedidos en estado: *Pendientes*, *Pagados*, *Despachados*, *Entregados*, *Cancelados* y *WhatsApp*.
- **Pedidos Recientes**: Acceso rápido a las últimas órdenes recibidas.
- **Top Ventas**: Listado interactivo de los productos más vendidos en el período seleccionado.
- **Stock Bajo**: Alertas inmediatas de productos que tengan stock menor o igual a 3 unidades.
- **Filtros por Fecha**: Filtros rápidos en la cabecera: *Hoy*, *Este Mes*, *Este Año* e *Histórico*.

### 1.2 Catálogo
- **Productos**: Listado y creación/edición de catálogo con emojis, precio, precio anterior, control de stock,badges sin gluten/nueces y formatos.
- **Categorías**: Gestión de categorías con emoji y nombre editable.
- **Destacados**: Módulo para configurar cuáles productos aparecen en la sección principal del sitio.

### 1.3 Ventas
- **Pedidos**: Listado completo de órdenes con buscador en vivo (nombre, comuna, ID de pedido, email o teléfono) y filtro por estado operacional.
- **Detalle de Pedido**: Ficha completa del pedido. Incluye desglose financiero, datos de despacho con enlace directo a WhatsApp del cliente, control de estados (Pendiente, Pagado, Despachado, Completado, Cancelado, WhatsApp), seguimiento de courier y bitácora de auditoría histórica.
- **Clientes CRM**: Ficha unificada de clientes que mide sus métricas agregadas. Permite cambiar al cliente de etapa del CRM (Nuevo, Contactado, Interesado, Cliente, VIP, Inactivo, etc.), asociarle etiquetas y redactar notas de seguimiento administrativo.
- **Envíos**: Tarifas y comunas por zonas de reparto.
- **Días de Entrega**: Configuración del calendario de checkout (Margen de anticipación, hora de corte, límites diarios de pedidos, bloqueo de feriados y vacaciones, y previsualización de slots).
- **Métricas**: Gráficos y estadísticas del comportamiento comercial.

### 1.4 Marketing & Sistema
- **Cupones**: Creación y validación de cupones de descuento (porcentaje, fijo, bogo, regalo).
- **Promo Flyer**: Activación del popup especial publicitario de la tienda.
- **Ajustes**: Datos públicos de contacto, redes sociales, horarios y tasas del programa de fidelidad por puntos.
- **Integraciones**: Módulo para guardar credenciales de Flow, Mercado Pago, WhatsApp Cloud API y Resend de forma segura en la base de datos (con bypass en RLS).

---

## 2. Acceso y Roles de Seguridad

El panel está protegido por Supabase Auth en el cliente, y validado en el servidor Next.js a través de `src/proxy.ts` (middleware de autenticación) y la función `requireRole` (control de acceso granular).

### 2.1 Perfiles de Acceso (Roles)
- **Administrador (`admin`)**: Acceso total a todos los módulos, incluyendo integraciones, logística, cupones y roles.
- **Soporte (`soporte`)**: Acceso a Pedidos, Clientes CRM, Cupones e Inicio. No puede modificar ajustes del sistema, pasarelas de pago ni inventarios base de zonas.
- **Bodega (`bodega`)**: Acceso restringido a visualizar y reponer stock de Productos y gestionar Pedidos. No tiene acceso al CRM, métricas financieras ni mercadeo.

### 2.2 Cómo crear un Administrador
Para dar acceso administrativo a un nuevo usuario:
1. Registra al usuario en Supabase Auth (por ejemplo, desde la interfaz pública o el dashboard de Supabase).
2. Obtén el `user_id` (UUID) generado por Supabase.
3. Ejecuta la siguiente consulta SQL en el SQL Editor de tu dashboard de Supabase para asignarle el rol deseado:
```sql
INSERT INTO admin_roles (user_id, rol)
VALUES ('UUID-DEL-USUARIO-AQUI', 'admin') -- Puede ser: admin, soporte, bodega
ON CONFLICT (user_id) DO UPDATE SET rol = EXCLUDED.rol;
```

---

## 3. Guía de Ejecución Local

Para probar e iterar sobre el panel localmente:

1. Instala las dependencias:
   ```bash
   npm install
   ```
2. Crea el archivo de variables de entorno `.env.local` en la raíz del proyecto basándote en `.env.example`:
   ```text
   NEXT_PUBLIC_SUPABASE_URL=https://adrydqvahzqjbgtcvlay.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key-aqui
   SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key-aqui
   ```
3. Ejecuta el servidor de desarrollo local:
   ```bash
   npm run dev
   ```
4. Abre [http://localhost:3000/admin](http://localhost:3000/admin) en tu navegador para iniciar sesión.
