-- Tuco & Nito - PRUEBA DE LOS PRESUPUESTOS (0012)
--
-- Correr en el SQL Editor de Supabase DESPUES de aplicar la 0012 (o, para
-- ensayarla sin aplicarla: `begin;` + la migracion + este archivo; el ROLLBACK
-- de aca abajo deshace las dos cosas).
--
-- Prueba, como lo hace la app (rol `authenticated` + el JWT de cada usuario) y
-- como postgres (sin usuario):
--   a) numeracion: correlativa POR ORGANIZACION (cada una arranca en 1), el numero
--      que manda el cliente se ignora, un alta que falla no deja huecos y el
--      UNIQUE (organizacion_id, numero) frena un duplicado si el trigger faltara;
--   b) aislamiento entre organizaciones y cartera propia del Vendedor (hereda la
--      de la oportunidad); Solo lectura no ve ni crea;
--   c) inmutabilidad: solo `actividad_id` cambia, y una sola vez; no se muda de
--      organizacion ni de oportunidad;
--   d) sin DELETE; la tabla de contadores no se lee ni se escribe desde la API;
--   e) borrar la organizacion entera no deja huerfanos.
--
-- Sobre la CONCURRENCIA: una sola conexion no puede probar dos altas a la vez.
-- Lo que SI se prueba es el mecanismo que la resuelve: el numero sale de
-- `insert ... on conflict do update` sobre la fila del contador (que se bloquea
-- hasta el fin de la transaccion), el cliente no lo elige y el UNIQUE respalda.
--
-- Los casos negativos verifican el CODIGO y el MENSAJE del error.
--
-- NO DEJA NADA EN LA BASE: todo corre dentro de una transaccion con ROLLBACK.
--
-- Resultado esperado: una fila que dice "TODO OK". Si algo falla, se corta con
-- un ERROR que empieza con "FALLA:".
--
-- Ids: organizacion A c1200000-..., B c2200000-...; usuarios ...-1111-...-0N:
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
  ('c1200000-0000-0000-0000-000000000000', 'TEST 0012 Org A'),
  ('c2200000-0000-0000-0000-000000000000', 'TEST 0012 Org B');

insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select v.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', v.email,
       jsonb_build_object('organizacion_id', v.org,
                          'rol_id', (select id from public.roles where organizacion_id = v.org and nombre = v.rol)),
       jsonb_build_object('nombre', v.email), now(), now()
from (values
  ('c1200000-1111-0000-0000-000000000001'::uuid, 'c12.admin@test.invalid', 'Administrador', 'c1200000-0000-0000-0000-000000000000'::uuid),
  ('c1200000-1111-0000-0000-000000000002'::uuid, 'c12.vend@test.invalid',  'Vendedor',      'c1200000-0000-0000-0000-000000000000'::uuid),
  ('c1200000-1111-0000-0000-000000000003'::uuid, 'c12.lect@test.invalid',  'Solo lectura',  'c1200000-0000-0000-0000-000000000000'::uuid),
  ('c2200000-1111-0000-0000-000000000004'::uuid, 'c22.admin@test.invalid', 'Administrador', 'c2200000-0000-0000-0000-000000000000'::uuid)
) as v(id, email, rol, org);

-- Empresas: A1 del admin, A2 del vendedor (su cartera), B1 de la otra organizacion.
insert into public.empresas (id, organizacion_id, nombre, responsable_id) values
  ('c1200000-2222-0000-0000-000000000001', 'c1200000-0000-0000-0000-000000000000', 'A1 Club del admin',    'c1200000-1111-0000-0000-000000000001'),
  ('c1200000-2222-0000-0000-000000000002', 'c1200000-0000-0000-0000-000000000000', 'A2 Club del vendedor', 'c1200000-1111-0000-0000-000000000002'),
  ('c2200000-2222-0000-0000-000000000001', 'c2200000-0000-0000-0000-000000000000', 'B1 Club de B',        'c2200000-1111-0000-0000-000000000004');

