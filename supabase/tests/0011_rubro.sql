-- Tuco & Nito - PRUEBA DE LAS FUNCIONES DEL RUBRO (0011)
--
-- Correr en el SQL Editor de Supabase DESPUES de aplicar la 0011 (o, para
-- ensayarla sin aplicarla: `begin;` + la migracion + este archivo; el ROLLBACK
-- de aca abajo deshace las dos cosas).
--
-- Prueba, como lo hace la app (rol `authenticated` + el JWT de cada usuario) y
-- como postgres (sin usuario):
--   a) canchas: CHECKs, aislamiento entre organizaciones, cartera propia del
--      Vendedor (hereda la de la empresa), permisos de solo lectura, sin DELETE
--      y baja logica por `activa`;
--   b) licitaciones: una por oportunidad, mismos permisos y cartera que la
--      oportunidad, aislamiento entre organizaciones y clave foranea compuesta;
--   c) la regla "una licitacion no pasa a ganada antes de su apertura" (fecha de
--      Argentina), por update directo y por la RPC cambiar_etapa; una licitacion
--      sin datos tampoco se gana; las oportunidades directas no se ven afectadas;
--   d) oportunidades.venta_item_id: clave foranea compuesta (no cruza
--      organizaciones), `on delete set null` (deshacer una venta no borra la
--      oportunidad) y una sola oportunidad ABIERTA por equipo (indice unico parcial).
--
-- Los casos negativos verifican el CODIGO y el MENSAJE del error.
--
-- NO DEJA NADA EN LA BASE: todo corre dentro de una transaccion con ROLLBACK.
--
-- Resultado esperado: una fila que dice "TODO OK". Si algo falla, se corta con
-- un ERROR que empieza con "FALLA:".
--
-- Ids: organizacion A c1100000-..., B c2200000-...; usuarios ...-1111-...-0N:
--   A: 01 admin, 02 vendedor, 03 solo lectura;  B: 04 admin.

begin;

create function pg_temp.debe_fallar(p_sql text, p_sqlstate text, p_mensaje text, p_falla text)
returns void language plpgsql as $f$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlstate = p_sqlstate and sqlerrm like p_mensaje then
      return;
    end if;
    raise exception 'FALLA: % (fallo, pero por otro motivo: [%] %)', p_falla, sqlstate, sqlerrm;
  end;
  raise exception 'FALLA: %', p_falla;
end $f$;

grant execute on function pg_temp.debe_fallar(text, text, text, text) to authenticated, anon;

insert into public.organizaciones (id, nombre) values
  ('c1100000-0000-0000-0000-000000000000', 'TEST 0011 Org A'),
  ('c2200000-0000-0000-0000-000000000000', 'TEST 0011 Org B');

insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select v.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', v.email,
       jsonb_build_object('organizacion_id', v.org,
                          'rol_id', (select id from public.roles where organizacion_id = v.org and nombre = v.rol)),
       jsonb_build_object('nombre', v.email), now(), now()
from (values
  ('c1100000-1111-0000-0000-000000000001'::uuid, 'c11.admin@test.invalid', 'Administrador', 'c1100000-0000-0000-0000-000000000000'::uuid),
  ('c1100000-1111-0000-0000-000000000002'::uuid, 'c11.vend@test.invalid',  'Vendedor',      'c1100000-0000-0000-0000-000000000000'::uuid),
  ('c1100000-1111-0000-0000-000000000003'::uuid, 'c11.lect@test.invalid',  'Solo lectura',  'c1100000-0000-0000-0000-000000000000'::uuid),
  ('c2200000-1111-0000-0000-000000000004'::uuid, 'c22.admin@test.invalid', 'Administrador', 'c2200000-0000-0000-0000-000000000000'::uuid)
) as v(id, email, rol, org);

-- Empresas: A1 es del admin, A2 del vendedor (su cartera), B1 de la otra organizacion.
insert into public.empresas (id, organizacion_id, nombre, responsable_id) values
  ('c1100000-2222-0000-0000-000000000001', 'c1100000-0000-0000-0000-000000000000', 'A1 Club del admin',  'c1100000-1111-0000-0000-000000000001'),
  ('c1100000-2222-0000-0000-000000000002', 'c1100000-0000-0000-0000-000000000000', 'A2 Club del vendedor', 'c1100000-1111-0000-0000-000000000002'),
  ('c2200000-2222-0000-0000-000000000001', 'c2200000-0000-0000-0000-000000000000', 'B1 Club de B',        'c2200000-1111-0000-0000-000000000004');

