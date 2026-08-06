-- ============================================================
-- LA MANITO DEL VEGANO ✦ MIGRACIÓN TOTAL PARIDAD CON MAKANGRU
-- Ejecutar en Supabase → SQL Editor
-- ============================================================

-- 1. MODIFICAR TABLAS EXISTENTES CON NUEVOS ATRIBUTOS DE COMERCIO Y PRODUCTOS
ALTER TABLE productos ADD COLUMN IF NOT EXISTS compare_price DECIMAL(10,2);
ALTER TABLE productos ADD COLUMN IF NOT EXISTS cost_price DECIMAL(10,2);
ALTER TABLE productos ADD COLUMN IF NOT EXISTS sku VARCHAR(50) UNIQUE;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS low_stock_alert INTEGER DEFAULT 5;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS weight_grams INTEGER;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS story TEXT;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS ingredients TEXT[] DEFAULT '{}';
ALTER TABLE productos ADD COLUMN IF NOT EXISTS allergens TEXT[] DEFAULT '{}';
ALTER TABLE productos ADD COLUMN IF NOT EXISTS is_new BOOLEAN DEFAULT false;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;

ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS coupon_id UUID;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS shipping_zone_id UUID;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS shipping_zone_name VARCHAR(100);

-- 2. TABLA INGREDIENTES
CREATE TABLE IF NOT EXISTS ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  unit VARCHAR(20) DEFAULT 'g',
  cost_per_unit DECIMAL(10,2) DEFAULT 0,
  supplier VARCHAR(255),
  is_allergen BOOLEAN DEFAULT false,
  allergens TEXT[] DEFAULT '{}',
  notes TEXT,
  calories_per_100g DECIMAL(10,2) DEFAULT 0,
  protein_per_100g DECIMAL(10,2) DEFAULT 0,
  carbs_per_100g DECIMAL(10,2) DEFAULT 0,
  fat_per_100g DECIMAL(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABLA RECETAS
CREATE TABLE IF NOT EXISTS recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  product_id UUID REFERENCES productos(id) ON DELETE SET NULL,
  yield_units INTEGER DEFAULT 1,
  yield_description VARCHAR(255),
  labor_minutes INTEGER DEFAULT 0,
  overhead_percent INTEGER DEFAULT 15,
  selling_price DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. RELACIÓN RECETAS - INGREDIENTES
CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
  ingredient_id UUID REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity DECIMAL(10,2) NOT NULL,
  unit VARCHAR(20) DEFAULT 'g',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TABLA RESERVAS Y RETIRO
CREATE TABLE IF NOT EXISTS store_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name VARCHAR(255) NOT NULL,
  customer_email VARCHAR(255),
  customer_phone VARCHAR(20),
  reservation_date DATE NOT NULL,
  reservation_time VARCHAR(20) NOT NULL,
  party_size INTEGER DEFAULT 1,
  notes TEXT,
  internal_notes TEXT,
  status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending','confirmed','ready','completed','cancelled')),
  type VARCHAR(30) DEFAULT 'pickup',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TABLA TEMPORADAS
CREATE TABLE IF NOT EXISTS seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  color_start VARCHAR(20) DEFAULT '#2d6a4f', -- verde bosque por defecto para La Manito
  color_end VARCHAR(20) DEFAULT '#52b788',
  is_active BOOLEAN DEFAULT true,
  banner_image TEXT,
  badge_text VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. RELACIÓN TEMPORADAS - PRODUCTOS
CREATE TABLE IF NOT EXISTS season_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID REFERENCES seasons(id) ON DELETE CASCADE,
  product_id UUID REFERENCES productos(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7.1 TABLA BLOG POSTS
CREATE TABLE IF NOT EXISTS blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(300) NOT NULL,
  slug VARCHAR(300) UNIQUE NOT NULL,
  excerpt TEXT,
  content TEXT NOT NULL,
  cover_image TEXT,
  author_name VARCHAR(100) DEFAULT 'La Manito del Vegano',
  category VARCHAR(100),
  tags TEXT[],
  is_published BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  meta_title VARCHAR(200),
  meta_description VARCHAR(300),
  read_time_minutes INTEGER,
  views INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7.2 TABLA MENSAJES DE CONTACTO
CREATE TABLE IF NOT EXISTS contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  subject VARCHAR(200),
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. TABLA SITE SETTINGS (si no existe)
CREATE TABLE IF NOT EXISTS site_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  site_name VARCHAR(100) DEFAULT 'La Manito del Vegano',
  site_tagline VARCHAR(200) DEFAULT 'Taller de Comida Vegana Artesanal',
  site_description TEXT,
  logo_url TEXT,
  favicon_url TEXT,
  contact_email VARCHAR(255),
  contact_phone VARCHAR(30),
  contact_address TEXT,
  contact_city VARCHAR(100) DEFAULT 'Santiago, Chile',
  instagram_url TEXT,
  facebook_url TEXT,
  tiktok_url TEXT,
  youtube_url TEXT,
  pinterest_url TEXT,
  whatsapp_number VARCHAR(20),
  whatsapp_message TEXT DEFAULT 'Hola La Manito del Vegano ✦ me gustaría hacer un pedido',
  mp_public_key TEXT,
  mp_access_token TEXT,
  banner_enabled BOOLEAN DEFAULT false,
  banner_text TEXT,
  banner_color VARCHAR(20) DEFAULT '#2d6a4f',
  business_hours TEXT,
  transfer_bank_name VARCHAR(100),
  transfer_account_type VARCHAR(50),
  transfer_account_holder VARCHAR(200),
  transfer_account_rut VARCHAR(20),
  transfer_account_number VARCHAR(50),
  transfer_email VARCHAR(255),
  transfer_instructions TEXT,
  meta_title VARCHAR(200),
  meta_description VARCHAR(320),
  og_image_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Solo puede haber 1 fila (id=1)
INSERT INTO site_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 9. HABILITAR SEGURIDAD RLS
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE season_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

-- 10. POLÍTICAS RLS (Lectura pública para configuraciones y temporadas, escritura administrativa)
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

-- Políticas para ingredients
DROP POLICY IF EXISTS "ingredients_admin_all" ON ingredients;
CREATE POLICY "ingredients_admin_all" ON ingredients FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Políticas para recipes
DROP POLICY IF EXISTS "recipes_admin_all" ON recipes;
CREATE POLICY "recipes_admin_all" ON recipes FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Políticas para recipe_ingredients
DROP POLICY IF EXISTS "recipe_ingredients_admin_all" ON recipe_ingredients;
CREATE POLICY "recipe_ingredients_admin_all" ON recipe_ingredients FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Políticas para store_reservations
DROP POLICY IF EXISTS "store_reservations_admin_all" ON store_reservations;
CREATE POLICY "store_reservations_admin_all" ON store_reservations FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Políticas para seasons (Lectura pública, escritura admin)
DROP POLICY IF EXISTS "seasons_public_read" ON seasons;
CREATE POLICY "seasons_public_read" ON seasons FOR SELECT USING (true);
DROP POLICY IF EXISTS "seasons_admin_all" ON seasons;
CREATE POLICY "seasons_admin_all" ON seasons FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Políticas para season_products (Lectura pública, escritura admin)
DROP POLICY IF EXISTS "season_products_public_read" ON season_products;
CREATE POLICY "season_products_public_read" ON season_products FOR SELECT USING (true);
DROP POLICY IF EXISTS "season_products_admin_all" ON season_products;
CREATE POLICY "season_products_admin_all" ON season_products FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Políticas para site_settings (Lectura pública, escritura admin)
DROP POLICY IF EXISTS "site_settings_public_read" ON site_settings;
CREATE POLICY "site_settings_public_read" ON site_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "site_settings_admin_all" ON site_settings;
CREATE POLICY "site_settings_admin_all" ON site_settings FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Políticas para blog_posts (Lectura pública si está publicado, todo para admin)
DROP POLICY IF EXISTS "blog_public_read" ON blog_posts;
CREATE POLICY "blog_public_read" ON blog_posts FOR SELECT USING (is_published = true);
DROP POLICY IF EXISTS "blog_admin_all" ON blog_posts;
CREATE POLICY "blog_admin_all" ON blog_posts FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Políticas para contact_messages (Inserción pública, lectura/escritura admin)
DROP POLICY IF EXISTS "contact_messages_public_insert" ON contact_messages;
CREATE POLICY "contact_messages_public_insert" ON contact_messages FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "contact_messages_admin_all" ON contact_messages;
CREATE POLICY "contact_messages_admin_all" ON contact_messages FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- 11. TRIGGERS DE ACTUALIZACIÓN DE TIMESTAMP (UPDATED_AT)
CREATE OR REPLACE FUNCTION update_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ingredients_updated ON ingredients;
CREATE TRIGGER trg_ingredients_updated BEFORE UPDATE ON ingredients FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_recipes_updated ON recipes;
CREATE TRIGGER trg_recipes_updated BEFORE UPDATE ON recipes FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_store_reservations_updated ON store_reservations;
CREATE TRIGGER trg_store_reservations_updated BEFORE UPDATE ON store_reservations FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_seasons_updated ON seasons;
CREATE TRIGGER trg_seasons_updated BEFORE UPDATE ON seasons FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_site_settings_updated ON site_settings;
CREATE TRIGGER trg_site_settings_updated BEFORE UPDATE ON site_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_blog_posts_updated ON blog_posts;
CREATE TRIGGER trg_blog_posts_updated BEFORE UPDATE ON blog_posts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