-- Oportunidades: una del admin y una del vendedor en A, una en B.
insert into public.oportunidades (id, organizacion_id, titulo, empresa_id, responsable_id, etapa_id)
select v.id, v.org, v.titulo, v.empresa, v.resp, e.id
from (values
  ('c1200000-5555-0000-0000-000000000001'::uuid, 'c1200000-0000-0000-0000-000000000000'::uuid, 'Op A del admin',    'c1200000-2222-0000-0000-000000000001'::uuid, 'c1200000-1111-0000-0000-000000000001'::uuid),
  ('c1200000-5555-0000-0000-000000000002'::uuid, 'c1200000-0000-0000-0000-000000000000'::uuid, 'Op A del vendedor', 'c1200000-2222-0000-0000-000000000002'::uuid, 'c1200000-1111-0000-0000-000000000002'::uuid),
  ('c2200000-5555-0000-0000-000000000001'::uuid, 'c2200000-0000-0000-0000-000000000000'::uuid, 'Op B',             'c2200000-2222-0000-0000-000000000001'::uuid, 'c2200000-1111-0000-0000-000000000004'::uuid)
) as v(id, org, titulo, empresa, resp)
join public.etapas e on e.organizacion_id = v.org and e.orden = 1;

-- ══ COMO POSTGRES: numeracion y reglas de datos ═══════════════════════════════
do $$
declare
  v_n int;
  v_act uuid;
  v_txt text;
