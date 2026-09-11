import type { SupabaseClient } from '@supabase/supabase-js';

export async function syncDulcesCatalog(db: SupabaseClient, explicitBusinessUnitId?: string) {
  let businessId = explicitBusinessUnitId;
  if (!businessId) {
    const { data: bu } = await db.from('business_units').select('id').order('created_at', { ascending: true }).limit(1).maybeSingle();
    businessId = bu?.id || 'f3b57ce7-0796-40e5-94f1-07cb2b48ba85';
  }

  // 1. Categoría
  await db.from('categorias').upsert({
    id: 'dulces-chocolateria',
    nombre: 'Dulces & Chocolatería',
    emoji: '🍫',
    slug: 'dulces-chocolateria',
  }, { onConflict: 'id' });

  // 2. Productos
  const productsToSync: Array<Record<string, any>> = [
    {
      business_unit_id: businessId,
      nombre: 'Protein Balls',
      slug: 'protein-balls',
      categoria: 'Dulces & Chocolatería',
      descripcion: 'Protein Balls veganas con cáñamo + mung. Aproximadamente 4 g de proteína por unidad. Sin azúcar, endulzadas con alulosa.',
      precio: 10900,
      precio_anterior: null,
      emoji: '🍫',
      color_fondo: '#2b1d14',
      imagen_url: 'https://lamanitodelvegano.cl/products/protein-balls.jpg',
      images: ['https://lamanitodelvegano.cl/products/protein-balls.jpg'],
      sku: 'LMV-PBALL',
      weight_grams: null,
      gluten_free: true,
      nut_free: false,
      activo: true,
      maneja_stock: false,
      destacado: false,
      is_featured: false,
      is_new: true,
    },
    {
      business_unit_id: businessId,
      nombre: 'Brigadeiros & Trufas surtidos',
      slug: 'brigadeiros-trufas-surtidos',
      categoria: 'Dulces & Chocolatería',
      descripcion: 'Cajita surtida de brigadeiros y trufas 100% veganos artesanales a base de cáñamo y cacao.',
      precio: 10900,
      precio_anterior: null,
      emoji: '🍬',
      color_fondo: '#241812',
      imagen_url: 'https://lamanitodelvegano.cl/products/brigadeiros-trufas-surtidos.jpg',
      images: ['https://lamanitodelvegano.cl/products/brigadeiros-trufas-surtidos.jpg'],
      sku: 'LMV-TRUFA',
      weight_grams: null,
      gluten_free: true,
      nut_free: false,
      activo: true,
      maneja_stock: false,
      destacado: false,
      is_featured: false,
      is_new: true,
    },
    {
      business_unit_id: businessId,
      nombre: 'Box Rollitos de Canela',
      slug: 'box-rollitos-canela',
      categoria: 'Dulces & Chocolatería',
      descripcion: 'Box de 6 rollitos de canela 100% veganos horneados artesanalmente con tus toppings favoritos.',
      precio: 10900,
      precio_anterior: null,
      emoji: '🥮',
      color_fondo: '#3b2314',
      imagen_url: 'https://lamanitodelvegano.cl/products/box-rollitos-canela.jpg',
      images: ['https://lamanitodelvegano.cl/products/box-rollitos-canela.jpg'],
      sku: 'LMV-ROLL',
      weight_grams: null,
      gluten_free: false,
      nut_free: false,
      activo: true,
      maneja_stock: false,
      destacado: false,
      is_featured: false,
      is_new: true,
    },
    {
      business_unit_id: businessId,
      nombre: 'Barra Dubái',
      slug: 'barra-dubai',
      categoria: 'Dulces & Chocolatería',
      descripcion: 'Chocolate vegano relleno de crema de pistacho y kunafa crujiente. Artesanal, vegana e irresistible.',
      precio: 10900,
      precio_anterior: 12900,
      emoji: '🍫',
      color_fondo: '#1e3522',
      imagen_url: 'https://lamanitodelvegano.cl/products/barra-dubai.jpg',
      images: ['https://lamanitodelvegano.cl/products/barra-dubai.jpg'],
      sku: 'LMV-DUBAI',
      weight_grams: 120,
      gluten_free: false,
      nut_free: false,
      activo: true,
      maneja_stock: false,
      destacado: false,
      is_featured: false,
      is_new: true,
    },
    {
      business_unit_id: businessId,
      nombre: 'Alfajores de Cáñamo',
      slug: 'alfajores-canamo',
      categoria: 'Dulces & Chocolatería',
      descripcion: 'Alfajores veganos proteicos de cáñamo, aprox. 60 g cada uno y 13 g de proteína por unidad. Altos en Omega 3 y 6, endulzados con alulosa, libres de gluten y soya.',
      precio: 3500,
      precio_anterior: null,
      emoji: '🍪',
      color_fondo: '#233221',
      imagen_url: 'https://lamanitodelvegano.cl/products/alfajores-canamo.jpg',
      images: ['https://lamanitodelvegano.cl/products/alfajores-canamo.jpg'],
      sku: 'LMV-ALF-HEMP',
      weight_grams: 60,
      gluten_free: true,
      nut_free: false,
      activo: true,
      maneja_stock: false,
      destacado: false,
      is_featured: false,
      is_new: true,
    },
  ];

  const productMap = new Map<string, string>();

  for (const prod of productsToSync) {
    const { data: existing } = await db
      .from('productos')
      .select('id')
      .eq('business_unit_id', businessId)
      .eq('slug', prod.slug)
      .maybeSingle();

    if (existing?.id) {
      productMap.set(prod.slug, existing.id);
      await db.from('productos').update(prod).eq('id', existing.id);
    } else {
      const { data: created, error } = await db.from('productos').insert(prod).select('id').single();
      if (error) console.error('Error creating product:', prod.slug, error);
      if (created?.id) productMap.set(prod.slug, created.id);
    }
  }

  // 3. Variantes
  const variantsToSync = [
    { productSlug: 'protein-balls', sku: 'LMV-PBALL-09', name: '9 unidades', price: 10900, compare_at_price: null, weight_grams: null, units_included: 9, selection_quantity: 9, sort_order: 10 },
    { productSlug: 'protein-balls', sku: 'LMV-PBALL-15', name: '15 unidades', price: 15900, compare_at_price: null, weight_grams: null, units_included: 15, selection_quantity: 15, sort_order: 20 },
    { productSlug: 'protein-balls', sku: 'LMV-PBALL-24', name: '24 unidades', price: 19900, compare_at_price: null, weight_grams: null, units_included: 24, selection_quantity: 24, sort_order: 30 },

    { productSlug: 'brigadeiros-trufas-surtidos', sku: 'LMV-TRUFA-09', name: '9 unidades', price: 10900, compare_at_price: null, weight_grams: null, units_included: 9, selection_quantity: 9, sort_order: 10 },
    { productSlug: 'brigadeiros-trufas-surtidos', sku: 'LMV-TRUFA-15', name: '15 unidades', price: 15900, compare_at_price: null, weight_grams: null, units_included: 15, selection_quantity: 15, sort_order: 20 },
    { productSlug: 'brigadeiros-trufas-surtidos', sku: 'LMV-TRUFA-24', name: '24 unidades', price: 19900, compare_at_price: null, weight_grams: null, units_included: 24, selection_quantity: 24, sort_order: 30 },

    { productSlug: 'box-rollitos-canela', sku: 'LMV-ROLL-06', name: 'Box 6 unidades', price: 10900, compare_at_price: null, weight_grams: null, units_included: 6, selection_quantity: 6, sort_order: 10 },

    { productSlug: 'barra-dubai', sku: 'LMV-DUBAI-120G', name: '120 g', price: 10900, compare_at_price: 12900, weight_grams: 120, units_included: 1, selection_quantity: 0, sort_order: 10 },
    { productSlug: 'barra-dubai', sku: 'LMV-DUBAI-240G', name: '240 g', price: 18900, compare_at_price: 21900, weight_grams: 240, units_included: 1, selection_quantity: 0, sort_order: 20 },

    { productSlug: 'alfajores-canamo', sku: 'LMV-ALF-HEMP-01', name: '1 unidad', price: 3500, compare_at_price: null, weight_grams: 60, units_included: 1, selection_quantity: 1, sort_order: 10 },
    { productSlug: 'alfajores-canamo', sku: 'LMV-ALF-HEMP-04', name: 'Pack 4', price: 11900, compare_at_price: null, weight_grams: 240, units_included: 4, selection_quantity: 4, sort_order: 20 },
  ];

  for (const v of variantsToSync) {
    const productId = productMap.get(v.productSlug);
    if (!productId) continue;
    const variantRow = {
      business_unit_id: businessId,
      product_id: productId,
      sku: v.sku,
      name: v.name,
      price: v.price,
      compare_at_price: v.compare_at_price,
      weight_grams: v.weight_grams,
      units_included: v.units_included,
      selection_quantity: v.selection_quantity,
      manages_stock: false,
      stock: null,
      is_active: true,
      sort_order: v.sort_order,
    };
    const { error } = await db.from('product_variants').upsert(variantRow, {
      onConflict: 'business_unit_id,sku',
    });
    if (error) console.error('Error upserting variant:', v.sku, error);
  }

  // 4. Option Groups & Values
  const groupsToSync = [
    {
      productSlug: 'protein-balls',
      code: 'sabores',
      name: 'Sabores',
      selection_mode: 'quantity' as const,
      is_required: true,
      sort_order: 10,
      values: [
        { code: 'naranja-cacao', label: 'Naranja confitada + cacao', sort_order: 10 },
        { code: 'caramelo-mani', label: 'Caramelo salado + maní', sort_order: 20 },
        { code: 'manzana-canela-bitter', label: 'Manzana confitada + canela + chocolate bitter', sort_order: 30 },
      ],
    },
    {
      productSlug: 'brigadeiros-trufas-surtidos',
      code: 'sabores',
      name: 'Sabores',
      selection_mode: 'quantity' as const,
      is_required: true,
      sort_order: 10,
      values: [
        { code: 'pistacho-dubai', label: 'Pistacho Dubái', sort_order: 10 },
        { code: 'manzanas-confitadas-canela', label: 'Manzanas confitadas y canela', sort_order: 20 },
        { code: 'naranjas-confitadas-trufa-bitter', label: 'Naranjas confitadas y trufa bitter', sort_order: 30 },
        { code: 'brigadeiro-cafe', label: 'Brigadeiro café (leche condensada de cáñamo)', sort_order: 40 },
        { code: 'brigadeiro-cacao', label: 'Brigadeiro cacao (manjar de cáñamo)', sort_order: 50 },
        { code: 'brigadeiro-coco', label: 'Brigadeiro coco (leche condensada de cáñamo y coco tostado)', sort_order: 60 },
      ],
    },
    {
      productSlug: 'box-rollitos-canela',
      code: 'toppings',
      name: 'Toppings / Sabores',
      selection_mode: 'quantity' as const,
      is_required: true,
      sort_order: 10,
      values: [
        { code: 'glaseado-vainilla', label: 'Glaseado vainilla', sort_order: 10 },
        { code: 'glaseado-chocolate', label: 'Glaseado chocolate', sort_order: 20 },
        { code: 'glaseado-toffee-manzana', label: 'Glaseado toffee + manzana confitada', sort_order: 30 },
        { code: 'glaseado-naranja', label: 'Glaseado naranja confitada', sort_order: 40 },
      ],
    },
    {
      productSlug: 'alfajores-canamo',
      code: 'sabores',
      name: 'Rellenos / Sabores',
      selection_mode: 'quantity' as const,
      is_required: true,
      sort_order: 10,
      values: [
        { code: 'manjar-canamo', label: 'Manjar de cáñamo', sort_order: 10 },
        { code: 'pistacho-dubai', label: 'Pistacho Dubái', sort_order: 20 },
      ],
    },
  ];

  for (const g of groupsToSync) {
    const productId = productMap.get(g.productSlug);
    if (!productId) continue;

    const groupRow = {
      business_unit_id: businessId,
      product_id: productId,
      code: g.code,
      name: g.name,
      selection_mode: g.selection_mode,
      is_required: g.is_required,
      is_active: true,
      sort_order: g.sort_order,
    };

    let groupId: string | null = null;
    const { data: existingGroup } = await db
      .from('product_option_groups')
      .select('id')
      .eq('business_unit_id', businessId)
      .eq('product_id', productId)
      .eq('code', g.code)
      .maybeSingle();

    if (existingGroup?.id) {
      groupId = existingGroup.id;
      await db.from('product_option_groups').update(groupRow).eq('id', groupId);
    } else {
      const { data: createdGroup, error } = await db.from('product_option_groups').insert(groupRow).select('id').single();
      if (error) console.error('Error creating group:', g.code, error);
      groupId = createdGroup?.id || null;
    }

    if (!groupId) continue;

    for (const val of g.values) {
      const valRow = {
        business_unit_id: businessId,
        option_group_id: groupId,
        code: val.code,
        label: val.label,
        price_delta: 0,
        is_active: true,
        sort_order: val.sort_order,
      };
      const { error } = await db.from('product_option_values').upsert(valRow, {
        onConflict: 'business_unit_id,option_group_id,code',
      });
      if (error) console.error('Error upserting option value:', val.code, error);
    }
  }

  return { ok: true, syncedProducts: productsToSync.length };
}
