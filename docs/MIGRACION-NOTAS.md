# Notas de migración — La Manito Del Vegano (vanilla JS → Next.js)

## Reglas de negocio identificadas (del app.js viejo) a preservar

### Carrito y precios
- subtotal = suma(qty * precio) por item en carrito
- costoEnvio = precio de la zona seleccionada (o 0 si no hay zona)
- descuento cupón:
  - tipo "fijo": min(subtotal, valor)
  - tipo "porcentaje": round(subtotal * valor/100)
  - tipo "bogo": por cada categoría/producto que matchea el valor del cupón, floor(qty/2) * precio de descuento
  - tipo "regalo": no descuenta dinero, se agrega un item gratis al pedido si subtotal >= minMonto
- total final = max(0, subtotal + envío - descuentoCupon - descuentoFidelidad)
- ⚠️ CRÍTICO: en el viejo, el total se calcula en cliente y se inserta tal cual en Supabase y se manda a Flow/MP. 
  EN LA MIGRACIÓN: el total SIEMPRE se debe recalcular server-side antes de crear preferencia de pago e insertar el pedido.

### Fechas de despacho (genFechas)
- Mínimo 3 días de anticipación por defecto
- Solo ciertos días de semana habilitados (lun-sáb, no domingo: diasOk = [1,2,3,4,5,6])
- Si algún producto del carrito tiene `disponibilidad` (fechas especiales, ej. para productos de temporada), 
  se usa la INTERSECCIÓN de fechas disponibles entre todos los productos con restricción, no la default

### Fidelidad por puntos
- tasaPuntos (default 1000): cada $1000 en compras = 1 punto
- valorPunto (default 100): cada punto canjeado = $100 de descuento
- Puntos ganados = floor((total_pedido + descuentoFidelidad) / tasaPuntos), solo en pedidos con status != Cancelado/Pendiente
- Puntos disponibles = totalGanados - totalCanjeados (suma histórica de todos los pedidos del cliente)
- Identificador de cliente = email (lowercase) o teléfono (solo dígitos) si no hay email
- Sistema de PIN de 4 dígitos para proteger el canje de puntos (se guarda en tabla puntos_pins)
- ⚠️ CRÍTICO: el viejo hace `select('*')` de TODA la tabla pedidos desde el navegador para calcular esto.
  EN LA MIGRACIÓN: esto debe ser un endpoint server-side que reciba email/tel y devuelva solo el resultado agregado.

### Productos
- Pueden tener múltiples "formatos" (peso/tamaño) con precio proporcional si no se especifica explícito
- Pueden tener múltiples "variedades/sabores" seleccionables con cantidad individual
- Gestión de stock opcional (ilimitado vs limitado con unidades)
- Atributos: sin gluten, sin nueces
- Etiquetas: nuevo, oferta, estrella, promo especial
- Categorías propias administrables (no fijas)

### Pagos
- Mercado Pago: crea preferencia vía API, redirige a init_point
- Flow: firma HMAC-SHA256 de parámetros ordenados alfabéticamente, webhook de confirmación actualiza status a "Pagado"
- Ambas necesitan recalculo server-side del total antes de crear la preferencia (ver arriba)

### Admin
- Login con password única (ADMIN_PASS hardcodeada) → MIGRAR a Supabase Auth con roles
- Tabs: Productos, Destacados, Categorías, Envíos (zonas), Pedidos, Métricas, Ajustes, Promo Flyer, Cupones & Promos, Integraciones
- Integraciones guarda flow_api_key, flow_secret_key, MP token, etc. en tabla `ajustes` (texto plano, RLS pública de lectura)
  → MIGRAR a variables de entorno server-side / tabla con RLS solo service_role
- Tiene un "importador desde Shopify" (importarDesdeShopify) — revisar si se quiere mantener

### Chat (Chef Remy)
- Usa Gemini 1.5 Flash vía API route, con contexto de catálogo de productos inyectado en el system prompt
- Memoria de conversación vía history

### WhatsApp Business
- Webhook de verificación (GET) + procesamiento de mensajes entrantes (POST) con respuesta automática vía Gemini

### Otras features de UI a preservar
- Scroll reveal animations, hojas flotantes animadas (floating leaves) — estética cósmica/orgánica
- Tracking de pedido por ID
- Popup de promo especial / flyer estilo Instagram stories
- Buscador de productos en vivo
- FAQ acordeón

## Vulnerabilidades a cerrar en la migración
1. ADMIN_PASS hardcodeada en JS público → Supabase Auth
2. flow_secret_key / MP tokens en tabla `ajustes` con RLS pública de lectura → mover a env vars server-side
3. Total del pedido calculado y confiado desde el cliente → recalcular server-side siempre
4. Lectura completa de tabla `pedidos` desde el navegador (fidelidad) → endpoint server-side agregado
5. RLS inconsistente entre supabase-schema.sql (la deshabilita) y supabase-security.sql (la habilita) → un solo source of truth
