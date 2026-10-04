-- Tuco & Nito - DEMO DEL RUBRO (complemento de demo_catedra.sql)
--
-- Carga lo que la demostracion base no puede traer porque vive en las migraciones 0011 y 0012:
--   - canchas de dos clientes (para ver la ficha de canchas y el equipamiento sugerido),
--   - los datos de la licitacion "Licitacion: equipamiento completo del predio" (organismo,
--     expediente, apertura dentro de 12 dias, monto oficial y garantia),
--   - UN presupuesto guardado y numerado (N° 000001) para "Dos arcos de futbol 5 para la cancha nueva".
--
-- Sirve para sacar las capturas del manual de usuario (npm run manual) con todas las pantallas del rubro, y para
-- mostrar esas funciones en una demostracion.
--
-- REQUIERE: demo_catedra.sql ya cargado y las migraciones 0011 y 0012 aplicadas
-- (supabase/aplicar/aplicar_0008_a_0012.sql). Sin ellas falla en la primera sentencia: no deja nada a medias.
--
-- ES RE-EJECUTABLE: las canchas y la licitacion tienen id fijo (se refrescan); el presupuesto se guarda UNA
-- sola vez (un presupuesto emitido no se modifica ni se borra, asi que no se repite).
--
-- Para sacarlo de la demo:
--     delete from public.canchas where organizacion_id = '11111111-1111-1111-1111-111111111111';
--     delete from public.licitaciones where organizacion_id = '11111111-1111-1111-1111-111111111111';
--   (el presupuesto no se puede borrar: se va solo si se borra la organizacion entera de la demo).

begin;

insert into public.canchas (id, organizacion_id, empresa_id, nombre, formato, superficie, cantidad, iluminacion, notas, activa) values
  ('ca1ca1ca-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'e1e1e1e1-0000-0000-0000-000000000002',
   'Canchas de fútbol 5', 'F5', 'sintetico', 6, true, 'Seis canchas de sintético con iluminación nocturna. Los arcos son de caño de 3 x 2 m.', true),
  ('ca1ca1ca-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'e1e1e1e1-0000-0000-0000-000000000001',
   'Cancha principal de fútbol 11', 'F11', 'natural', 1, true, 'Césped natural. Arcos reglamentarios de 7,32 x 2,44 m.', true)
on conflict (id) do update set
  nombre = excluded.nombre, formato = excluded.formato, superficie = excluded.superficie, cantidad = excluded.cantidad,
  iluminacion = excluded.iluminacion, notas = excluded.notas, activa = true;

insert into public.licitaciones (id, organizacion_id, oportunidad_id, expediente, organismo, fecha_apertura, monto_oficial, garantia) values
  ('1c1c1c1c-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'b1b1b1b1-0000-0000-0000-000000000008',
   'EXP-4059-2026', 'Secretaría de Deportes del Municipio', current_date + 12, 1850000, 'Seguro de caución por el 5 % del monto oficial')
on conflict (oportunidad_id) do update set
  expediente = excluded.expediente, organismo = excluded.organismo, fecha_apertura = excluded.fecha_apertura,
  monto_oficial = excluded.monto_oficial, garantia = excluded.garantia;

-- Un presupuesto emitido (el trigger le asigna el numero). Precios netos: la demo es Responsable Inscripto, asi
-- que el total lleva el IVA 21 % (2 x 180.000 = 360.000 neto; total 435.600).
insert into public.presupuestos (organizacion_id, oportunidad_id, validez_dias, condiciones, lineas, total, condicion_iva, emisor)
select o.id, 'b1b1b1b1-0000-0000-0000-000000000003', 15,
       'Precios netos de IVA. Entrega en 10 días hábiles desde la aprobación.',
       '[{"descripcion": "Arco de fútbol 5/7", "cantidad": 2, "precio_unitario": 180000, "descuento_pct": 0}]'::jsonb,
       435600, o.condicion_iva,
       jsonb_strip_nulls(jsonb_build_object('razon_social', o.razon_social, 'cuit', o.cuit, 'direccion', o.direccion,
                                            'telefono', o.telefono, 'email', o.email, 'sitio_web', o.sitio_web))
from public.organizaciones o
where o.id = '11111111-1111-1111-1111-111111111111'
  and not exists (
    select 1 from public.presupuestos p where p.oportunidad_id = 'b1b1b1b1-0000-0000-0000-000000000003'
  );

commit;

-- Resultado esperado: canchas 2, licitaciones 1, presupuestos 1 (o mas, si ya habia guardados).
select
  (select count(*) from public.canchas where organizacion_id = '11111111-1111-1111-1111-111111111111') as canchas,
  (select count(*) from public.licitaciones where organizacion_id = '11111111-1111-1111-1111-111111111111') as licitaciones,
  (select count(*) from public.presupuestos where organizacion_id = '11111111-1111-1111-1111-111111111111') as presupuestos;