-- Oportunidades (como postgres, sin usuario): una directa de A1, una licitacion
-- de A1 (del admin), una licitacion de A2 (del vendedor), una de B1.
insert into public.oportunidades (id, organizacion_id, titulo, empresa_id, responsable_id, etapa_id, tipo)
select v.id, v.org, v.titulo, v.empresa, v.resp, e.id, v.tipo
from (values
  ('c1100000-5555-0000-0000-000000000001'::uuid, 'c1100000-0000-0000-0000-000000000000'::uuid, 'Directa A1',      'c1100000-2222-0000-0000-000000000001'::uuid, 'c1100000-1111-0000-0000-000000000001'::uuid, 'directa'),
  ('c1100000-5555-0000-0000-000000000002'::uuid, 'c1100000-0000-0000-0000-000000000000'::uuid, 'Licitacion A1',   'c1100000-2222-0000-0000-000000000001'::uuid, 'c1100000-1111-0000-0000-000000000001'::uuid, 'licitacion'),
  ('c1100000-5555-0000-0000-000000000003'::uuid, 'c1100000-0000-0000-0000-000000000000'::uuid, 'Licitacion A2',   'c1100000-2222-0000-0000-000000000002'::uuid, 'c1100000-1111-0000-0000-000000000002'::uuid, 'licitacion'),
  ('c1100000-5555-0000-0000-000000000004'::uuid, 'c1100000-0000-0000-0000-000000000000'::uuid, 'Licitacion sin datos', 'c1100000-2222-0000-0000-000000000001'::uuid, 'c1100000-1111-0000-0000-000000000001'::uuid, 'licitacion'),
  ('c2200000-5555-0000-0000-000000000001'::uuid, 'c2200000-0000-0000-0000-000000000000'::uuid, 'Licitacion B1',   'c2200000-2222-0000-0000-000000000001'::uuid, 'c2200000-1111-0000-0000-000000000004'::uuid, 'licitacion'),
  ('c2200000-5555-0000-0000-000000000002'::uuid, 'c2200000-0000-0000-0000-000000000000'::uuid, 'Licitacion B1 sin datos', 'c2200000-2222-0000-0000-000000000001'::uuid, 'c2200000-1111-0000-0000-000000000004'::uuid, 'licitacion')
) as v(id, org, titulo, empresa, resp, tipo)
join public.etapas e on e.organizacion_id = v.org and e.orden = 1;

-- Una venta con un item (equipo entregado) en A1 y otra en B1.
insert into public.productos (id, organizacion_id, nombre, vida_util_meses) values
  ('c1100000-aaaa-0000-0000-000000000001', 'c1100000-0000-0000-0000-000000000000', 'Arco 0011', 24),
  ('c2200000-aaaa-0000-0000-000000000001', 'c2200000-0000-0000-0000-000000000000', 'Arco 0011 B', 24);
insert into public.ventas (id, organizacion_id, empresa_id, fecha) values
  ('c1100000-6666-0000-0000-000000000001', 'c1100000-0000-0000-0000-000000000000', 'c1100000-2222-0000-0000-000000000001', current_date - 800),
  ('c2200000-6666-0000-0000-000000000001', 'c2200000-0000-0000-0000-000000000000', 'c2200000-2222-0000-0000-000000000001', current_date - 800);
insert into public.venta_items (id, organizacion_id, venta_id, producto_id, cantidad, precio_unitario) values
  ('c1100000-7777-0000-0000-000000000001', 'c1100000-0000-0000-0000-000000000000', 'c1100000-6666-0000-0000-000000000001', 'c1100000-aaaa-0000-0000-000000000001', 2, 450000),
  ('c2200000-7777-0000-0000-000000000001', 'c2200000-0000-0000-0000-000000000000', 'c2200000-6666-0000-0000-000000000001', 'c2200000-aaaa-0000-0000-000000000001', 1, 450000);