begin
  -- Cada organizacion arranca en 1 y avanza de a uno.
  insert into public.presupuestos (id, organizacion_id, oportunidad_id, total)
  values ('c1200000-aaaa-0000-0000-000000000001', 'c1200000-0000-0000-0000-000000000000', 'c1200000-5555-0000-0000-000000000001', 100);
  insert into public.presupuestos (id, organizacion_id, oportunidad_id, total)
  values ('c1200000-aaaa-0000-0000-000000000002', 'c1200000-0000-0000-0000-000000000000', 'c1200000-5555-0000-0000-000000000001', 200);
  insert into public.presupuestos (id, organizacion_id, oportunidad_id, total)
  values ('c2200000-aaaa-0000-0000-000000000001', 'c2200000-0000-0000-0000-000000000000', 'c2200000-5555-0000-0000-000000000001', 300);

  if (select numero from public.presupuestos where id = 'c1200000-aaaa-0000-0000-000000000001') <> 1
     or (select numero from public.presupuestos where id = 'c1200000-aaaa-0000-0000-000000000002') <> 2 then
    raise exception 'FALLA: la organizacion A no numero 1 y 2';
  end if;
  if (select numero from public.presupuestos where id = 'c2200000-aaaa-0000-0000-000000000001') <> 1 then
    raise exception 'FALLA: la organizacion B no arranco en 1 (su numeracion es propia)';
  end if;

  -- El numero que manda el cliente se ignora: el que corresponde es el 3.
  insert into public.presupuestos (id, organizacion_id, oportunidad_id, numero, total)
  values ('c1200000-aaaa-0000-0000-000000000003', 'c1200000-0000-0000-0000-000000000000', 'c1200000-5555-0000-0000-000000000001', 99, 1)
  returning numero into v_n;
  if v_n <> 3 then
    raise exception 'FALLA: el alta con numero = 99 quedo con el numero % (tenia que ser el 3, lo asigna la base)', v_n;
  end if;

  -- Un alta que falla despues del trigger (CHECK de total) no consume numero: el contador se revierte.
  begin
    insert into public.presupuestos (organizacion_id, oportunidad_id, total)
    values ('c1200000-0000-0000-0000-000000000000', 'c1200000-5555-0000-0000-000000000001', -1);
    raise exception 'FALLA: se guardo un presupuesto con total negativo';
  exception when check_violation then
    null;
  end;
  insert into public.presupuestos (id, organizacion_id, oportunidad_id, total)
  values ('c1200000-aaaa-0000-0000-000000000004', 'c1200000-0000-0000-0000-000000000000', 'c1200000-5555-0000-0000-000000000001', 4)
  returning numero into v_n;
  if v_n <> 4 then
    raise exception 'FALLA: un alta fallida dejo un hueco en la numeracion (siguiente = %, esperado 4)', v_n;
  end if;
  if (select ultimo from public.presupuesto_contadores where organizacion_id = 'c1200000-0000-0000-0000-000000000000') <> 4 then
    raise exception 'FALLA: el contador de A no quedo en 4';
  end if;

  -- El numero se asigna SIEMPRE en la base: ni el 0 del default, ni uno explicito (0, negativo) llegan a la fila.
  -- Todo esto corre en un sub-bloque que se revierte (la numeracion de abajo sigue contando desde el 5).
  begin
    insert into public.presupuestos (organizacion_id, oportunidad_id, numero)
    values ('c1200000-0000-0000-0000-000000000000', 'c1200000-5555-0000-0000-000000000001', 0) returning numero into v_n;
    if v_n <> 5 then raise exception 'FALLA: el alta con numero = 0 quedo con el numero % (esperado 5)', v_n; end if;
    insert into public.presupuestos (organizacion_id, oportunidad_id, numero)
    values ('c1200000-0000-0000-0000-000000000000', 'c1200000-5555-0000-0000-000000000001', -5) returning numero into v_n;
    if v_n <> 6 then raise exception 'FALLA: el alta con numero = -5 quedo con el numero % (esperado 6)', v_n; end if;

    -- El vinculo con la actividad nunca viene del alta: se pisa a nulo aunque el cliente mande una real.
    insert into public.bitacora_entradas (organizacion_id, empresa_id, oportunidad_id, tipo_actividad_id, titulo)
    values ('c1200000-0000-0000-0000-000000000000', 'c1200000-2222-0000-0000-000000000001', 'c1200000-5555-0000-0000-000000000001',
            (select id from public.tipos_actividad where organizacion_id = 'c1200000-0000-0000-0000-000000000000' and codigo = 'propuesta'),
            'Actividad de prueba')
    returning id into v_act;
    insert into public.presupuestos (organizacion_id, oportunidad_id, actividad_id)
    values ('c1200000-0000-0000-0000-000000000000', 'c1200000-5555-0000-0000-000000000001', v_act);
    if (select count(*) from public.presupuestos where actividad_id is not null) <> 0 then
      raise exception 'FALLA: un alta se creo con actividad_id ya vinculada (tiene que nacer en nulo)';
    end if;

    -- Sin usuario (postgres) el creado_por que se manda se respeta; con usuario lo fuerza el trigger (abajo).
    insert into public.presupuestos (organizacion_id, oportunidad_id, creado_por)
    values ('c1200000-0000-0000-0000-000000000000', 'c1200000-5555-0000-0000-000000000001', 'c1200000-1111-0000-0000-000000000002')
    returning creado_por::text into v_txt;
    if v_txt <> 'c1200000-1111-0000-0000-000000000002' then
      raise exception 'FALLA: sin usuario se pisó el creado_por que mando el script';
    end if;
    raise exception 'sentinel_revertir';
  exception when others then
    if sqlerrm <> 'sentinel_revertir' then raise; end if;
  end;

  -- Defaults: fecha de hoy (Argentina), validez 15, lineas [], emisor {} y creado_por nulo sin usuario.
  if (select fecha from public.presupuestos where id = 'c1200000-aaaa-0000-0000-000000000001')
     <> (now() at time zone 'America/Argentina/Buenos_Aires')::date then
    raise exception 'FALLA: la fecha por defecto no es la de Argentina';
  end if;
  if (select validez_dias from public.presupuestos where id = 'c1200000-aaaa-0000-0000-000000000001') <> 15
     or (select lineas from public.presupuestos where id = 'c1200000-aaaa-0000-0000-000000000001') <> '[]'::jsonb then
    raise exception 'FALLA: validez_dias o lineas no tienen su valor por defecto';
  end if;
  if (select emisor from public.presupuestos where id = 'c1200000-aaaa-0000-0000-000000000001') <> '{}'::jsonb
     or (select condicion_iva from public.presupuestos where id = 'c1200000-aaaa-0000-0000-000000000001') is not null then
    raise exception 'FALLA: emisor y condicion_iva no arrancan vacios por defecto';
  end if;

  -- La foto del emisor: condicion de IVA acotada y emisor siempre un objeto.
  perform pg_temp.debe_fallar(
    $q$insert into public.presupuestos (organizacion_id, oportunidad_id, condicion_iva) values ('c1200000-0000-0000-0000-000000000000', 'c1200000-5555-0000-0000-000000000001', 'consumidor_final')$q$,
    '23514', '%condicion_iva%', 'se guardo una condicion de IVA inventada');
  perform pg_temp.debe_fallar(
    $q$insert into public.presupuestos (organizacion_id, oportunidad_id, emisor) values ('c1200000-0000-0000-0000-000000000000', 'c1200000-5555-0000-0000-000000000001', '[1]'::jsonb)$q$,
    '23514', '%emisor%', 'el emisor acepto un arreglo en vez de un objeto');

  -- CHECKs
  perform pg_temp.debe_fallar(
    $q$insert into public.presupuestos (organizacion_id, oportunidad_id, validez_dias) values ('c1200000-0000-0000-0000-000000000000', 'c1200000-5555-0000-0000-000000000001', 0)$q$,
    '23514', '%validez_dias%', 'se guardo un presupuesto con validez 0');
  perform pg_temp.debe_fallar(
    $q$insert into public.presupuestos (organizacion_id, oportunidad_id, lineas) values ('c1200000-0000-0000-0000-000000000000', 'c1200000-5555-0000-0000-000000000001', '{"a":1}'::jsonb)$q$,
    '23514', '%lineas%', 'las lineas aceptaron un objeto en vez de un arreglo');

  -- La clave foranea compuesta no cruza organizaciones: oportunidad de B con la organizacion de A.
  perform pg_temp.debe_fallar(
    $q$insert into public.presupuestos (organizacion_id, oportunidad_id) values ('c1200000-0000-0000-0000-000000000000', 'c2200000-5555-0000-0000-000000000001')$q$,
    '23503', '%presupuestos_oportunidad_id_fkey%', 'un presupuesto de A colgo de una oportunidad de B');

  -- Red de seguridad: sin el trigger, un numero repetido lo frena el UNIQUE.
  alter table public.presupuestos disable trigger presupuestos_numero;
  perform pg_temp.debe_fallar(
    $q$insert into public.presupuestos (organizacion_id, oportunidad_id, numero) values ('c1200000-0000-0000-0000-000000000000', 'c1200000-5555-0000-0000-000000000001', 1)$q$,
    '23505', '%presupuestos_numero_key%', 'el UNIQUE no freno un numero repetido');
  -- Y sin el trigger el DEFAULT 0 no pasa el CHECK: el numero lo pone el trigger, no el default.
  perform pg_temp.debe_fallar(
    $q$insert into public.presupuestos (organizacion_id, oportunidad_id) values ('c1200000-0000-0000-0000-000000000000', 'c1200000-5555-0000-0000-000000000001')$q$,
    '23514', '%presupuestos_numero_check%', 'un alta sin numero y sin trigger se guardo con el 0 del default');
  alter table public.presupuestos enable trigger presupuestos_numero;
