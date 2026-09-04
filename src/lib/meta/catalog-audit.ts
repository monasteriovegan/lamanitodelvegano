export type MetaCatalogProduct = {
  id: string;
  retailer_id: string;
  name: string;
  price: string;
  availability: string;
  image_url?: string;
  visibility?: string;
};

export type MetaCatalogFeed = {
  id: string;
  name: string;
  schedule?: Record<string, unknown>;
  created_time?: string;
  default_currency?: string;
  latest_upload?: {
    id?: string;
    start_time?: string;
    end_time?: string;
    status?: string;
    num_detected_items?: number;
    num_persisted_items?: number;
    num_invalid_items?: number;
    error_count?: number;
    warning_count?: number;
  };
};

export type MetaCatalogAuditResult = {
  ok: boolean;
  catalogId: string;
  catalogName?: string;
  businessOwnerId?: string;
  productCount?: number;
  products: MetaCatalogProduct[];
  feeds: MetaCatalogFeed[];
  pixelConnected: boolean;
  pixelId?: string;
  diagnostics?: Record<string, unknown>;
  error?: string;
};

export async function fetchMetaCatalogAudit(input: {
  catalogId: string;
  pixelId?: string;
  token: string;
  version?: string;
}): Promise<MetaCatalogAuditResult> {
  const version = input.version || process.env.META_GRAPH_VERSION || 'v26.0';
  const headers = { Authorization: `Bearer ${input.token}` };

  try {
    const catalogRes = await fetch(
      `https://graph.facebook.com/${version}/${encodeURIComponent(input.catalogId)}?fields=id,name,business,product_count,feed_count`,
      { headers, cache: 'no-store' },
    );
    const catalogData = await catalogRes.json();
    if (!catalogRes.ok) {
      return {
        ok: false,
        catalogId: input.catalogId,
        error: `meta_catalog_error_${catalogRes.status}:${catalogData?.error?.message || 'unknown'}`,
        products: [],
        feeds: [],
        pixelConnected: false,
      };
    }

    let feeds: MetaCatalogFeed[] = [];
    try {
      const feedsRes = await fetch(
        `https://graph.facebook.com/${version}/${encodeURIComponent(input.catalogId)}/product_feeds?fields=id,name,schedule,created_time,default_currency,latest_upload{id,start_time,end_time,status,num_detected_items,num_persisted_items,num_invalid_items,error_count,warning_count}`,
        { headers, cache: 'no-store' },
      );
      const feedsData = await feedsRes.json();
      if (Array.isArray(feedsData?.data)) feeds = feedsData.data;
    } catch {}

    let products: MetaCatalogProduct[] = [];
    try {
      const prodsRes = await fetch(
        `https://graph.facebook.com/${version}/${encodeURIComponent(input.catalogId)}/products?fields=id,retailer_id,name,price,availability,image_url,visibility&limit=100`,
        { headers, cache: 'no-store' },
      );
      const prodsData = await prodsRes.json();
      if (Array.isArray(prodsData?.data)) products = prodsData.data;
    } catch {}

    let diagnostics: Record<string, unknown> | undefined;
    try {
      const diagRes = await fetch(
        `https://graph.facebook.com/${version}/${encodeURIComponent(input.catalogId)}/diagnostics`,
        { headers, cache: 'no-store' },
      );
      if (diagRes.ok) diagnostics = await diagRes.json();
    } catch {}

    let pixelConnected = false;
    if (input.pixelId) {
      try {
        const pixRes = await fetch(
          `https://graph.facebook.com/${version}/${encodeURIComponent(input.pixelId)}?fields=id,name,last_fired_time,is_unavailable`,
          { headers, cache: 'no-store' },
        );
        pixelConnected = pixRes.ok;
      } catch {}
    }

    return {
      ok: true,
      catalogId: input.catalogId,
      catalogName: catalogData.name,
      businessOwnerId: catalogData.business?.id,
      productCount: catalogData.product_count,
      products,
      feeds,
      pixelConnected,
      pixelId: input.pixelId,
      diagnostics,
    };
  } catch (error) {
    return {
      ok: false,
      catalogId: input.catalogId,
      error: error instanceof Error ? error.message : 'catalog_fetch_exception',
      products: [],
      feeds: [],
      pixelConnected: false,
    };
  }
}
