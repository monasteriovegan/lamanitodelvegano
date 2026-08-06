-- ============================================================
-- MIGRACIÓN CRM Y LOGÍSTICA PARA LA MANITO DEL VEGANO
-- Ejecutar en Supabase -> SQL Editor
-- ============================================================

-- 1. ENTIDAD MULTINEGOCIO (BUSINESSES)
CREATE TABLE IF NOT EXISTS businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertar negocio por defecto para La Manito
INSERT INTO businesses (slug, name)
VALUES ('la-manito-del-vegano', 'La Manito del Vegano')
ON CONFLICT (slug) DO NOTHING;

-- 2. LOGÍSTICA DE ENTREGAS
CREATE TABLE IF NOT EXISTS delivery_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  enabled_weekdays INTEGER[] DEFAULT '{1,2,3,4,5,6}', -- Lun a Sáb por defecto
  min_advance_days INTEGER DEFAULT 3,
  max_advance_days INTEGER DEFAULT 21,
  cutoff_hour INTEGER DEFAULT 12,
  delivery_message TEXT DEFAULT 'Elige tu fecha de entrega preferida ✦',
  max_orders_per_day INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertar configuración por defecto si no existe
INSERT INTO delivery_settings (business_id, enabled_weekdays, min_advance_days, max_advance_days, cutoff_hour, delivery_message)
SELECT id, ARRAY[1,2,3,4,5,6], 3, 21, 12, 'Elige tu fecha de entrega preferida ✦'
FROM businesses WHERE slug = 'la-manito-del-vegano'
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS blocked_delivery_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  reason VARCHAR(200),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT blocked_delivery_dates_date_business_key UNIQUE(business_id, date)
);

-- 3. CRM Y CLIENTES
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  email VARCHAR(255),
  phone VARCHAR(50),
  nombre VARCHAR(255),
  direccion TEXT,
  crm_status VARCHAR(50) DEFAULT 'new' CHECK (crm_status IN ('new','contacted','interested','order_started','payment_pending','customer','follow_up','repeat_customer','inactive','lost')),
  total_spent DECIMAL(12,2) DEFAULT 0,
  total_orders INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices únicos parciales (por negocio) para evitar duplicados en email o teléfono
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_business_email ON customers (business_id, email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_business_phone ON customers (business_id, phone) WHERE phone IS NOT NULL;

-- Tabla de Notas de Clientes
CREATE TABLE IF NOT EXISTS customer_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de Etiquetas
CREATE TABLE IF NOT EXISTS customer_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  color VARCHAR(20) DEFAULT '#00ffb3',
  CONSTRAINT customer_tags_name_business_key UNIQUE(business_id, name)
);

-- Asignación de Etiquetas a Clientes
CREATE TABLE IF NOT EXISTS customer_tag_assignments (
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES customer_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (customer_id, tag_id)
);

-- Historial de Actividades CRM
CREATE TABLE IF NOT EXISTS crm_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'note_added', 'status_change', 'follow_up', 'order_created'
  description TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertar etiquetas por defecto para La Manito
INSERT INTO customer_tags (business_id, name, color)
SELECT id, 'VIP', '#f59e0b' FROM businesses WHERE slug = 'la-manito-del-vegano'
UNION ALL
SELECT id, 'Frecuente', '#00ffb3' FROM businesses WHERE slug = 'la-manito-del-vegano'
UNION ALL
SELECT id, 'Mayorista', '#00eeff' FROM businesses WHERE slug = 'la-manito-del-vegano'
UNION ALL
SELECT id, 'Sin Gluten', '#52b788' FROM businesses WHERE slug = 'la-manito-del-vegano'
ON CONFLICT DO NOTHING;

-- 4. ADAPTAR TABLAS EXISTENTES A MULTINEGOCIO Y CRM
ALTER TABLE productos ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE SET NULL;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE SET NULL;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS admin_notes TEXT;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS tracking_number VARCHAR(100);

-- Enlazar registros existentes al negocio por defecto
UPDATE productos SET business_id = (SELECT id FROM businesses WHERE slug = 'la-manito-del-vegano') WHERE business_id IS NULL;
UPDATE pedidos SET business_id = (SELECT id FROM businesses WHERE slug = 'la-manito-del-vegano') WHERE business_id IS NULL;

-- Tabla de historial de estados para pedidos
CREATE TABLE IF NOT EXISTS order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id TEXT NOT NULL,
  old_status VARCHAR(50),
  new_status VARCHAR(50) NOT NULL,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

-- 5. SEGURIDAD Y POLÍTICAS RLS
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_tag_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_delivery_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;

