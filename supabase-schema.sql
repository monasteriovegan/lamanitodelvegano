-- Schema para configurar Supabase para La Manito Del Vegano 🌱
-- Ejecuta este script en el SQL Editor de tu proyecto Supabase.

-- 1. Tabla de Categorías
CREATE TABLE IF NOT EXISTS categorias (
    id text DEFAULT gen_random_uuid()::text PRIMARY KEY,
    nombre text NOT NULL,
    emoji text,
    slug text NOT NULL UNIQUE
);

-- 2. Tabla de Productos
CREATE TABLE IF NOT EXISTS productos (
    id text DEFAULT gen_random_uuid()::text PRIMARY KEY,
    nombre text NOT NULL,
    descripcion text,
    precio integer NOT NULL,
    precio_anterior integer,
    categoria text,
    emoji text,
    etiqueta text,
    etiqueta_label text,
    color_fondo text,
    imagen_url text,
    destacado boolean DEFAULT false,
    costo integer,
    maneja_stock boolean DEFAULT false,
    stock integer,
    gluten_free boolean DEFAULT true,
    nut_free boolean DEFAULT true
);

-- 3. Tabla de Zonas de Envío
CREATE TABLE IF NOT EXISTS zonas (
    id text DEFAULT gen_random_uuid()::text PRIMARY KEY,
    nombre text NOT NULL,
    comunas text,
    precio integer DEFAULT 0
);

-- 4. Tabla de Ajustes Globales de la Tienda
CREATE TABLE IF NOT EXISTS ajustes (
    id text PRIMARY KEY DEFAULT 'global',
    data jsonb NOT NULL
);

-- 5. Tabla de Cupones de Descuento
CREATE TABLE IF NOT EXISTS cupones (
    id text PRIMARY KEY, -- El ID es el código en mayúsculas (ej: 'BIENVENIDO')
    code text,
    tipo text, -- 'fijo' | 'porcentaje' | 'bogo' | 'regalo'
    valor text,
    minMonto integer DEFAULT 0
);

-- 6. Tabla de PINS de Seguridad (Fidelidad)
CREATE TABLE IF NOT EXISTS puntos_pins (
    id text PRIMARY KEY, -- Identificador único (email o teléfono sin símbolos)
    pin text NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- 7. Tabla de Pedidos
CREATE TABLE IF NOT EXISTS pedidos (
    id text DEFAULT gen_random_uuid()::text PRIMARY KEY,
    cliente jsonb NOT NULL,
    items jsonb NOT NULL,
    total integer NOT NULL,
    descuentoFidelidad integer DEFAULT 0,
    puntosCanjeados integer DEFAULT 0,
    puntosGanados integer DEFAULT 0,
    status text DEFAULT 'Pendiente',
    createdAt timestamptz DEFAULT now(),
    fechaDespacho text,
    zonaEnvio text,
    costoEnvio integer DEFAULT 0
);

-- Habilitar acceso de lectura y escritura libre para el rol anon si no hay RLS restrictiva:
ALTER TABLE categorias DISABLE ROW LEVEL SECURITY;
ALTER TABLE productos DISABLE ROW LEVEL SECURITY;
ALTER TABLE zonas DISABLE ROW LEVEL SECURITY;
ALTER TABLE ajustes DISABLE ROW LEVEL SECURITY;
ALTER TABLE cupones DISABLE ROW LEVEL SECURITY;
ALTER TABLE puntos_pins DISABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos DISABLE ROW LEVEL SECURITY;

-- Insertar categorías por defecto si no existen
INSERT INTO categorias (nombre, emoji, slug)
VALUES 
    ('Empanadas', '🥟', 'empanadas'),
    ('Pies', '🫐', 'pies'),
    ('Manjares', '🍯', 'manjares'),
    ('Packs', '📦', 'packs')
ON CONFLICT (slug) DO NOTHING;

-- Insertar ajustes por defecto si no existen
INSERT INTO ajustes (id, data)
VALUES (
    'global', 
    '{"nombre": "La Manito Del Vegano", "whatsapp": "56990816124", "instagram": "lamanitodelvegano", "tiktok": "", "facebook": "", "estado": "abierto", "tasaPuntos": 1000, "valorPunto": 100}'
)
ON CONFLICT (id) DO NOTHING;