end $$;

-- ══ SOY EL ADMINISTRADOR DE A ═════════════════════════════════════════════════
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c1200000-1111-0000-0000-000000000001","role":"authenticated"}', true);

do $$
declare
  org constant uuid := 'c1200000-0000-0000-0000-000000000000';
  v_fila public.presupuestos;
  v_otro public.presupuestos;
  v_n int;
  v_act uuid;
begin
  -- ve los 4 de su organizacion y ninguno de B
  if (select count(*) from public.presupuestos) <> 4 then
    raise exception 'FALLA: el admin de A deberia ver 4 presupuestos y ve %', (select count(*) from public.presupuestos);
  end if;
  if exists (select 1 from public.presupuestos where organizacion_id <> org) then
    raise exception 'FALLA: el admin de A ve un presupuesto de otra organizacion';
  end if;

  -- crea uno como lo hace la app: sin organizacion, sin numero, sin autor
  insert into public.presupuestos (oportunidad_id, fecha, validez_dias, condiciones, lineas, notas, total)
  values ('c1200000-5555-0000-0000-000000000001', current_date, 20, 'Pago contado',
          '[{"descripcion":"Arco","cantidad":2,"precio_unitario":1000,"descuento_pct":10}]'::jsonb, 'nota', 1800)
  returning * into v_fila;
  if v_fila.organizacion_id <> org then
    raise exception 'FALLA: el presupuesto nuevo no quedo en la organizacion del admin';
  end if;
  if v_fila.numero <> 5 then
    raise exception 'FALLA: el presupuesto nuevo no tomo el siguiente numero de A (tomo %, esperado 5)', v_fila.numero;
  end if;
  if v_fila.creado_por is distinct from 'c1200000-1111-0000-0000-000000000001'::uuid then
    raise exception 'FALLA: creado_por no es el usuario que lo guardo';
  end if;

  -- Con usuario, el autor lo fuerza la base (el cliente no se hace pasar por otro), el vinculo con la actividad nace
  -- en nulo aunque mande uno real y la foto del emisor se guarda tal cual. Sub-bloque que se revierte.
  begin
    insert into public.bitacora_entradas (empresa_id, oportunidad_id, tipo_actividad_id, titulo)
    values ('c1200000-2222-0000-0000-000000000001', 'c1200000-5555-0000-0000-000000000001',
            (select id from public.tipos_actividad where organizacion_id = org and codigo = 'propuesta'), 'Actividad de prueba')
    returning id into v_act;
    insert into public.presupuestos (oportunidad_id, creado_por, actividad_id, condicion_iva, emisor)
    values ('c1200000-5555-0000-0000-000000000001', 'c1200000-1111-0000-0000-000000000002', v_act, 'responsable_inscripto',
            '{"razon_social":"Proveedor SRL","cuit":"30-00000000-0"}'::jsonb)
    returning * into v_otro;
    if v_otro.creado_por is distinct from 'c1200000-1111-0000-0000-000000000001'::uuid then
      raise exception 'FALLA: el cliente pudo figurar como autor a otra persona (creado_por = %)', v_otro.creado_por;
    end if;
    if v_otro.actividad_id is not null then
      raise exception 'FALLA: un alta de usuario nacio con actividad_id vinculada';
    end if;
    if v_otro.condicion_iva <> 'responsable_inscripto' or v_otro.emisor ->> 'razon_social' <> 'Proveedor SRL' then
      raise exception 'FALLA: la foto del emisor no se guardo';
    end if;
    raise exception 'sentinel_revertir';
  exception when others then
    if sqlerrm <> 'sentinel_revertir' then raise; end if;
  end;

  -- no escribe en B ni cuelga un presupuesto de una oportunidad de B
  perform pg_temp.debe_fallar(
    $q$insert into public.presupuestos (organizacion_id, oportunidad_id) values ('c2200000-0000-0000-0000-000000000000', 'c2200000-5555-0000-0000-000000000001')$q$,
    '42501', '%row-level security%', 'el admin de A creo un presupuesto en la organizacion B');
  perform pg_temp.debe_fallar(
    $q$insert into public.presupuestos (oportunidad_id) values ('c2200000-5555-0000-0000-000000000001')$q$,
    '23503', '%presupuestos_oportunidad_id_fkey%', 'el admin de A colgo un presupuesto de una oportunidad de B');

  -- no se borra (no hay politica de DELETE)
  delete from public.presupuestos where id = v_fila.id;
  get diagnostics v_n = row_count;
  if v_n <> 0 or not exists (select 1 from public.presupuestos where id = v_fila.id) then
    raise exception 'FALLA: un usuario pudo borrar un presupuesto (no hay politica de DELETE)';
  end if;

  -- no se modifica: ni las lineas, ni el total, ni el numero, ni la organizacion, ni la oportunidad
  perform pg_temp.debe_fallar(
    format($q$update public.presupuestos set emisor = '{"razon_social":"Otro"}'::jsonb where id = %L$q$, v_fila.id),
    '23514', 'Un presupuesto emitido no se modifica%', 'se pudo cambiar la foto del emisor');
  perform pg_temp.debe_fallar(
    format($q$update public.presupuestos set condicion_iva = 'monotributo' where id = %L$q$, v_fila.id),
    '23514', 'Un presupuesto emitido no se modifica%', 'se pudo cambiar la condicion de IVA de un presupuesto emitido');
  perform pg_temp.debe_fallar(
    format($q$update public.presupuestos set total = 1 where id = %L$q$, v_fila.id),
    '23514', 'Un presupuesto emitido no se modifica%', 'se pudo cambiar el total de un presupuesto emitido');
  perform pg_temp.debe_fallar(
    format($q$update public.presupuestos set lineas = '[]'::jsonb where id = %L$q$, v_fila.id),
    '23514', 'Un presupuesto emitido no se modifica%', 'se pudieron cambiar las lineas de un presupuesto emitido');
  perform pg_temp.debe_fallar(
    format($q$update public.presupuestos set numero = 77 where id = %L$q$, v_fila.id),
    '23514', 'Un presupuesto emitido no se modifica%', 'se pudo cambiar el numero de un presupuesto emitido');
  perform pg_temp.debe_fallar(
    format($q$update public.presupuestos set oportunidad_id = 'c1200000-5555-0000-0000-000000000002' where id = %L$q$, v_fila.id),
    '23514', 'Un presupuesto emitido no se modifica%', 'se pudo mudar un presupuesto a otra oportunidad');
  perform pg_temp.debe_fallar(
    format($q$update public.presupuestos set organizacion_id = 'c2200000-0000-0000-0000-000000000000' where id = %L$q$, v_fila.id),
    '23514', 'Un presupuesto emitido no se modifica%', 'se pudo mudar un presupuesto a otra organizacion');

  -- lo unico que cambia: actividad_id, una sola vez, y de una actividad visible y coherente
  insert into public.bitacora_entradas (empresa_id, oportunidad_id, tipo_actividad_id, titulo)
  values ('c1200000-2222-0000-0000-000000000001', 'c1200000-5555-0000-0000-000000000001',
          (select id from public.tipos_actividad where organizacion_id = org and codigo = 'propuesta'),
          'Envío de presupuesto N° 5')
  returning id into v_act;
  update public.presupuestos set actividad_id = v_act where id = v_fila.id;
  if (select actividad_id from public.presupuestos where id = v_fila.id) is distinct from v_act then
    raise exception 'FALLA: no se pudo registrar la actividad en el presupuesto';
  end if;
  perform pg_temp.debe_fallar(
    format($q$update public.presupuestos set actividad_id = null where id = %L$q$, v_fila.id),
    '23514', 'La actividad de este presupuesto ya está registrada%', 'se pudo volver a cambiar la actividad de un presupuesto');

  -- los contadores no se ven ni se tocan desde la API
  perform pg_temp.debe_fallar(
    $q$select * from public.presupuesto_contadores$q$,
    '42501', 'permission denied%', 'un usuario pudo leer los contadores');
  perform pg_temp.debe_fallar(
    $q$update public.presupuesto_contadores set ultimo = 0$q$,
    '42501', 'permission denied%', 'un usuario pudo reiniciar un contador');
