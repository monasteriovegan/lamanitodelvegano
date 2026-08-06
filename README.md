# La Manito Del Vegano — v2 (Next.js)

Migración del sitio original (vanilla JS) a Next.js 15, sobre el MISMO proyecto
Supabase que ya usa el sitio viejo en producción (`adrydqvahzqjbgtcvlay`).

⚠️ Importante: esta migración NO usa un Supabase nuevo. Los scripts SQL están
diseñados para AGREGAR seguridad y columnas faltantes sobre las tablas reales
existentes, sin borrar datos ni romper la estructura compartida.

## Setup

1. `npm install`
2. Copiar `.env.example` a `.env.local` y completar con las credenciales del
   proyecto Supabase real (`adrydqvahzqjbgtcvlay` o el que estés usando)
3. En el SQL Editor de Supabase, ejecutar EN ESTE ORDEN:
   - `supabase/migracion-compatible.sql` (agrega columnas/tablas nuevas, no borra nada)
   - `supabase/rls-policies.sql` (activa seguridad real)
4. `npm run dev`

## Variables de entorno requeridas en Vercel

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (⚠️ nunca con prefijo NEXT_PUBLIC_, nunca en el navegador)

Una vez puestas, hay que darle **Redeploy** en Vercel para que el build las tome.

## Primer admin

Después del primer deploy, hay que crear un usuario de Supabase Auth y asignarle
rol de admin manualmente (desde el SQL Editor, con service_role):

```sql
insert into admin_roles (user_id, rol)
values ('UUID_DEL_USUARIO_DE_AUTH', 'admin');
```

El UUID se obtiene desde Authentication > Users en el panel de Supabase, después
de crear el usuario ahí (o de que se registre).

## Fase 2 — WhatsApp, emails transaccionales, carrito abandonado

Agregado sobre la base del admin ya funcional. Antes de que funcione en producción:

1. Ejecutar `supabase/migracion-fase2-whatsapp-email-carrito.sql` en el SQL
   Editor (agrega columnas nuevas, seguro correrlo más de una vez).
2. Configurar el webhook de WhatsApp en Meta for Developers con URL
   `https://[dominio]/api/whatsapp`, y completar Access Token + Phone
   Number ID + Verify Token en `/admin/integraciones`.
3. Verificar un dominio propio en Resend (resend.com) y completar API Key
   + email remitente en `/admin/integraciones`.
4. Agregar `CRON_SECRET` en Vercel → Environment Variables (valor random,
   ej. `openssl rand -hex 32`) para proteger el endpoint del cron.
5. El cron de carrito abandonado (`vercel.json`) está en 1 vez al día —
   es el máximo permitido en el plan Hobby de Vercel. Si el sitio pasa a
   plan Pro, se puede subir a `"0 * * * *"` (cada hora).

Nada de esto se probó contra las APIs reales (Meta, Resend) en el entorno
donde se escribió — sí se verificó que `npm run build` compila limpio
contra este repo. Antes de confiar esto con clientes reales, probar una
compra de punta a punta.

## Fase 3 — Dashboard, Destacados y Promo Flyer

El panel no tenía pantalla de inicio (entrar a `/admin` no mostraba nada
propio) y dos funciones ya existían en la base de datos pero sin pantalla
para editarlas desde el admin — se agregó lo que faltaba:

- **`/admin`** — dashboard con ventas del día, pedidos pendientes, alerta
  de stock bajo, y pedidos recientes.
- **`/admin/destacados`** — vista dedicada para marcar/quitar productos
  destacados (la función ya existía en Productos, esto la separa en su
  propia pantalla).
- **`/admin/promo-flyer`** — pantalla nueva para configurar la promoción
  especial de la portada (antes solo se podía editar directo en Supabase).
- Se corrigió un bug real: guardar "Ajustes generales" borraba en
  silencio los datos de la Promo Especial, porque no los preservaba al
  escribir en la tabla. Ahora todo pasa por `src/lib/ajustes/helpers.ts`,
  que lee y fusiona en vez de sobrescribir.
- Sidebar reorganizado por secciones (Catálogo, Ventas, Marketing,
  Sistema) y un kit de componentes compartido
  (`src/app/admin/_ui/AdminUI.tsx`) con tarjetas de KPI, tarjetas de
  sección y badges — para que el resto del admin se pueda seguir
  construyendo con la misma consistencia visual.

## Fase 4 — Roles con permisos reales

Tu tabla `admin_roles` ya tenía definidos 3 roles (`admin`, `soporte`,
`bodega`) pero el panel no los usaba para nada — cualquiera que entrara
veía absolutamente todo. Ahora sí:

| Sección | admin | soporte | bodega |
|---|---|---|---|
| Inicio | ✅ | ✅ | ✅ |
| Productos | ✅ | — | ✅ |
| Categorías, Destacados | ✅ | — | — |
| Pedidos | ✅ | ✅ | ✅ |
| Envíos, Métricas | ✅ | — | — |
| Cupones | ✅ | ✅ | — |
| Promo Flyer, Ajustes, Integraciones | ✅ | — | — |

