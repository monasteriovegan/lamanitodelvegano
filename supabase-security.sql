-- Script de Seguridad para La Manito Del Vegano 🌱
-- Ejecuta este script en el SQL Editor de tu proyecto Supabase para proteger tu base de datos de accesos no autorizados.

-- 1. Habilitar Row Level Security (RLS) en todas las tablas
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE zonas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ajustes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cupones ENABLE ROW LEVEL SECURITY;
ALTER TABLE puntos_pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;

-- 2. Eliminar políticas antiguas (por si acaso)
DROP POLICY IF EXISTS "Public Read Categorias" ON categorias;
DROP POLICY IF EXISTS "Admin Write Categorias" ON categorias;
DROP POLICY IF EXISTS "Public Read Productos" ON productos;
DROP POLICY IF EXISTS "Admin Write Productos" ON productos;
DROP POLICY IF EXISTS "Public Read Zonas" ON zonas;
DROP POLICY IF EXISTS "Admin Write Zonas" ON zonas;
DROP POLICY IF EXISTS "Public Read Ajustes" ON ajustes;
DROP POLICY IF EXISTS "Admin Write Ajustes" ON ajustes;
DROP POLICY IF EXISTS "Public Read Cupones" ON cupones;
DROP POLICY IF EXISTS "Admin Write Cupones" ON cupones;
DROP POLICY IF EXISTS "Public Insert Pedidos" ON pedidos;
DROP POLICY IF EXISTS "Admin Read/Write Pedidos" ON pedidos;
DROP POLICY IF EXISTS "Public Read/Write Puntos Pins" ON puntos_pins;

-- 3. Políticas para la tabla "categorias"
CREATE POLICY "Public Read Categorias" ON categorias FOR SELECT TO anon USING (true);
CREATE POLICY "Admin Write Categorias" ON categorias FOR ALL TO anon
  USING (coalesce(current_setting('request.headers', true)::json->>'x-admin-pass', '') = 'manito2024')
  WITH CHECK (coalesce(current_setting('request.headers', true)::json->>'x-admin-pass', '') = 'manito2024');

-- 4. Políticas para la tabla "productos"
CREATE POLICY "Public Read Productos" ON productos FOR SELECT TO anon USING (true);
CREATE POLICY "Admin Write Productos" ON productos FOR ALL TO anon
  USING (coalesce(current_setting('request.headers', true)::json->>'x-admin-pass', '') = 'manito2024')
  WITH CHECK (coalesce(current_setting('request.headers', true)::json->>'x-admin-pass', '') = 'manito2024');

-- 5. Políticas para la tabla "zonas"
CREATE POLICY "Public Read Zonas" ON zonas FOR SELECT TO anon USING (true);
CREATE POLICY "Admin Write Zonas" ON zonas FOR ALL TO anon
  USING (coalesce(current_setting('request.headers', true)::json->>'x-admin-pass', '') = 'manito2024')
  WITH CHECK (coalesce(current_setting('request.headers', true)::json->>'x-admin-pass', '') = 'manito2024');

-- 6. Políticas para la tabla "ajustes"
CREATE POLICY "Public Read Ajustes" ON ajustes FOR SELECT TO anon USING (true);
CREATE POLICY "Admin Write Ajustes" ON ajustes FOR ALL TO anon
  USING (coalesce(current_setting('request.headers', true)::json->>'x-admin-pass', '') = 'manito2024')
  WITH CHECK (coalesce(current_setting('request.headers', true)::json->>'x-admin-pass', '') = 'manito2024');

-- 7. Políticas para la tabla "cupones"
CREATE POLICY "Public Read Cupones" ON cupones FOR SELECT TO anon USING (true);
CREATE POLICY "Admin Write Cupones" ON cupones FOR ALL TO anon
  USING (coalesce(current_setting('request.headers', true)::json->>'x-admin-pass', '') = 'manito2024')
  WITH CHECK (coalesce(current_setting('request.headers', true)::json->>'x-admin-pass', '') = 'manito2024');

-- 8. Políticas para la tabla "pedidos" (Protege la privacidad de tus clientes)
-- Permite que cualquiera cree pedidos (INSERT), pero solo el administrador con la contraseña correcta puede verlos (SELECT), modificarlos (UPDATE) o eliminarlos (DELETE).
CREATE POLICY "Public Insert Pedidos" ON pedidos FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Admin Read/Write Pedidos" ON pedidos FOR ALL TO anon
  USING (coalesce(current_setting('request.headers', true)::json->>'x-admin-pass', '') = 'manito2024')
  WITH CHECK (coalesce(current_setting('request.headers', true)::json->>'x-admin-pass', '') = 'manito2024');

-- 9. Políticas para la tabla "puntos_pins"
CREATE POLICY "Public Read/Write Puntos Pins" ON puntos_pins FOR ALL TO anon USING (true) WITH CHECK (true);