-- Datos de licitacion cargados por postgres: la de A1 abre mañana, la de A2 abrio
-- hace una semana, la de B1 abrio hace una semana.
insert into public.licitaciones (id, organizacion_id, oportunidad_id, expediente, organismo, fecha_apertura) values
  ('c1100000-9999-0000-0000-000000000001', 'c1100000-0000-0000-0000-000000000000', 'c1100000-5555-0000-0000-000000000002',
   'EX-2026-001', 'Municipalidad de A', ((now() at time zone 'America/Argentina/Buenos_Aires')::date + 1)),
  ('c1100000-9999-0000-0000-000000000002', 'c1100000-0000-0000-0000-000000000000', 'c1100000-5555-0000-0000-000000000003',
   'EX-2026-002', 'Municipalidad de A2', ((now() at time zone 'America/Argentina/Buenos_Aires')::date - 7)),
  ('c2200000-9999-0000-0000-000000000001', 'c2200000-0000-0000-0000-000000000000', 'c2200000-5555-0000-0000-000000000001',
   'EX-B', 'Municipalidad de B', ((now() at time zone 'America/Argentina/Buenos_Aires')::date - 7));

-- Una cancha de A1 y otra de A2 cargadas por postgres.
insert into public.canchas (id, organizacion_id, empresa_id, nombre, formato, cantidad) values
  ('c1100000-8888-0000-0000-000000000001', 'c1100000-0000-0000-0000-000000000000', 'c1100000-2222-0000-0000-000000000001', 'Canchas F5 de A1', 'F5', 4),
  ('c1100000-8888-0000-0000-000000000002', 'c1100000-0000-0000-0000-000000000000', 'c1100000-2222-0000-0000-000000000002', 'Cancha F11 de A2', 'F11', 1);