end $$;

-- ══ SOY EL VENDEDOR DE A (cartera propia) ═════════════════════════════════════
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c1200000-1111-0000-0000-000000000002","role":"authenticated"}', true);

do $$
declare
  v_n int;
begin
  -- todavia no tiene ninguno propio: los 5 existentes son de oportunidades del admin
  if (select count(*) from public.presupuestos) <> 0 then
    raise exception 'FALLA: el vendedor ve presupuestos de oportunidades que no son suyas (ve %)', (select count(*) from public.presupuestos);
  end if;
  -- no crea sobre una oportunidad ajena
  perform pg_temp.debe_fallar(
    $q$insert into public.presupuestos (oportunidad_id) values ('c1200000-5555-0000-0000-000000000001')$q$,
    '42501', '%row-level security%', 'el vendedor creo un presupuesto sobre una oportunidad del admin');
  -- crea sobre la suya, con el correlativo de la organizacion (6), y lo ve
  insert into public.presupuestos (oportunidad_id, total) values ('c1200000-5555-0000-0000-000000000002', 10);
  if (select count(*) from public.presupuestos) <> 1
     or (select numero from public.presupuestos) <> 6 then
    raise exception 'FALLA: el vendedor deberia ver solo el suyo, con el numero 6 de la organizacion';
  end if;
  -- no lo puede borrar
  delete from public.presupuestos;
  get diagnostics v_n = row_count;
  if v_n <> 0 then
    raise exception 'FALLA: el vendedor pudo borrar presupuestos';
  end if;
