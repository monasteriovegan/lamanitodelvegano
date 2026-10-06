-- Ventana de entrega aprobada para la campaña Especial fin de semana.
-- Sábado 3 y lunes 5 a sábado 10 de octubre de 2026; domingos excluidos.
do $$
declare
  v_business uuid := 'f3b57ce7-0796-40e5-94f1-07cb2b48ba85';
  v_delivery_dates text := '2026-10-03, 2026-10-05, 2026-10-06, 2026-10-07, 2026-10-08, 2026-10-09, 2026-10-10';
begin
  update public.productos p
  set disponibilidad = v_delivery_dates
  where p.business_unit_id = v_business
    and p.activo = true
    and exists (
      select 1
      from public.season_products sp
      join public.seasons s on s.id = sp.season_id
      where sp.product_id = p.id
        and s.business_unit_id = v_business
        and s.campaign_tag = 'especial-fin-de-semana'
    );
end $$;