-- ══ COMO POSTGRES: reglas de datos que no dependen del usuario ════════════════
do $$
declare
  org constant uuid := 'c1100000-0000-0000-0000-000000000000';
  v_ganada uuid := (select id from public.etapas where organizacion_id = org and tipo = 'ganada' limit 1);
  v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  -- (a) CHECKs de canchas
  perform pg_temp.debe_fallar(
    $q$insert into public.canchas (organizacion_id, empresa_id, nombre, formato) values ('c1100000-0000-0000-0000-000000000000', 'c1100000-2222-0000-0000-000000000001', 'X', 'F6')$q$,
    '23514', '%canchas_formato_check%', 'se creo una cancha con un formato inexistente');
  perform pg_temp.debe_fallar(
    $q$insert into public.canchas (organizacion_id, empresa_id, nombre, formato, cantidad) values ('c1100000-0000-0000-0000-000000000000', 'c1100000-2222-0000-0000-000000000001', 'X', 'F5', 0)$q$,
    '23514', '%canchas_cantidad_check%', 'se creo una cancha con cantidad 0');
  perform pg_temp.debe_fallar(
    $q$insert into public.canchas (organizacion_id, empresa_id, nombre, formato) values ('c1100000-0000-0000-0000-000000000000', 'c1100000-2222-0000-0000-000000000001', '   ', 'F5')$q$,
    '23514', '%canchas_nombre_check%', 'se creo una cancha sin nombre');
  perform pg_temp.debe_fallar(
    $q$insert into public.canchas (organizacion_id, empresa_id, nombre, formato, superficie) values ('c1100000-0000-0000-0000-000000000000', 'c1100000-2222-0000-0000-000000000001', 'X', 'F5', 'arena')$q$,
    '23514', '%canchas_superficie_check%', 'se creo una cancha con una superficie inexistente');
  -- (a) FK compuesta: una cancha de la org A no puede colgar de una empresa de la org B
  perform pg_temp.debe_fallar(
    $q$insert into public.canchas (organizacion_id, empresa_id, nombre, formato) values ('c1100000-0000-0000-0000-000000000000', 'c2200000-2222-0000-0000-000000000001', 'X', 'F5')$q$,
    '23503', '%canchas_empresa_id_fkey%', 'una cancha de la org A colgo de una empresa de la org B');

  -- (b) una licitacion por oportunidad, con fecha de apertura obligatoria
  perform pg_temp.debe_fallar(
    $q$insert into public.licitaciones (organizacion_id, oportunidad_id, fecha_apertura) values ('c1100000-0000-0000-0000-000000000000', 'c1100000-5555-0000-0000-000000000002', current_date)$q$,
    '23505', '%licitaciones_oportunidad_key%', 'se creo una segunda licitacion para la misma oportunidad');
  perform pg_temp.debe_fallar(
    $q$insert into public.licitaciones (organizacion_id, oportunidad_id, fecha_apertura) values ('c1100000-0000-0000-0000-000000000000', 'c1100000-5555-0000-0000-000000000004', null)$q$,
    '23502', '%fecha_apertura%', 'se creo una licitacion sin fecha de apertura');
  perform pg_temp.debe_fallar(
    $q$insert into public.licitaciones (organizacion_id, oportunidad_id, fecha_apertura, monto_oficial) values ('c1100000-0000-0000-0000-000000000000', 'c1100000-5555-0000-0000-000000000004', current_date, -1)$q$,
    '23514', '%licitaciones_monto_oficial_check%', 'se creo una licitacion con monto oficial negativo');
  -- (b) FK compuesta: org A no puede colgar una licitacion de una oportunidad de B
  perform pg_temp.debe_fallar(
    $q$insert into public.licitaciones (organizacion_id, oportunidad_id, fecha_apertura) values ('c1100000-0000-0000-0000-000000000000', 'c2200000-5555-0000-0000-000000000002', current_date)$q$,
    '23503', '%licitaciones_oportunidad_id_fkey%', 'una licitacion de la org A colgo de una oportunidad de la org B');

  -- (c) la regla rige tambien sin usuario (postgres): abre mañana, no se gana hoy
  perform pg_temp.debe_fallar(
    format($q$update public.oportunidades set etapa_id = %L where id = 'c1100000-5555-0000-0000-000000000002'$q$, v_ganada),
    '23514', 'No se puede marcar ganada una licitación antes de su apertura (fecha de apertura: %)%',
    'postgres gano una licitacion que abre mañana');
  -- el mensaje trae la fecha en dd/mm/aaaa
  perform pg_temp.debe_fallar(
    format($q$update public.oportunidades set etapa_id = %L where id = 'c1100000-5555-0000-0000-000000000002'$q$, v_ganada),
    '23514', '%' || to_char(v_hoy + 1, 'DD/MM/YYYY') || '%', 'el mensaje no trae la fecha de apertura');
  -- sin datos de licitacion, tampoco
  perform pg_temp.debe_fallar(
    format($q$update public.oportunidades set etapa_id = %L where id = 'c1100000-5555-0000-0000-000000000004'$q$, v_ganada),
    '23514', 'Una licitación necesita sus datos%', 'se gano una licitacion sin fila en licitaciones');
  -- ni siquiera naciendo ganada
  perform pg_temp.debe_fallar(
    format($q$insert into public.oportunidades (organizacion_id, titulo, empresa_id, etapa_id, tipo) values ('c1100000-0000-0000-0000-000000000000', 'Nace ganada', 'c1100000-2222-0000-0000-000000000001', %L, 'licitacion')$q$, v_ganada),
    '23514', 'Una licitación necesita sus datos%', 'nacio ganada una licitacion sin datos');

  -- una directa se gana sin mirar nada
  update public.oportunidades set etapa_id = v_ganada where id = 'c1100000-5555-0000-0000-000000000001';
  if (select estado from public.oportunidades where id = 'c1100000-5555-0000-0000-000000000001') <> 'ganada' then
    raise exception 'FALLA: una oportunidad directa no pudo ganarse';
  end if;

  -- una licitacion que ya abrio se gana (A2, abrio hace 7 dias)
  update public.oportunidades set etapa_id = v_ganada where id = 'c1100000-5555-0000-0000-000000000003';
  if (select estado from public.oportunidades where id = 'c1100000-5555-0000-0000-000000000003') <> 'ganada' then
    raise exception 'FALLA: una licitacion ya abierta no pudo ganarse';
  end if;

  -- el dia de la apertura ya se puede ganar: se adelanta la apertura a hoy (AR)
  update public.licitaciones set fecha_apertura = v_hoy where id = 'c1100000-9999-0000-0000-000000000001';
  update public.oportunidades set etapa_id = v_ganada where id = 'c1100000-5555-0000-0000-000000000002';
  if (select estado from public.oportunidades where id = 'c1100000-5555-0000-0000-000000000002') <> 'ganada' then
    raise exception 'FALLA: una licitacion que abre hoy no pudo ganarse';
  end if;

  -- una licitacion ya ganada se sigue pudiendo editar aunque su apertura quede en el futuro (no es una transicion)
  update public.licitaciones set fecha_apertura = v_hoy + 30 where id = 'c1100000-9999-0000-0000-000000000001';
  update public.oportunidades set titulo = 'Licitacion A1 editada' where id = 'c1100000-5555-0000-0000-000000000002';
  if (select titulo from public.oportunidades where id = 'c1100000-5555-0000-0000-000000000002') <> 'Licitacion A1 editada' then
    raise exception 'FALLA: no se pudo editar una licitacion ya ganada';
  end if;

  -- (d) venta_item_id: la FK compuesta no cruza organizaciones
  perform pg_temp.debe_fallar(
    $q$update public.oportunidades set venta_item_id = 'c1100000-7777-0000-0000-000000000001' where id = 'c2200000-5555-0000-0000-000000000001'$q$,
    '23503', '%oportunidades_venta_item_id_fkey%', 'una oportunidad de B apunto a un equipo de A');
  update public.oportunidades set venta_item_id = 'c1100000-7777-0000-0000-000000000001' where id = 'c1100000-5555-0000-0000-000000000004';
  -- deshacer la venta (cascade a venta_items) no borra la oportunidad: queda sin vinculo
  delete from public.ventas where id = 'c1100000-6666-0000-0000-000000000001';
  if not exists (select 1 from public.oportunidades where id = 'c1100000-5555-0000-0000-000000000004' and venta_item_id is null) then
    raise exception 'FALLA: borrar la venta no dejo la oportunidad sin venta_item_id (o la borro)';
  end if;
