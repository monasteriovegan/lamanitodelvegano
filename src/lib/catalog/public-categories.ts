type CatalogProductLike = {
  id?: string;
  slug?: string | null;
  categoria?: string | null;
};

export const PUBLIC_CATALOG_CATEGORIES = [
  { id: 'proteinas-veganas', nombre: 'Proteínas veganas', emoji: '🌱', slug: 'proteinas-veganas' },
  { id: 'chocolateria-dulces', nombre: 'Chocolatería y dulces', emoji: '🍫', slug: 'chocolateria-dulces' },
  { id: 'pasteleria', nombre: 'Pastelería', emoji: '🧁', slug: 'pasteleria' },
  { id: 'empanadas-pizzas', nombre: 'Empanadas y pizzas', emoji: '🥟', slug: 'empanadas-pizzas' },
] as const;

function normalized(value: string | null | undefined) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

const CATEGORY_ALIASES = new Map<string, string>([
  ['proteinas veganas', 'proteinas-veganas'],
  ['team seitan', 'proteinas-veganas'],
  ['chocolateria', 'chocolateria-dulces'],
  ['chocolateria premium', 'chocolateria-dulces'],
  ['chocolateria y dulces', 'chocolateria-dulces'],
  ['dulces & chocolateria', 'chocolateria-dulces'],
  ['dulces proteicos', 'chocolateria-dulces'],
  ['box espeiales', 'chocolateria-dulces'],
  ['box especiales', 'chocolateria-dulces'],
  ['manjar, confituras ,cremas untables', 'chocolateria-dulces'],
  ['dulces y pasteleria', 'pasteleria'],
  ['pasteleria', 'pasteleria'],
  ['pies y tartas', 'pasteleria'],
  ['tortas', 'pasteleria'],
  ['empanadas', 'empanadas-pizzas'],
  ['empanadas y pizzas', 'empanadas-pizzas'],
  ['pizzas', 'empanadas-pizzas'],
]);

const PRODUCT_CATEGORY_OVERRIDES = new Map<string, string>([
  ['lomo-lyse', 'proteinas-veganas'],
  ['postres-en-frascos', 'pasteleria'],
]);

function categoryIdForProduct(product: CatalogProductLike) {
  return PRODUCT_CATEGORY_OVERRIDES.get(normalized(product.slug))
    || CATEGORY_ALIASES.get(normalized(product.categoria))
    || null;
}

export function publicCatalogCategories(products: CatalogProductLike[]) {
  const used = new Set(products.map(categoryIdForProduct).filter(Boolean));
  return PUBLIC_CATALOG_CATEGORIES.filter((category) => used.has(category.id));
}

export function filterProductsByCatalogCategory<T extends CatalogProductLike>(products: T[], categoryName: string): T[] {
  const categoryId = PUBLIC_CATALOG_CATEGORIES.find((category) => category.nombre === categoryName)?.id;
  if (!categoryId) return [];
  return products.filter((product) => categoryIdForProduct(product) === categoryId);
}

export function featuredProductMediaLayout() {
  return {
    containerClassName: 'relative aspect-[4/5] min-h-[260px]',
    imageClassName: 'absolute inset-0 h-full w-full object-contain p-2',
  };
}
