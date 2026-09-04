do $$
declare
  target_season_id uuid;
  target_business_id uuid;
begin
  select id, business_unit_id
    into target_season_id, target_business_id
  from public.seasons
  where campaign_tag = 'fiestas-patrias-2026'
  order by created_at desc
  limit 1;

  if target_season_id is null then
    return;
  end if;

  -- Pin the currently approved campaign prices as seasonal overrides.
  -- We intentionally do NOT rewrite or invent historical master prices.
  insert into public.season_variant_overrides (
    business_unit_id,
    season_id,
    variant_id,
    price_override,
    compare_at_price_override,
    is_active
  )
  select
    target_business_id,
    target_season_id,
    v.id,
    v.price,
    v.compare_at_price,
    true
  from public.season_products sp
  join public.product_variants v
    on v.product_id = sp.product_id
   and v.business_unit_id = target_business_id
  where sp.season_id = target_season_id
  on conflict (season_id, variant_id) do update
  set price_override = excluded.price_override,
      compare_at_price_override = excluded.compare_at_price_override,
      is_active = true,
      updated_at = now();
end $$;
