import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase/require-role';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

type GraphPage<T> = { data?: T[]; error?: { message?: string; code?: number } };
type MetaRecord = Record<string, unknown> & { id: string; name?: string };

async function graph<T>(path: string, token: string, params: Record<string, string> = {}) {
  const version = process.env.META_GRAPH_VERSION || 'v26.0';
  const url = new URL(`https://graph.facebook.com/${version}/${path}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  url.searchParams.set('access_token', token);
  const response = await fetch(url, { cache: 'no-store' });
  const body = (await response.json()) as GraphPage<T>;
  if (!response.ok) throw new Error(`meta_graph_${body.error?.code || response.status}:${body.error?.message || 'request_failed'}`);
  return body.data || [];
}

async function optionalGraph<T>(path: string, token: string, params: Record<string, string> = {}) {
  try {
    return { data: await graph<T>(path, token, params), error: null };
  } catch (error) {
    return { data: [] as T[], error: error instanceof Error ? error.message : 'unknown_error' };
  }
}

export async function GET() {
  await requireRole(['admin']);
  const db = createSupabaseServiceClient();
  const { data: config } = await db
    .from('integraciones_secretas')
    .select('wa_access_token,meta_pixel_id,ga4_measurement_id')
    .eq('id', 'global')
    .maybeSingle();

  if (!config?.wa_access_token) return NextResponse.json({ error: 'meta_token_not_configured' }, { status: 503 });

  const accounts = await graph<MetaRecord>('me/adaccounts', config.wa_access_token, {
    fields: 'id,account_id,name,account_status,business{id,name},currency,timezone_name',
    limit: '100',
  });

  const auditedAccounts = await Promise.all(accounts.map(async (account) => {
    const campaignsResult = await optionalGraph<MetaRecord>(`${account.id}/campaigns`, config.wa_access_token, {
      fields: 'id,name,status,effective_status,objective,buying_type,daily_budget,lifetime_budget,budget_remaining,bid_strategy,start_time,stop_time,special_ad_categories',
      limit: '500',
    });
    const campaigns = campaignsResult.data.filter((campaign) => /barra|dub[aá]i/i.test(campaign.name || ''));
    const campaignIds = campaigns.map((campaign) => campaign.id);

    const business = account.business as MetaRecord | undefined;
    const [adSetsResult, adsResult, insightsResult, pixelsResult, businessPixelsResult] = await Promise.all([
      campaignIds.length ? optionalGraph<MetaRecord>(`${account.id}/adsets`, config.wa_access_token, {
        fields: 'id,campaign_id,name,status,effective_status,daily_budget,lifetime_budget,bid_strategy,billing_event,optimization_goal,attribution_spec,promoted_object,targeting,start_time,end_time',
        filtering: JSON.stringify([{ field: 'campaign.id', operator: 'IN', value: campaignIds }]),
        limit: '500',
      }) : Promise.resolve({ data: [], error: null }),
      campaignIds.length ? optionalGraph<MetaRecord>(`${account.id}/ads`, config.wa_access_token, {
        fields: 'id,campaign_id,adset_id,name,status,effective_status,tracking_specs,conversion_specs,creative{id,name,object_story_id,effective_object_story_id,instagram_actor_id,thumbnail_url,object_type,asset_feed_spec,object_story_spec,url_tags,call_to_action_type}',
        filtering: JSON.stringify([{ field: 'campaign.id', operator: 'IN', value: campaignIds }]),
        limit: '500',
      }) : Promise.resolve({ data: [], error: null }),
      campaignIds.length ? optionalGraph<MetaRecord>(`${account.id}/insights`, config.wa_access_token, {
        fields: 'campaign_id,adset_id,ad_id,ad_name,impressions,reach,frequency,spend,cpm,cpc,ctr,clicks,inline_link_clicks,actions,cost_per_action_type,date_start,date_stop',
        filtering: JSON.stringify([{ field: 'campaign.id', operator: 'IN', value: campaignIds }]),
        date_preset: 'maximum',
        level: 'ad',
        limit: '500',
      }) : Promise.resolve({ data: [], error: null }),
      optionalGraph<MetaRecord>(`${account.id}/adspixels`, config.wa_access_token, {
        fields: 'id,name,last_fired_time,is_unavailable',
        limit: '100',
      }),
      business?.id ? optionalGraph<MetaRecord>(`${business.id}/owned_pixels`, config.wa_access_token, {
        fields: 'id,name,last_fired_time,is_unavailable',
        limit: '100',
      }) : Promise.resolve({ data: [], error: null }),
    ]);

    return {
      account,
      campaigns,
      adSets: adSetsResult.data,
      ads: adsResult.data,
      insights: insightsResult.data,
      pixels: pixelsResult.data,
      businessPixels: businessPixelsResult.data,
      errors: [campaignsResult.error, adSetsResult.error, adsResult.error, insightsResult.error, pixelsResult.error, businessPixelsResult.error].filter(Boolean),
    };
  }));

  return NextResponse.json({
    configured: {
      metaPixelId: config.meta_pixel_id || null,
      ga4MeasurementId: config.ga4_measurement_id || null,
    },
    accounts: auditedAccounts,
    generatedAt: new Date().toISOString(),
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export const dynamic = 'force-dynamic';