El bloqueo es real, no solo visual: si alguien de `soporte` o `bodega`
escribe a mano la URL de una sección que no le corresponde (ej.
`/admin/ajustes`), lo redirige de vuelta al dashboard — no es que el botón
esté oculto nomás. Para asignarle un rol a alguien, se hace directo en la
tabla `admin_roles` de Supabase por ahora (no hay pantalla para eso
todavía).

## Fase 5 — URL propia por producto + Meta Pixel + GA4

Cada producto activo ahora tiene su propia página pública en
`/productos/[slug]` — con título, descripción e imagen reales en las
etiquetas Open Graph (para que un anuncio o un link compartido en
WhatsApp muestre la foto y el nombre del producto, no la portada
genérica). Antes los productos solo se veían en una ventana modal desde
la portada, sin URL propia.

- El `slug` se genera solo desde el nombre al crear un producto, pero se
  puede editar a mano desde el admin (`/admin/productos`) — pensado para
  que la URL que le des a una campaña de ads sea la que tú quieras.
- La tarjeta de producto en la portada ahora enlaza a esa página; el botón
  "+" sigue agregando rápido al carrito igual que antes (no se tocó ese
  flujo).
- **Meta Pixel y Google Analytics 4**: se configuran desde
  `/admin/integraciones` (nueva sección "📈 Analítica y anuncios"), no
  hardcodeados en el código. Quedan estos eventos ya conectados:
  - `PageView` / `page_view` — automático en todas las páginas
  - `ViewContent` / `view_item` — al entrar a la página de un producto
  - `AddToCart` / `add_to_cart` — al agregar al carrito
  - `InitiateCheckout` / `begin_checkout` — al entrar al checkout
  - `Purchase` / `purchase` — al confirmar un pedido pagado (una sola vez
    por pedido, protegido contra duplicados si se recarga la página)

Con esto ya se puede armar una campaña de Meta/Google Ads que aterrice
directo en un producto específico, y además optimizar por conversión real
(no solo clics) una vez que haya datos de compra acumulados.

### Migración pendiente de esta fase

Correr `supabase/migracion-fase5-slug-analytics.sql` — agrega la columna
`slug` a `productos` (con backfill automático desde el nombre para los
productos que ya existen) y las columnas de Meta Pixel / GA4 a
`integraciones_secretas`.

## Fase 6 — Paridad con Makangru: CRM de Clientes, Logs de Pedido, Logística y Slots

Se implementó una paridad funcional avanzada con el sistema Makangru, adaptada completamente a la identidad de La Manito del Vegano:

- **Dashboard Detallado**: Agrega filtros de rango temporal (Hoy, Este Mes, Este Año, Histórico), cálculo de ticket promedio, métricas de ingresos del período, desglose de estados operativos en cuadrícula, productos más vendidos calculados en tiempo real y stock bajo.
- **Gestión Avanzada de Pedidos**: Buscador integrado por ID, nombre, comuna, email o teléfono. Ficha del pedido detallada con desglose de ítems, cálculo financiero de fidelidad, notas del administrador, código de seguimiento courier y bitácora de historial de cambios de estado (`order_status_history`).
- **CRM de Clientes**: Pantalla de clientes registrados con total gastado e histórico de compras. Ficha individual de cliente que permite gestionar la etapa del CRM (Nuevo, Contactado, Interesado, Cliente, VIP, Frecuente, Inactivo, Perdido), notas de contacto históricas, asignación de etiquetas personalizadas y visualización de un log de actividades en tiempo real.
- **Logística & Días de Entrega**: Configurador dinámico de días hábiles, tiempo mínimo de anticipación, hora de corte, límite de pedidos diarios y bloqueos excepcionales (feriados o vacaciones). Incluye vista previa del checkout en tiempo real.

### Documentación Adicional

Se agregaron guías técnicas detalladas en el directorio `docs/`:
- [Manual del Panel Administrativo](file:///C:/Users/usuario/.gemini/antigravity/scratch/lamanitodelvegano/docs/ADMIN-LA-MANITO.md): Guía de módulos y cómo registrar usuarios administradores.
- [Arquitectura de Base de Datos](file:///C:/Users/usuario/.gemini/antigravity/scratch/lamanitodelvegano/docs/DATABASE.md): Definición detallada de tablas del CRM, logística, logs y seguridad RLS.
- [Guía de Despliegue](file:///C:/Users/usuario/.gemini/antigravity/scratch/lamanitodelvegano/docs/DEPLOYMENT.md): Instrucciones para publicar en Vercel, ejecutar el script de migración SQL, configurar cron jobs y vincular webhooks.
- [Roadmap Multinegocio](file:///C:/Users/usuario/.gemini/antigravity/scratch/lamanitodelvegano/docs/MULTI-BUSINESS-ROADMAP.md): Hoja de ruta técnica para migrar el panel administrativo actual hacia un SaaS multitenant.

## Verificación

`npx tsc --noEmit` y `npm run build` corridos limpio (0 errores, 31 rutas) antes de cada entrega.
