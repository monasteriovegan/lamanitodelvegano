begin;

-- La FK pedidos.shipping_zone_id usa ON DELETE SET NULL y cada pedido guarda
-- shipping_zone_name/costo_envio como snapshot. Por eso podemos retirar las
-- zonas antiguas sin alterar el valor histórico de los pedidos existentes.
delete from public.zonas;

insert into public.zonas (nombre, comunas, precio) values
  ('SUR', 'San Miguel, La Cisterna, San Joaquín, La Granja, San Ramón, El Bosque, Lo Espejo, Pedro Aguirre Cerda, La Pintana', 3500),
  ('CENTRO', 'Santiago Centro, Independencia, Recoleta, Quinta Normal, Estación Central', 4000),
  ('PONIENTE', 'Cerrillos, Lo Prado, Cerro Navia, Pudahuel, Maipú, Renca, Padre Hurtado', 5000),
  ('NORTE', 'Conchalí, Huechuraba, Quilicura, Colina, Lampa, Tiltil', 6000),
  ('ORIENTE', 'Ñuñoa, Macul, La Reina, Peñalolén, Providencia, Las Condes, Vitacura, Lo Barnechea, La Florida', 5000),
  ('CORDILLERA', 'Puente Alto, Pirque, San José de Maipo', 6000),
  ('SUR RM', 'San Bernardo, Buin, Calera de Tango, Paine', 7000),
  ('PONIENTE RM', 'Peñaflor, Talagante, El Monte, Isla de Maipo, Melipilla, María Pinto, Curacaví', 8000);

commit;