end $$;

-- Reinicio los datos que las pruebas de arriba movieron (todo sigue en la misma transaccion).
-- La licitacion de A1 vuelve a abrir mañana; la oportunidad vuelve a una etapa abierta con reabrir implicito de postgres.
update public.oportunidades set etapa_id = (select id from public.etapas where organizacion_id = 'c1100000-0000-0000-0000-000000000000' and orden = 1)
where id = 'c1100000-5555-0000-0000-000000000002';

-- ══ SOY EL ADMINISTRADOR DE A ═════════════════════════════════════════════════
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c1100000-1111-0000-0000-000000000001","role":"authenticated"}', true);

do $$
declare
  org constant uuid := 'c1100000-0000-0000-0000-000000000000';
  v_ganada uuid := (select id from public.etapas where organizacion_id = org and tipo = 'ganada' limit 1);
  v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_n int;
  v_fila public.canchas;
begin
  -- canchas: ve las dos de su organizacion, crea, edita, da de baja; no borra
  if (select count(*) from public.canchas) <> 2 then
    raise exception 'FALLA: el admin de A no ve las 2 canchas de su organizacion (ve %)', (select count(*) from public.canchas);
  end if;
  insert into public.canchas (empresa_id, nombre, formato, superficie, cantidad, iluminacion)
  values ('c1100000-2222-0000-0000-000000000001', 'Canchas F7', 'F7', 'sintetico', 2, true) returning * into v_fila;
  if v_fila.organizacion_id <> org or v_fila.activa is not true then
    raise exception 'FALLA: la cancha nueva no quedo en la organizacion del admin y activa';
  end if;
  update public.canchas set activa = false, nombre = 'Canchas F7 (baja)' where id = v_fila.id;
  if (select activa from public.canchas where id = v_fila.id) then
    raise exception 'FALLA: no se pudo dar de baja una cancha (activa = false)';
  end if;
  if (select updated_at from public.canchas where id = v_fila.id) < v_fila.updated_at then
    raise exception 'FALLA: updated_at de la cancha no se actualizo';
  end if;
  delete from public.canchas where id = v_fila.id;
  get diagnostics v_n = row_count;
  if v_n <> 0 or not exists (select 1 from public.canchas where id = v_fila.id) then
    raise exception 'FALLA: un usuario pudo borrar una cancha (no hay politica de DELETE)';
  end if;
  -- no puede escribir en la otra organizacion
  perform pg_temp.debe_fallar(
    $q$insert into public.canchas (organizacion_id, empresa_id, nombre, formato) values ('c2200000-0000-0000-0000-000000000000', 'c2200000-2222-0000-0000-000000000001', 'Intruso', 'F5')$q$,
    '42501', '%row-level security%', 'el admin de A creo una cancha en la organizacion B');

  -- licitaciones: ve las 3 de su organizacion (A1, A2 y la sin datos no tiene), nunca la de B
  if (select count(*) from public.licitaciones) <> 2 then
    raise exception 'FALLA: el admin de A deberia ver 2 licitaciones y ve %', (select count(*) from public.licitaciones);
  end if;
  if exists (select 1 from public.licitaciones where organizacion_id <> org) then
    raise exception 'FALLA: el admin de A ve una licitacion de otra organizacion';
  end if;
  perform pg_temp.debe_fallar(
    $q$insert into public.licitaciones (oportunidad_id, fecha_apertura) values ('c2200000-5555-0000-0000-000000000002', current_date)$q$,
    '23503', '%licitaciones_oportunidad_id_fkey%', 'el admin de A colgo una licitacion de una oportunidad de B');
  delete from public.licitaciones where oportunidad_id = 'c1100000-5555-0000-0000-000000000002';
  get diagnostics v_n = row_count;
  if v_n <> 0 then
    raise exception 'FALLA: un usuario pudo borrar una licitacion (no hay politica de DELETE)';
  end if;

  -- carga de los datos de la licitacion sin datos (como lo hace el formulario: upsert)
  insert into public.licitaciones (oportunidad_id, expediente, organismo, fecha_apertura, monto_oficial, garantia)
  values ('c1100000-5555-0000-0000-000000000004', 'EX-9', 'Municipalidad', v_hoy + 3, 1500000, '1% de la oferta')
  on conflict (oportunidad_id) do update set fecha_apertura = excluded.fecha_apertura;
  if (select organizacion_id from public.licitaciones where oportunidad_id = 'c1100000-5555-0000-0000-000000000004') <> org then
    raise exception 'FALLA: la licitacion nueva no quedo en la organizacion del admin';
  end if;

  -- la regla por update directo y por la RPC cambiar_etapa, ahora como usuario
  perform pg_temp.debe_fallar(
    format($q$update public.oportunidades set etapa_id = %L where id = 'c1100000-5555-0000-0000-000000000004'$q$, v_ganada),
    '23514', 'No se puede marcar ganada una licitación antes de su apertura%', 'el admin gano una licitacion que abre en 3 dias (update)');
  perform pg_temp.debe_fallar(
    format($q$select public.cambiar_etapa('c1100000-5555-0000-0000-000000000004', %L)$q$, v_ganada),
    '23514', 'No se puede marcar ganada una licitación antes de su apertura%', 'el admin gano una licitacion que abre en 3 dias (cambiar_etapa)');
  if (select estado from public.oportunidades where id = 'c1100000-5555-0000-0000-000000000004') <> 'abierta' then
    raise exception 'FALLA: la licitacion quedo cerrada a pesar del rechazo';
  end if;
  -- el dia de la apertura se puede
  update public.licitaciones set fecha_apertura = v_hoy where oportunidad_id = 'c1100000-5555-0000-0000-000000000004';
  perform public.cambiar_etapa('c1100000-5555-0000-0000-000000000004', v_ganada, 'Adjudicada');
  if (select estado from public.oportunidades where id = 'c1100000-5555-0000-0000-000000000004') <> 'ganada' then
    raise exception 'FALLA: la licitacion no se gano el dia de su apertura por cambiar_etapa';
  end if;

  -- recambio: el admin crea una oportunidad ligada a un equipo (el item de A se borro arriba; creo otro)
  insert into public.ventas (empresa_id, fecha) values ('c1100000-2222-0000-0000-000000000001', current_date - 800);
  insert into public.venta_items (venta_id, producto_id, cantidad, precio_unitario)
  select v.id, 'c1100000-aaaa-0000-0000-000000000001', 3, 100 from public.ventas v
  where v.empresa_id = 'c1100000-2222-0000-0000-000000000001' and v.id <> 'c1100000-6666-0000-0000-000000000001' limit 1;
  insert into public.oportunidades (titulo, empresa_id, etapa_id, venta_item_id)
  select 'Recambio: Arco 0011 — A1', 'c1100000-2222-0000-0000-000000000001', e.id, vi.id
  from public.venta_items vi, public.etapas e
  where e.organizacion_id = org and e.orden = 1 and vi.producto_id = 'c1100000-aaaa-0000-0000-000000000001';
  if not exists (select 1 from public.oportunidades where titulo like 'Recambio: Arco 0011%' and venta_item_id is not null) then
    raise exception 'FALLA: no se pudo crear una oportunidad de recambio con venta_item_id';
  end if;

  -- una sola oportunidad ABIERTA por equipo (indice unico parcial): la segunda falla…
  perform pg_temp.debe_fallar(
    format($q$insert into public.oportunidades (titulo, empresa_id, etapa_id, venta_item_id)
              select 'Recambio duplicado', 'c1100000-2222-0000-0000-000000000001', e.id, vi.id
              from public.venta_items vi, public.etapas e
              where e.organizacion_id = %L and e.orden = 1 and vi.producto_id = 'c1100000-aaaa-0000-0000-000000000001'$q$, org),
    '23505', '%oportunidades_venta_item_abierta_key%', 'se creo una segunda oportunidad abierta para el mismo equipo');
  -- …otro equipo no se ve afectado (una oportunidad sin equipo, tampoco)…
  insert into public.oportunidades (titulo, empresa_id, etapa_id)
  select 'Sin equipo 1', 'c1100000-2222-0000-0000-000000000001', e.id from public.etapas e where e.organizacion_id = org and e.orden = 1;
  insert into public.oportunidades (titulo, empresa_id, etapa_id)
  select 'Sin equipo 2', 'c1100000-2222-0000-0000-000000000001', e.id from public.etapas e where e.organizacion_id = org and e.orden = 1;
  -- …y al cerrar la primera, el equipo puede volver a tener una abierta.
  update public.oportunidades set etapa_id = v_ganada where titulo like 'Recambio: Arco 0011%';
  insert into public.oportunidades (titulo, empresa_id, etapa_id, venta_item_id)
  select 'Recambio nuevo ciclo', 'c1100000-2222-0000-0000-000000000001', e.id, vi.id
  from public.venta_items vi, public.etapas e
  where e.organizacion_id = org and e.orden = 1 and vi.producto_id = 'c1100000-aaaa-0000-0000-000000000001';
  if (select count(*) from public.oportunidades where venta_item_id is not null and estado = 'abierta'
        and empresa_id = 'c1100000-2222-0000-0000-000000000001') <> 1 then
    raise exception 'FALLA: tras cerrar la primera, deberia haber exactamente 1 oportunidad abierta para el equipo';
  end if;
