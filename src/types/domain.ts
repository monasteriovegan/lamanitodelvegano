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
  metodoPago: 'mercadopago' | 'flow' | 'whatsapp';
}