end $$;

-- ══ SOY SOLO LECTURA DE A (no usa oportunidades) ══════════════════════════════
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c1200000-1111-0000-0000-000000000003","role":"authenticated"}', true);

do $$
begin
  if (select count(*) from public.presupuestos) <> 0 then
    raise exception 'FALLA: Solo lectura ve presupuestos (no tiene oportunidades.ver)';
  end if;
  perform pg_temp.debe_fallar(
    $q$insert into public.presupuestos (oportunidad_id) values ('c1200000-5555-0000-0000-000000000001')$q$,
    '42501', '%row-level security%', 'Solo lectura creo un presupuesto');
end $$;

-- ══ SOY EL ADMINISTRADOR DE B ═════════════════════════════════════════════════
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c2200000-1111-0000-0000-000000000004","role":"authenticated"}', true);

do $$
declare
  v_n int;
begin
  if exists (select 1 from public.presupuestos where organizacion_id <> 'c2200000-0000-0000-0000-000000000000') then
    raise exception 'FALLA: el admin de B ve presupuestos de A';
  end if;
  if (select count(*) from public.presupuestos) <> 1 then
    raise exception 'FALLA: el admin de B deberia ver 1 presupuesto (el suyo) y ve %', (select count(*) from public.presupuestos);
  end if;
  -- el siguiente de B es el 2, no el 7 de A: la numeracion es por organizacion
  insert into public.presupuestos (oportunidad_id) values ('c2200000-5555-0000-0000-000000000001');
  if (select max(numero) from public.presupuestos) <> 2 then
    raise exception 'FALLA: el siguiente numero de B deberia ser 2 (numeracion propia)';
  end if;
  -- no toca los de A
  update public.presupuestos set actividad_id = null where organizacion_id = 'c1200000-0000-0000-0000-000000000000';
  get diagnostics v_n = row_count;
  if v_n <> 0 then
    raise exception 'FALLA: el admin de B edito presupuestos de A';
  end if;
  delete from public.presupuestos where organizacion_id = 'c1200000-0000-0000-0000-000000000000';
  get diagnostics v_n = row_count;
  if v_n <> 0 then
    raise exception 'FALLA: el admin de B borro presupuestos de A';
  end if;
