-- ============================================================
-- LA MANITO DEL VEGANO ✦ MIGRACIÓN A TABLAS CANÓNICAS DE PEDIDOS
-- Ejecutar en Supabase → SQL Editor
-- ============================================================

-- 1. TABLA CUSTOMERS (CRM)
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  full_name VARCHAR(200),
  phone VARCHAR(30),
  whatsapp VARCHAR(30),
  address_line1 VARCHAR(250),
  address_line2 VARCHAR(250),
  city VARCHAR(100),
  state VARCHAR(100),
  region VARCHAR(100),
  postal_code VARCHAR(20),
  country VARCHAR(50) DEFAULT 'Chile',
  total_orders INTEGER DEFAULT 0,
  total_spent DECIMAL(12,2) DEFAULT 0,
  points INTEGER DEFAULT 0,
  membership VARCHAR(50) DEFAULT 'standard',
  stage VARCHAR(50) DEFAULT 'nuevo',
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABLA ORDERS (PEDIDOS NORMALIZADOS)
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(30) UNIQUE NOT NULL,
  legacy_order_id TEXT,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending','confirmed','processing','shipped','delivered','cancelled')),
  payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','failed','refunded','partial')),
  source VARCHAR(30) DEFAULT 'web',
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  shipping_amount DECIMAL(10,2) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  coupon_id UUID,
  coupon_code VARCHAR(50),
  payment_method VARCHAR(50),
  payment_reference VARCHAR(200),
  mp_preference_id VARCHAR(200),
  shipping_method VARCHAR(50),
  tracking_number VARCHAR(100),
  shipping_address JSONB DEFAULT '{}'::jsonb,
  shipping_zone_id UUID,
  shipping_zone_name VARCHAR(100),
  delivery_date DATE,
  delivery_time VARCHAR(50),
  customer_email VARCHAR(255),
  customer_phone VARCHAR(30),
  customer_name VARCHAR(200),
  notes TEXT,
  admin_notes TEXT,
  paid_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABLA ORDER_ITEMS
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES productos(id) ON DELETE SET NULL,
  product_name VARCHAR(200) NOT NULL,
  product_sku VARCHAR(50),
  product_image TEXT,
  unit_price DECIMAL(10,2) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  subtotal DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABLA ORDER_STATUS_HISTORY (AUDITORÍA)
CREATE TABLE IF NOT EXISTS order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status VARCHAR(30),
  payment_status VARCHAR(20),
  notes TEXT,
  created_by VARCHAR(100) DEFAULT 'system',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDICES PARA OPTIMIZACIÓN
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- RLS SAFETY
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customers_admin_all" ON customers;
CREATE POLICY "customers_admin_all" ON customers FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "orders_admin_all" ON orders;
CREATE POLICY "orders_admin_all" ON orders FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "order_items_admin_all" ON order_items;
CREATE POLICY "order_items_admin_all" ON order_items FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "order_status_history_admin_all" ON order_status_history;
CREATE POLICY "order_status_history_admin_all" ON order_status_history FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- SCRIPT DE MIGRACIÓN DESDE TABLA LEGACY 'pedidos'
DO $$
DECLARE
  rec RECORD;
  cust_id UUID;
  ord_id UUID;
  item_rec RECORD;
  op_status VARCHAR(30);
  pay_status VARCHAR(20);
  src_channel VARCHAR(30);
  items_arr JSONB;
  i JSONB;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pedidos') THEN
    FOR rec IN SELECT * FROM pedidos LOOP
      -- Mapear estado legacy a 3 dimensiones
      IF rec.status = 'Pagado' THEN
        op_status := 'confirmed';
        pay_status := 'paid';
        src_channel := 'web';
      ELSIF rec.status = 'Despachado' THEN
        op_status := 'shipped';
        pay_status := COALESCE(rec.payment_status, 'paid');
        src_channel := 'web';
      ELSIF rec.status = 'Completado' THEN
        op_status := 'delivered';
        pay_status := COALESCE(rec.payment_status, 'paid');
        src_channel := 'web';
      ELSIF rec.status = 'Cancelado' THEN
        op_status := 'cancelled';
        pay_status := COALESCE(rec.payment_status, 'failed');
        src_channel := 'web';
      ELSIF rec.status = 'WhatsApp' THEN
        op_status := 'pending';
        pay_status := COALESCE(rec.payment_status, 'pending');
        src_channel := 'whatsapp';
      ELSE
        op_status := 'pending';
        pay_status := COALESCE(rec.payment_status, 'pending');
        src_channel := 'web';
      END IF;

      -- Crear o reusar customer por email
      cust_id := NULL;
      IF rec.cliente IS NOT NULL AND (rec.cliente->>'email') IS NOT NULL AND (rec.cliente->>'email') != '' THEN
        INSERT INTO customers (email, full_name, phone, address_line1, city)
        VALUES (
          rec.cliente->>'email',
          COALESCE(rec.cliente->>'nombre', 'Cliente sin nombre'),
          rec.cliente->>'telefono',
          rec.cliente->>'direccion',
          rec.zonaEnvio
        )
        ON CONFLICT (email) DO UPDATE SET
          full_name = EXCLUDED.full_name,
          phone = COALESCE(EXCLUDED.phone, customers.phone),
          address_line1 = COALESCE(EXCLUDED.address_line1, customers.address_line1)
        RETURNING id INTO cust_id;
      END IF;

      -- Insertar en orders si no existe por legacy_order_id
      IF NOT EXISTS (SELECT 1 FROM orders WHERE legacy_order_id = rec.id::text) THEN
        INSERT INTO orders (
          order_number,
          legacy_order_id,
          customer_id,
          status,
          payment_status,
          source,
          total,
          payment_method,
          shipping_zone_name,
          customer_name,
          customer_email,
          customer_phone,
          shipping_address,
          notes,
          created_at
        ) VALUES (
          'MAN-' || UPPER(SUBSTRING(rec.id::text FROM 1 FOR 8)),
          rec.id::text,
          cust_id,
          op_status,
          pay_status,
          src_channel,
          COALESCE(rec.total, 0),
          rec.metodoPago,
          rec.zonaEnvio,
          rec.cliente->>'nombre',
          rec.cliente->>'email',
          rec.cliente->>'telefono',
          rec.cliente,
          rec.notas,
          rec.createdAt
        ) RETURNING id INTO ord_id;

        -- Insertar order_items desde JSON items
        IF rec.items IS NOT NULL THEN
          items_arr := rec.items::jsonb;
          FOR i IN SELECT * FROM jsonb_array_elements(items_arr) LOOP
            INSERT INTO order_items (
              order_id,
              product_name,
              unit_price,
              quantity,
              subtotal
            ) VALUES (
              ord_id,
              COALESCE(i->>'nombre', i->>'title', 'Producto'),
              COALESCE((i->>'precio')::decimal, (i->>'price')::decimal, 0),
              COALESCE((i->>'qty')::integer, (i->>'quantity')::integer, 1),
              COALESCE((i->>'subtotal')::decimal, COALESCE((i->>'precio')::decimal, 0) * COALESCE((i->>'qty')::integer, 1))
            );
          END LOOP;
        END IF;

        -- Registrar en historial
        INSERT INTO order_status_history (order_id, status, payment_status, notes, created_by)
        VALUES (ord_id, op_status, pay_status, 'Migrado desde registros de pedidos legacy', 'migration_script');
      END IF;
    END LOOP;
  END IF;
END $$;
