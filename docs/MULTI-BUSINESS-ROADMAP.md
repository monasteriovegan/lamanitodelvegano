# Hoja de Ruta: Núcleo Administrativo Multinegocio (Multi-Tenant)

Este documento detalla el diseño y los pasos de desarrollo recomendados para transformar la infraestructura actual de **La Manito del Vegano** y **Makangru** en una plataforma multinegocio centralizada, compartiendo el mismo código y base de datos de manera segura.

---

## 1. Avances Realizados en esta Fase

En la actual migración, ya se sentaron las bases para soportar múltiples negocios:
- **Tabla `businesses`**: Creada para listar las diferentes marcas del ecosistema.
- **Relaciones con `business_id`**: Las tablas `productos`, `pedidos`, `customers`, `delivery_settings` y `blocked_delivery_dates` ya cuentan con la columna `business_id` y claves foráneas enlazadas a `businesses`.
- **Valores por defecto**: Los datos heredados del sitio original se vincularon automáticamente al registro inicial `la-manito-del-vegano`.

---

## 2. Hoja de Ruta de Implementación

### Fase A: Completar la Estructura de Base de Datos
1. **Modelar los Miembros del Negocio**:
   Crear tablas `profiles` y `business_members` para definir qué administradores pertenecen a qué negocios y qué permisos individuales tienen dentro de ellos.
   ```sql
   CREATE TABLE profiles (
     id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
     first_name VARCHAR(100),
     last_name VARCHAR(100),
     created_at TIMESTAMPTZ DEFAULT NOW()
   );

   CREATE TABLE business_members (
     business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
     user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
     role VARCHAR(50) DEFAULT 'viewer' CHECK (role IN ('owner','admin','sales','operations','viewer')),
     PRIMARY KEY (business_id, user_id)
   );
   ```
2. **Migrar las Tablas Restantes**:
   Añadir `business_id` a las tablas que aún son globales:
   - `categorias`
   - `cupones`
   - `zonas`

---

### Fase B: Enrutamiento Dinámico en Next.js (App Router)

Para permitir a los administradores gestionar múltiples marcas, cambiamos la arquitectura de rutas fijas a rutas dinámicas basadas en el slug del negocio.

1. **Estructura de Directorios**:
   Renombrar `src/app/admin/[modulo]` a `src/app/admin/[businessSlug]/[modulo]`.
   - `/admin/pedidos` -> `/admin/la-manito-del-vegano/pedidos`
   - `/admin/clientes` -> `/admin/makangru/clientes`
2. **Contexto de Negocio (`BusinessContext`)**:
   Implementar un hook y un context provider de React a nivel de layout (`/admin/[businessSlug]/layout.tsx`) para:
   - Extraer `businessSlug` desde los params de la ruta.
   - Consultar la información pública del negocio (nombre, logo, colores).
   - Inyectar el `business_id` en todas las llamadas API o Server Actions de forma implícita.

---

### Fase C: Selector de Negocios y UI

1. **Selector en Barra Lateral (Sidebar)**:
   Agregar un componente selector (`select` o dropdown interactivo) en la parte superior del sidebar:
   - Consulta los negocios asociados al usuario logueado en la tabla `business_members`.
   - Redirige al usuario al cambiar la selección: `/admin/[nuevo-slug]/dashboard`.
2. **Pantalla de Bienvenida**:
   Si un usuario tiene acceso a más de un negocio y entra directamente a `/admin`, se le presenta una pantalla limpia para que elija con qué marca desea trabajar antes de cargar el panel principal.

---

### Fase D: Seguridad y Aislamiento de Datos

1. **Políticas RLS por Miembro**:
   Actualizar las políticas RLS para que un usuario solo pueda leer o escribir registros cuyos campos `business_id` correspondan a un negocio en el que el usuario es miembro registrado:
   ```sql
   CREATE POLICY "crm_customers_member_select" ON customers FOR SELECT
     USING (
       EXISTS (
         SELECT 1 FROM business_members
         WHERE business_members.business_id = customers.business_id
           AND business_members.user_id = auth.uid()
       )
     );
   ```
2. **Middleware de Protección Dinámico**:
   El middleware (`src/proxy.ts`) verificará dinámicamente si el usuario logueado tiene membresía activa en el `businessSlug` solicitado en la URL, previniendo el acceso no autorizado entre cuentas corporativas.