-- Políticas para order_status_history
DROP POLICY IF EXISTS "order_status_history_admin" ON order_status_history;
CREATE POLICY "order_status_history_admin" ON order_status_history FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Políticas para businesses
DROP POLICY IF EXISTS "businesses_select_public" ON businesses;
CREATE POLICY "businesses_select_public" ON businesses FOR SELECT USING (true);
DROP POLICY IF EXISTS "businesses_write_admin" ON businesses;
CREATE POLICY "businesses_write_admin" ON businesses FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Políticas para delivery_settings
DROP POLICY IF EXISTS "delivery_settings_select_public" ON delivery_settings;
CREATE POLICY "delivery_settings_select_public" ON delivery_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "delivery_settings_write_admin" ON delivery_settings;
CREATE POLICY "delivery_settings_write_admin" ON delivery_settings FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Políticas para blocked_delivery_dates
DROP POLICY IF EXISTS "blocked_delivery_dates_select_public" ON blocked_delivery_dates;
CREATE POLICY "blocked_delivery_dates_select_public" ON blocked_delivery_dates FOR SELECT USING (true);
DROP POLICY IF EXISTS "blocked_delivery_dates_write_admin" ON blocked_delivery_dates;
CREATE POLICY "blocked_delivery_dates_write_admin" ON blocked_delivery_dates FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Políticas para CRM (exclusivas de administradores)
DROP POLICY IF EXISTS "crm_customers_admin" ON customers;
CREATE POLICY "crm_customers_admin" ON customers FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "crm_customer_notes_admin" ON customer_notes;
CREATE POLICY "crm_customer_notes_admin" ON customer_notes FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "crm_customer_tags_admin" ON customer_tags;
CREATE POLICY "crm_customer_tags_admin" ON customer_tags FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "crm_customer_tag_assignments_admin" ON customer_tag_assignments;
CREATE POLICY "crm_customer_tag_assignments_admin" ON customer_tag_assignments FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "crm_activities_admin" ON crm_activities;
CREATE POLICY "crm_activities_admin" ON crm_activities FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- 6. FUNCIÓN DE SINCRONIZACIÓN INICIAL DE PEDIDOS A CLIENTES CRM
CREATE OR REPLACE FUNCTION sync_customers_from_pedidos()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r RECORD;
  c_email TEXT;
  c_phone TEXT;
  c_nombre TEXT;
  c_direccion TEXT;
  c_id UUID;
  b_id UUID;
BEGIN
  -- Obtener el ID del negocio de La Manito
  SELECT id INTO b_id FROM businesses WHERE slug = 'la-manito-del-vegano' LIMIT 1;

  FOR r IN SELECT * FROM pedidos LOOP
    -- Extraer y normalizar información de contacto
    c_email := lower(trim(r.cliente->>'email'));
    c_phone := regexp_replace(r.cliente->>'telefono', '\D', '', 'g');
    c_nombre := trim(r.cliente->>'nombre');
    c_direccion := trim(r.cliente->>'direccion');

    IF c_email = '' THEN c_email := NULL; END IF;
    IF c_phone = '' THEN c_phone := NULL; END IF;

    IF c_email IS NOT NULL OR c_phone IS NOT NULL THEN
      c_id := NULL;
      
      -- 1. Intentar buscar por email
      IF c_email IS NOT NULL THEN
        SELECT id INTO c_id FROM customers WHERE business_id = b_id AND email = c_email LIMIT 1;
      END IF;
      
      -- 2. Intentar buscar por teléfono si no se encontró por email
      IF c_id IS NULL AND c_phone IS NOT NULL THEN
        SELECT id INTO c_id FROM customers WHERE business_id = b_id AND phone = c_phone LIMIT 1;
      END IF;

      -- 3. Si no existe, crearlo
      IF c_id IS NULL THEN
        INSERT INTO customers (business_id, email, phone, nombre, direccion, crm_status, total_spent, total_orders, created_at)
        VALUES (b_id, c_email, c_phone, c_nombre, c_direccion, 'customer', r.total, 1, r."createdAt")
        RETURNING id INTO c_id;
      ELSE
        -- 4. Si existe, acumular sus estadísticas y actualizar su información
        UPDATE customers
        SET 
          total_orders = total_orders + 1,
          total_spent = total_spent + r.total,
          direccion = COALESCE(direccion, c_direccion),
          nombre = COALESCE(nombre, c_nombre),
          updated_at = NOW()
        WHERE id = c_id;
      END IF;
      
      -- Asignar el ID de cliente al registro de pedido correspondiente
      UPDATE pedidos SET customer_id = c_id WHERE id = r.id;
    END IF;
  END LOOP;
END;
$$;

-- Ejecutar la sincronización inicial
SELECT sync_customers_from_pedidos();