end $$;

-- ══ COMO POSTGRES: borrar la organizacion entera ══════════════════════════════
reset role;

do $$
declare
  v_act uuid;
  v_pre uuid;
begin
  -- Si borran la actividad vinculada, el vinculo se suelta (on delete set null) y el presupuesto sigue intacto: la
  -- proteccion de "no se modifica" no puede trabar ese borrado. Mientras la actividad exista, el vinculo no se suelta
  -- (se probo arriba).
  select id, actividad_id into v_pre, v_act from public.presupuestos where actividad_id is not null limit 1;
  if v_act is null then
    raise exception 'FALLA: la prueba esperaba un presupuesto con actividad vinculada';
  end if;
  delete from public.bitacora_entradas where id = v_act;
  if not exists (select 1 from public.presupuestos where id = v_pre and actividad_id is null) then
    raise exception 'FALLA: borrar la actividad vinculada no solto el vinculo del presupuesto (o se llevo el presupuesto)';
  end if;

  -- Con presupuestos, oportunidades, actividades y contadores: la cascada no deja huerfanos.
  delete from public.organizaciones where id = 'c1200000-0000-0000-0000-000000000000';
  if exists (select 1 from public.presupuestos where organizacion_id = 'c1200000-0000-0000-0000-000000000000')
     or exists (select 1 from public.presupuesto_contadores where organizacion_id = 'c1200000-0000-0000-0000-000000000000') then
    raise exception 'FALLA: borrar la organizacion dejo presupuestos o contadores huerfanos';
  end if;
  if not exists (select 1 from public.presupuestos where organizacion_id = 'c2200000-0000-0000-0000-000000000000') then
    raise exception 'FALLA: borrar la organizacion A se llevo los presupuestos de B';
  end if;
end $$;

rollback;

-- Solo se llega hasta aca si ninguna prueba corto con "FALLA:". Va despues del
-- rollback porque el SQL Editor muestra el resultado de la ULTIMA sentencia.
select 'TODO OK: presupuestos (0012) verificados. Nada quedo guardado (rollback).' as resultado;
