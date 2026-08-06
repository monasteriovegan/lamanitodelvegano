# Guía de Despliegue en Vercel & Supabase

Este documento detalla el procedimiento para configurar, migrar y desplegar la versión con CRM y Logística de **La Manito del Vegano** en **Vercel** y **Supabase**.

---

## 1. Configuración de Base de Datos (Supabase)

Antes de desplegar en Vercel, la base de datos debe tener el esquema correcto:

1. Ve a tu **Supabase Dashboard** -> selecciona tu proyecto.
2. Haz clic en **SQL Editor** -> **New Query**.
3. Copia y pega el contenido del archivo [supabase/migracion-crm-logistica.sql](file:///C:/Users/usuario/.gemini/antigravity/scratch/lamanitodelvegano/supabase/migracion-crm-logistica.sql).
4. Haz clic en **Run** para aplicar las modificaciones.
5. *(Opcional)* Verifica que las tablas `businesses`, `customers`, `delivery_settings`, `blocked_delivery_dates` y `order_status_history` aparezcan en el Table Editor de Supabase.

---

## 2. Variables de Entorno en Vercel

En tu proyecto de Vercel, debes configurar las siguientes variables de entorno para todos los entornos (Production, Preview, Development):

| Variable | Tipo | Descripción |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Público (Browser) | URL REST del proyecto Supabase (ej: `https://adrydqvahzqjbgtcvlay.supabase.co`). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Público (Browser) | API Key pública anon del proyecto. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secreto (Server)** | API Key `service_role` privada para bypass de RLS. **NUNCA la expongas en el cliente.** |

---

## 3. Despliegue de la Aplicación

Para desplegar en Vercel desde GitHub:

1. Realiza el push de los cambios en la rama `feature/admin-makangru-parity` a GitHub.
2. Crea un **Pull Request (PR)** hacia la rama `main`.
3. Vercel creará un despliegue **Preview** de forma automática.
4. Prueba y valida las rutas del admin en la URL Preview de Vercel.
5. Aprueba e integra (Merge) el PR a `main` para disparar el despliegue automático de **Production**.

---

## 4. Tareas Programadas (Cron Jobs)

Vercel procesa las tareas programadas configuradas en `vercel.json`:
- El archivo `vercel.json` define el cron job en la ruta `/api/cron/carritos-abandonados` con la programación `"0 13 * * *"` (todos los días a las 13:00 UTC).
- En Vercel Dashboard -> selecciona tu proyecto -> ve a la pestaña **Settings** -> **Cron Jobs** para verificar su estado de ejecución.

---

## 5. Integración del Webhook de WhatsApp (Meta)

Para habilitar las respuestas automatizadas del bot a través de WhatsApp Cloud API:

1. Ve a la consola de **Meta for Developers** -> selecciona tu aplicación de WhatsApp Business.
2. En la barra lateral izquierda, ve a **WhatsApp** -> **Configuration**.
3. En **Callback URL**, escribe tu dominio seguro con la ruta del endpoint:
   `https://tu-dominio.cl/api/whatsapp`
4. En **Verify Token**, escribe el token de verificación privado.
5. Guarda los cambios. Meta enviará un request de verificación tipo `GET` al endpoint Next.js. Si coincide con la clave guardada en `/admin/integraciones`, la conexión se completará con éxito.
6. En la misma configuración de Meta, suscríbete al campo `messages` para recibir los mensajes entrantes de los clientes en tiempo real.
