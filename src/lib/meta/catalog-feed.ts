type FeedSource = {
  product: { slug: string; name: string; description: string | null; imageUrl: string | null };
  variant: { id: string; sku: string; name: string; price: number; stock: number | null; managesStock: boolean };
};

export function buildMetaFeedItem({ product, variant }: FeedSource) {
  return {
    id: variant.sku,
    title: `${product.name} — ${variant.name}`,
    description: product.description || product.name,
    availability: variant.managesStock && Number(variant.stock || 0) <= 0 ? 'out of stock' : 'in stock',
    condition: 'new',
    price: `${variant.price} CLP`,
    link: `https://lamanitodelvegano.cl/productos/${product.slug}?variant=${encodeURIComponent(variant.sku)}`,
    image_link: product.imageUrl || '',
    brand: 'La Manito del Vegano',
  };
}

function csv(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export function serializeMetaCatalogCsv(items: ReturnType<typeof buildMetaFeedItem>[]) {
  const columns = ['id', 'title', 'description', 'availability', 'condition', 'price', 'link', 'image_link', 'brand'] as const;
  return [columns.join(','), ...items.map((item) => columns.map((column) => csv(item[column])).join(','))].join('\n');
}
