// Tipos centrales del dominio — La Manito Del Vegano

export type EstadoPedido =
  | 'Pendiente'
  | 'Pagado'
  | 'Despachado'
  | 'Completado'
  | 'Cancelado'
  | 'WhatsApp';

export type TipoCupon = 'fijo' | 'porcentaje' | 'bogo' | 'regalo';
export type Etiqueta = 'nuevo' | 'oferta' | 'estrella' | 'promo' | null;

export interface Categoria {
  id: string; // text en BD real, no uuid
  nombre: string;
  emoji: string | null;
  slug: string;
}

export interface FormatoProducto {
  label: string; // ej "250g"
  precio: number; // precio absoluto para ese formato
}

export interface Producto {
  id: string; // text en BD real, no uuid
  slug: string; // URL propia del producto, para /productos/[slug]
  nombre: string;
  descripcion: string | null; // columna real es 'descripcion', no descripcion_corta/larga
  precio: number;
  precio_anterior: number | null;
  costo: number | null;
  categoria: string | null; // texto libre en la BD real, no FK
  emoji: string | null;
  etiqueta: Etiqueta;
  etiqueta_label: string | null;
  color_fondo: string | null;
  imagen_url: string | null;
  destacado: boolean;
  maneja_stock: boolean;
  stock: number | null;
  gluten_free: boolean;
  nut_free: boolean;
  disponibilidad: string | null; // texto en BD real (no array), se parsea si se usa
  gramaje: string | null;
  variedades: string | null;
  activo: boolean;

  // Nuevos campos para paridad total con Makangru
  sku?: string | null;
  cost_price?: number | null;
  low_stock_alert?: number | null;
  weight_grams?: number | null;
  story?: string | null;
  is_new?: boolean;
  is_featured?: boolean;
  ingredients?: string[] | null;
  allergens?: string[] | null;
}

export interface Zona {
  id: string;
  nombre: string;
  comunas: string | null;
  precio: number;
}

// La tabla real `ajustes` guarda todo en una columna `data` JSON (legado del sitio viejo).
export interface AjustesData {
  nombre?: string;
  whatsapp?: string;
  instagram?: string;
  tiktok?: string;
  facebook?: string;
  estado?: 'abierto' | 'cerrado';
  tasaPuntos?: number;
  valorPunto?: number;
  promo_activa?: boolean;
  promo_imagen_url?: string;
  promo_producto_id?: string;
  
  // Nuevos campos para paridad total con Makangru
  contact_email?: string;
  contact_phone?: string;
  contact_address?: string;
  contact_city?: string;
  youtube?: string;
  pinterest?: string;
  business_hours?: string;
  banner_enabled?: boolean;
  banner_text?: string;
  banner_color?: string;
  transfer_bank_name?: string;
  transfer_account_type?: string;
  transfer_account_holder?: string;
  transfer_account_rut?: string;
  transfer_account_number?: string;
  transfer_email?: string;
  transfer_instructions?: string;
  meta_title?: string;
  meta_description?: string;
  og_image_url?: string;
}

export interface AjustesPublicos {
  id: string;
  data: AjustesData;
}

export interface Cupon {
  id: string; // código
  code: string | null;
  tipo: TipoCupon;
  valor: string;
  minMonto: number; // camelCase real en BD
  activo: boolean;
  expira_at: string | null;
}

export interface ItemCarrito {
  productoId: string;
  nombre: string;
  precio: number; // precio unitario final (con formato aplicado)
  qty: number;
  emoji?: string;
  formato?: string | null;
  variedad?: string | null;
}

export interface ClienteInfo {
  nombre: string;
  direccion: string;
  telefono: string;
  email: string;
}

export interface Pedido {
  id: string;
  cliente: ClienteInfo;
  items: ItemCarrito[];
  total: number;
  descuentoFidelidad: number;
  puntosCanjeados: number;
  puntosGanados: number;
  status: EstadoPedido;
  createdAt: string;
  fechaDespacho: string | null;
  zonaEnvio: string | null;
  costoEnvio: number;
  metodoPago: string | null;
}

// Payload que el cliente manda a /api/checkout — SOLO intenciones, nunca precios finales.
// El servidor recalcula todo desde la base de datos.
export interface CheckoutRequest {
  cliente: ClienteInfo;
  items: { productoId: string; qty: number; formato?: string | null; variedad?: string | null }[];
  zonaId: string | null;
  cuponCode?: string | null;
  fechaDespachoIdx?: number;
  canjearPuntos?: boolean;
  pinFidelidad?: string;
  metodoPago: 'mercadopago' | 'flow' | 'whatsapp' | 'transfer';
}

// ------------------------------------------------------------
// Modelos Canónicos Normalizados de Pedidos y CRM
// ------------------------------------------------------------
export type OperationalStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'partial';
export type OrderSource = 'web' | 'whatsapp' | 'instagram' | 'facebook' | 'manual' | 'admin' | 'other';

export interface OrderItem {
  id: string;
  order_id: string;
  product_id?: string | null;
  product_name: string;
  product_sku?: string | null;
  product_image?: string | null;
  unit_price: number;
  quantity: number;
  subtotal: number;
  created_at?: string;
}

export interface Customer {
  id: string;
  user_id?: string | null;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  region?: string | null;
  postal_code?: string | null;
  country?: string;
  total_orders?: number;
  total_spent?: number;
  points?: number;
  membership?: string;
  stage?: string;
  tags?: string[];
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface OrderStatusHistoryItem {
  id: string;
  order_id: string;
  status?: string | null;
  payment_status?: string | null;
  notes?: string | null;
  created_by?: string;
  created_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  legacy_order_id?: string | null;
  customer_id?: string | null;
  status: OperationalStatus;
  payment_status: PaymentStatus;
  source: OrderSource;
  subtotal: number;
  discount_amount: number;
  shipping_amount: number;
  tax_amount: number;
  total: number;
  coupon_id?: string | null;
  coupon_code?: string | null;
  payment_method?: string | null;
  payment_reference?: string | null;
  mp_preference_id?: string | null;
  shipping_method?: string | null;
  tracking_number?: string | null;
  shipping_address?: any;
  shipping_zone_id?: string | null;
  shipping_zone_name?: string | null;
  delivery_date?: string | null;
  delivery_time?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  customer_name?: string | null;
  notes?: string | null;
  admin_notes?: string | null;
  paid_at?: string | null;
  shipped_at?: string | null;
  delivered_at?: string | null;
  created_at: string;
  updated_at: string;

  // Relaciones opcionales cargadas
  customer?: Customer;
  order_items?: OrderItem[];
  history?: OrderStatusHistoryItem[];
}