end $$;

-- ══ SOY EL VENDEDOR DE A: cartera propia (solo A2) ════════════════════════════
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c1100000-1111-0000-0000-000000000002","role":"authenticated"}', true);

do $$
declare
  v_fila public.canchas;
  v_n int;
begin
  -- canchas: ve solo la de su empresa (A2); la de A1 es del admin
  if (select count(*) from public.canchas) <> 1
     or not exists (select 1 from public.canchas where id = 'c1100000-8888-0000-0000-000000000002') then
    raise exception 'FALLA: el vendedor deberia ver solo la cancha de su empresa y ve %', (select count(*) from public.canchas);
  end if;
  -- no puede cargar una cancha en la empresa del admin (no la ve)
  perform pg_temp.debe_fallar(
    $q$insert into public.canchas (empresa_id, nombre, formato) values ('c1100000-2222-0000-0000-000000000001', 'Colada', 'F5')$q$,
    '42501', '%row-level security%', 'el vendedor creo una cancha en la empresa de otro');
  -- puede en la suya, editarla y darla de baja
  insert into public.canchas (empresa_id, nombre, formato, cantidad)
  values ('c1100000-2222-0000-0000-000000000002', 'Canchas F7 del vendedor', 'F7', 3) returning * into v_fila;
  update public.canchas set cantidad = 4 where id = v_fila.id;
  update public.canchas set activa = false where id = v_fila.id;
  -- y no puede tocar la de A1: el update no encuentra la fila
  update public.canchas set nombre = 'Hackeada' where id = 'c1100000-8888-0000-0000-000000000001';
  get diagnostics v_n = row_count;
  if v_n <> 0 then
    raise exception 'FALLA: el vendedor edito una cancha de la cartera de otro';
  end if;

  -- licitaciones: ve solo la de su oportunidad (A2); no la del admin
  if (select count(*) from public.licitaciones) <> 1
     or not exists (select 1 from public.licitaciones where oportunidad_id = 'c1100000-5555-0000-0000-000000000003') then
    raise exception 'FALLA: el vendedor deberia ver solo la licitacion de su oportunidad y ve %', (select count(*) from public.licitaciones);
  end if;
  perform pg_temp.debe_fallar(
    $q$insert into public.licitaciones (oportunidad_id, fecha_apertura) values ('c1100000-5555-0000-0000-000000000004', current_date)$q$,
    '42501', '%row-level security%', 'el vendedor cargo una licitacion en la oportunidad de otro');
  update public.licitaciones set organismo = 'Hackeado' where oportunidad_id = 'c1100000-5555-0000-0000-000000000002';
  get diagnostics v_n = row_count;
  if v_n <> 0 then
    raise exception 'FALLA: el vendedor edito la licitacion de la cartera de otro';
  end if;
  update public.licitaciones set organismo = 'Municipalidad editada' where oportunidad_id = 'c1100000-5555-0000-0000-000000000003';
  get diagnostics v_n = row_count;
  if v_n <> 1 then
    raise exception 'FALLA: el vendedor no pudo editar la licitacion de su propia oportunidad';
  end if;
