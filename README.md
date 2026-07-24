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
todavía — decir si conviene agregarla).

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
- Se corrigió un bug real: guardar "Ajustes generales" borraba en silencio
  los datos de la Promo Especial, porque no los preservaba al escribir en
  la tabla. Ahora todo pasa por `src/lib/ajustes/helpers.ts`, que lee y
  fusiona en vez de sobrescribir.
- Sidebar reorganizado por secciones (Catálogo, Ventas, Marketing,
  Sistema) y un kit de componentes compartido (`src/app/admin/_ui/AdminUI.tsx`)
  con tarjetas de KPI, tarjetas de sección y badges — para que el resto
  del admin se pueda seguir construyendo con la misma consistencia visual.