end $$;

-- ══ SOY EL DE SOLO LECTURA DE A: ve clientes (canchas) pero no oportunidades ══
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c1100000-1111-0000-0000-000000000003","role":"authenticated"}', true);

do $$
begin
  if (select count(*) from public.canchas) < 2 then
    raise exception 'FALLA: Solo lectura deberia ver las canchas de todos los clientes (clientes.ver + ver_todos)';
  end if;
  perform pg_temp.debe_fallar(
    $q$insert into public.canchas (empresa_id, nombre, formato) values ('c1100000-2222-0000-0000-000000000001', 'Lector', 'F5')$q$,
    '42501', '%row-level security%', 'Solo lectura creo una cancha');
  if (select count(*) from public.licitaciones) <> 0 then
    raise exception 'FALLA: Solo lectura (sin oportunidades.ver) ve licitaciones';
  end if;
end $$;

-- ══ SOY EL ADMIN DE B: no ve nada de A ═══════════════════════════════════════
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c2200000-1111-0000-0000-000000000004","role":"authenticated"}', true);

do $$
begin
  if exists (select 1 from public.canchas where organizacion_id <> 'c2200000-0000-0000-0000-000000000000') then
    raise exception 'FALLA: el admin de B ve canchas de A';
  end if;
  if exists (select 1 from public.licitaciones where organizacion_id <> 'c2200000-0000-0000-0000-000000000000') then
    raise exception 'FALLA: el admin de B ve licitaciones de A';
  end if;
  if (select count(*) from public.licitaciones) <> 1 then
    raise exception 'FALLA: el admin de B deberia ver 1 licitacion (la suya) y ve %', (select count(*) from public.licitaciones);
  end if;
  perform pg_temp.debe_fallar(
    $q$insert into public.licitaciones (organizacion_id, oportunidad_id, fecha_apertura) values ('c1100000-0000-0000-0000-000000000000', 'c1100000-5555-0000-0000-000000000003', current_date)$q$,
    '42501', '%row-level security%', 'el admin de B escribio una licitacion en la organizacion A');
  update public.canchas set nombre = 'Hackeada' where organizacion_id = 'c1100000-0000-0000-0000-000000000000';
  if exists (select 1 from public.canchas where nombre = 'Hackeada') then
    raise exception 'FALLA: el admin de B edito canchas de A';
  end if;
end $$;

reset role;
rollback;

-- Solo se llega hasta aca si ninguna prueba corto con "FALLA:". Va despues del
-- rollback porque el SQL Editor muestra el resultado de la ULTIMA sentencia.
select 'TODO OK: funciones del rubro (0011) verificadas. Nada quedo guardado (rollback).' as resultado;
