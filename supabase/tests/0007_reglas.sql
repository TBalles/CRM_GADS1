-- Tuco & Nito - PRUEBA DE LAS REGLAS DE LA 0007
--
-- Correr en el SQL Editor de Supabase DESPUES de aplicar la 0007 (o, para
-- ensayarla sin aplicarla: `begin;` + la migracion + este archivo; el ROLLBACK
-- de aca abajo deshace las dos cosas).
--
-- Crea dos organizaciones de prueba (A y B), usuarios con los roles por
-- defecto, y se hace pasar por cada uno como lo hace la app (rol
-- `authenticated` + el JWT con su id) para probar:
--   - cartera propia: un Vendedor ve y toca solo lo asignado (y lo que cuelga
--     de ello: ventas, items, alertas, actividades);
--   - asignar / reasignar responsable solo con permiso;
--   - reglas del embudo: perdida sin motivo, ganada con fecha, reabrir con
--     permiso, cambio de resultado con fecha nueva, estado incompatible;
--   - historial de etapas y auditoria de oportunidades cerradas;
--   - baja logica: oportunidades y contactos con historia no se borran, pero
--     borrar una organizacion entera sigue andando;
--   - catalogos: solo configuracion.gestionar los escribe;
--   - compatibilidad con la app vieja (bitacora por `tipo`, altas sin
--     responsable);
--   - aislamiento entre organizaciones en las tablas nuevas y el logo.
--
-- Los casos negativos verifican el CODIGO y el MENSAJE del error, no solo que
-- falle: asi se sabe que frena el mecanismo correcto (trigger, RLS, FK, CHECK).
-- La re-ejecucion de la migracion se prueba aparte, en 0007_reejecucion.sql.
--
-- NO DEJA NADA EN LA BASE: todo corre dentro de una transaccion con ROLLBACK.
--
-- Resultado esperado: una fila que dice "TODO OK". Si algo falla, se corta con
-- un ERROR que empieza con "FALLA:".
--
-- Ids: A = a7a7a7a7-..., B = b7b7b7b7-... Usuarios de A: ...-1111-...-01 admin,
-- 02 vendedor 1, 03 vendedor 2, 04 responsable comercial, 05 solo lectura.

begin;

-- ── Ayudas (temporales: desaparecen con la sesion) ───────────────────────────
-- debe_fallar: corre la sentencia y exige que falle con ESE sqlstate y un
-- mensaje que matchee el patron (LIKE).
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

-- filas: corre la sentencia y devuelve cuantas filas toco.
create function pg_temp.filas(p_sql text)
returns int language plpgsql as $f$
declare n int;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end $f$;

grant execute on function pg_temp.debe_fallar(text, text, text, text) to authenticated, anon;
grant execute on function pg_temp.filas(text) to authenticated, anon;

-- ── Organizaciones: el trigger les crea roles, embudo y catalogos ────────────
insert into public.organizaciones (id, nombre) values
  ('a7a7a7a7-0000-0000-0000-000000000000', 'TEST 0007 Org A'),
  ('b7b7b7b7-0000-0000-0000-000000000000', 'TEST 0007 Org B');

do $$
declare
  a constant uuid := 'a7a7a7a7-0000-0000-0000-000000000000';
begin
  if (select array_agg(nombre order by nombre) from public.roles where organizacion_id = a)
     <> array['Administrador', 'Responsable comercial', 'Solo lectura', 'Vendedor'] then
    raise exception 'FALLA: la organizacion nueva no recibio los 4 roles por defecto con sus nombres nuevos';
  end if;
  if (select count(*) from public.etapas where organizacion_id = a) <> 6
     or (select count(*) from public.etapas where organizacion_id = a and tipo = 'ganada') <> 1
     or (select count(*) from public.etapas where organizacion_id = a and tipo = 'perdida') <> 1
     or not exists (select 1 from public.etapas where organizacion_id = a and orden = 2 and nombre = 'Relevamiento de cancha') then
    raise exception 'FALLA: la organizacion nueva no recibio el embudo del rubro (6 etapas, 1 ganada, 1 perdida)';
  end if;
  if (select count(*) from public.tipos_actividad where organizacion_id = a) <> 12
     or (select count(*) from public.origenes where organizacion_id = a) <> 7
     or (select count(*) from public.motivos_perdida where organizacion_id = a) <> 7 then
    raise exception 'FALLA: la organizacion nueva no recibio sus catalogos (12 tipos, 7 origenes, 7 motivos)';
  end if;
end $$;

-- ── Usuarios, con el rol en app_metadata como en un alta real ────────────────
insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select v.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', v.email,
       jsonb_build_object('organizacion_id', v.org, 'rol_id', (select id from public.roles where organizacion_id = v.org and nombre = v.rol)),
       jsonb_build_object('nombre', v.email), now(), now()
from (values
  ('a7a7a7a7-1111-0000-0000-000000000001'::uuid, 'a7.admin@test.invalid',  'a7a7a7a7-0000-0000-0000-000000000000'::uuid, 'Administrador'),
  ('a7a7a7a7-1111-0000-0000-000000000002'::uuid, 'a7.vend1@test.invalid',  'a7a7a7a7-0000-0000-0000-000000000000'::uuid, 'Vendedor'),
  ('a7a7a7a7-1111-0000-0000-000000000003'::uuid, 'a7.vend2@test.invalid',  'a7a7a7a7-0000-0000-0000-000000000000'::uuid, 'Vendedor'),
  ('a7a7a7a7-1111-0000-0000-000000000004'::uuid, 'a7.resp@test.invalid',   'a7a7a7a7-0000-0000-0000-000000000000'::uuid, 'Responsable comercial'),
  ('a7a7a7a7-1111-0000-0000-000000000005'::uuid, 'a7.lect@test.invalid',   'a7a7a7a7-0000-0000-0000-000000000000'::uuid, 'Solo lectura'),
  ('b7b7b7b7-1111-0000-0000-000000000001'::uuid, 'b7.admin@test.invalid',  'b7b7b7b7-0000-0000-0000-000000000000'::uuid, 'Administrador')
) as v(id, email, org, rol);

-- ── Datos (como postgres, sin RLS) ────────────────────────────────────────────
--   E1 (vendedor 1) con C1 (sin responsable: se ve por su empresa), O1, V1/VI1, actividad
--   E2 (vendedor 2) con C2, O2, V2/VI2, alerta enviada, actividad
--   C3: cliente individual del vendedor 1 (sin empresa); O3: oportunidad del
--   vendedor 1 sin empresa
--   El logo de B ya subido.
insert into public.empresas (id, organizacion_id, nombre, responsable_id) values
  ('a7a7a7a7-2222-0000-0000-000000000001', 'a7a7a7a7-0000-0000-0000-000000000000', 'E1 de vendedor 1', 'a7a7a7a7-1111-0000-0000-000000000002'),
  ('a7a7a7a7-2222-0000-0000-000000000002', 'a7a7a7a7-0000-0000-0000-000000000000', 'E2 de vendedor 2', 'a7a7a7a7-1111-0000-0000-000000000003'),
  ('b7b7b7b7-2222-0000-0000-000000000001', 'b7b7b7b7-0000-0000-0000-000000000000', 'Empresa de B', null);
insert into public.contactos (id, organizacion_id, empresa_id, nombre, responsable_id) values
  ('a7a7a7a7-3333-0000-0000-000000000001', 'a7a7a7a7-0000-0000-0000-000000000000', 'a7a7a7a7-2222-0000-0000-000000000001', 'C1 de E1', null),
  ('a7a7a7a7-3333-0000-0000-000000000002', 'a7a7a7a7-0000-0000-0000-000000000000', 'a7a7a7a7-2222-0000-0000-000000000002', 'C2 de E2', 'a7a7a7a7-1111-0000-0000-000000000003'),
  ('a7a7a7a7-3333-0000-0000-000000000003', 'a7a7a7a7-0000-0000-0000-000000000000', null, 'C3 individual', 'a7a7a7a7-1111-0000-0000-000000000002');
insert into public.productos (id, organizacion_id, nombre, vida_util_meses) values
  ('a7a7a7a7-4444-0000-0000-000000000001', 'a7a7a7a7-0000-0000-0000-000000000000', 'Red', 12);
insert into public.oportunidades (id, organizacion_id, titulo, empresa_id, responsable_id, etapa_id)
select v.id, 'a7a7a7a7-0000-0000-0000-000000000000', v.titulo, v.empresa, v.resp, e.id
from (values
  ('a7a7a7a7-5555-0000-0000-000000000001'::uuid, 'O1', 'a7a7a7a7-2222-0000-0000-000000000001'::uuid, 'a7a7a7a7-1111-0000-0000-000000000002'::uuid, 1),
  ('a7a7a7a7-5555-0000-0000-000000000002'::uuid, 'O2', 'a7a7a7a7-2222-0000-0000-000000000002'::uuid, 'a7a7a7a7-1111-0000-0000-000000000003'::uuid, 2),
  ('a7a7a7a7-5555-0000-0000-000000000003'::uuid, 'O3 sin empresa', null::uuid, 'a7a7a7a7-1111-0000-0000-000000000002'::uuid, 1)
) as v(id, titulo, empresa, resp, orden)
join public.etapas e on e.organizacion_id = 'a7a7a7a7-0000-0000-0000-000000000000' and e.orden = v.orden;
insert into public.ventas (id, organizacion_id, empresa_id) values
  ('a7a7a7a7-6666-0000-0000-000000000001', 'a7a7a7a7-0000-0000-0000-000000000000', 'a7a7a7a7-2222-0000-0000-000000000001'),
  ('a7a7a7a7-6666-0000-0000-000000000002', 'a7a7a7a7-0000-0000-0000-000000000000', 'a7a7a7a7-2222-0000-0000-000000000002');
insert into public.venta_items (id, organizacion_id, venta_id, producto_id, fecha_entrega) values
  ('a7a7a7a7-7777-0000-0000-000000000001', 'a7a7a7a7-0000-0000-0000-000000000000', 'a7a7a7a7-6666-0000-0000-000000000001', 'a7a7a7a7-4444-0000-0000-000000000001', (current_date - interval '13 months')::date),
  ('a7a7a7a7-7777-0000-0000-000000000002', 'a7a7a7a7-0000-0000-0000-000000000000', 'a7a7a7a7-6666-0000-0000-000000000002', 'a7a7a7a7-4444-0000-0000-000000000001', (current_date - interval '13 months')::date);
insert into public.alertas_enviadas (organizacion_id, venta_item_id, canal, destinatario) values
  ('a7a7a7a7-0000-0000-0000-000000000000', 'a7a7a7a7-7777-0000-0000-000000000002', 'email', 'e2@test.invalid');
insert into public.bitacora_entradas (organizacion_id, empresa_id, tipo, titulo) values
  ('a7a7a7a7-0000-0000-0000-000000000000', 'a7a7a7a7-2222-0000-0000-000000000001', 'llamada', 'Llamada a E1'),
  ('a7a7a7a7-0000-0000-0000-000000000000', 'a7a7a7a7-2222-0000-0000-000000000002', 'llamada', 'Llamada a E2');
insert into storage.objects (bucket_id, name) values ('logos', 'b7b7b7b7-0000-0000-0000-000000000000/logo.png');

-- Un responsable de OTRA organizacion: rechazado aunque lo asigne postgres (trigger).
select pg_temp.debe_fallar(
  $q$update public.empresas set responsable_id = 'b7b7b7b7-1111-0000-0000-000000000001'
     where id = 'a7a7a7a7-2222-0000-0000-000000000001'$q$,
  '23514', 'El responsable tiene que ser un usuario de la misma organización%',
  'una empresa de A quedo asignada a un usuario de B');

-- ══ SOY VENDEDOR 1 ════════════════════════════════════════════════════════════
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a7a7a7a7-1111-0000-0000-000000000002","role":"authenticated"}', true);

do $$
declare
  v_op uuid;
  v_etapa1 uuid := (select id from public.etapas where organizacion_id = 'a7a7a7a7-0000-0000-0000-000000000000' and orden = 1);
begin
  -- Cartera propia.
  if (select count(*) from public.empresas) <> 1
     or not exists (select 1 from public.empresas where id = 'a7a7a7a7-2222-0000-0000-000000000001') then
    raise exception 'FALLA: el vendedor ve % empresas, deberia ver solo la suya', (select count(*) from public.empresas);
  end if;
  if (select count(*) from public.contactos) <> 2
     or exists (select 1 from public.contactos where id = 'a7a7a7a7-3333-0000-0000-000000000002') then
    raise exception 'FALLA: el vendedor no ve exactamente sus contactos (el de su empresa y su cliente individual)';
  end if;
  if (select count(*) from public.oportunidades) <> 2 then
    raise exception 'FALLA: el vendedor ve % oportunidades, deberia ver solo las 2 suyas', (select count(*) from public.oportunidades);
  end if;
  if (select count(*) from public.ventas) <> 1 or (select count(*) from public.venta_items) <> 1 then
    raise exception 'FALLA: el vendedor ve ventas de clientes ajenos';
  end if;
  if exists (select 1 from public.alertas_enviadas) then
    raise exception 'FALLA: el vendedor ve alertas enviadas a clientes ajenos';
  end if;
  if (select count(*) from public.alertas_vida_util) <> 1 then
    raise exception 'FALLA: la vista de alertas le muestra al vendedor % items, deberia ser solo el de su cliente',
      (select count(*) from public.alertas_vida_util);
  end if;
  if (select count(*) from public.bitacora_entradas) <> 1 then
    raise exception 'FALLA: el vendedor ve actividades de clientes ajenos';
  end if;
  if (select count(*) from public.oportunidad_etapas_historial) <> 2 then
    raise exception 'FALLA: el vendedor ve historial de oportunidades ajenas';
  end if;

  -- Lo ajeno no se toca: 0 filas (la RLS no se lo muestra).
  if pg_temp.filas($q$update public.oportunidades set monto = 1 where id = 'a7a7a7a7-5555-0000-0000-000000000002'$q$) <> 0
     or pg_temp.filas($q$update public.empresas set nombre = 'x' where id = 'a7a7a7a7-2222-0000-0000-000000000002'$q$) <> 0 then
    raise exception 'FALLA: el vendedor pudo modificar una oportunidad o empresa ajena';
  end if;
  if pg_temp.filas($q$delete from public.empresas where id = 'a7a7a7a7-2222-0000-0000-000000000002'$q$) <> 0
     or pg_temp.filas($q$delete from public.contactos where id = 'a7a7a7a7-3333-0000-0000-000000000002'$q$) <> 0
     or pg_temp.filas($q$delete from public.ventas where id = 'a7a7a7a7-6666-0000-0000-000000000002'$q$) <> 0
     or pg_temp.filas($q$delete from public.venta_items where id = 'a7a7a7a7-7777-0000-0000-000000000002'$q$) <> 0 then
    raise exception 'FALLA: el vendedor pudo borrar filas de la cartera de otro';
  end if;
  if pg_temp.filas($q$update public.origenes set nombre = 'x'$q$) <> 0 then
    raise exception 'FALLA: el vendedor pudo editar un catalogo sin configuracion.gestionar';
  end if;
  if pg_temp.filas($q$update public.organizaciones set razon_social = 'x'$q$) <> 0 then
    raise exception 'FALLA: el vendedor pudo editar los datos de la empresa';
  end if;

  -- Ni su propia oportunidad se borra: no hay politica de borrar (baja logica).
  if pg_temp.filas($q$delete from public.oportunidades where id = 'a7a7a7a7-5555-0000-0000-000000000001'$q$) <> 0
     or not exists (select 1 from public.oportunidades where id = 'a7a7a7a7-5555-0000-0000-000000000001') then
    raise exception 'FALLA: el vendedor pudo borrar una oportunidad';
  end if;

  -- Altas como las hace la app vieja: responsable_id = null explicito.
  insert into public.empresas (nombre, responsable_id) values ('Alta del vendedor', null);
  if not exists (select 1 from public.empresas where nombre = 'Alta del vendedor'
                 and responsable_id = 'a7a7a7a7-1111-0000-0000-000000000002' and estado = 'potencial') then
    raise exception 'FALLA: el alta sin responsable no quedo asignada a quien la creo';
  end if;

  insert into public.oportunidades (titulo, etapa_id, responsable_id, empresa_id)
  values ('Alta vieja', v_etapa1, null, 'a7a7a7a7-2222-0000-0000-000000000001')
  returning id into v_op;
  if not exists (select 1 from public.oportunidades where id = v_op and estado = 'abierta'
                 and responsable_id = 'a7a7a7a7-1111-0000-0000-000000000002') then
    raise exception 'FALLA: la oportunidad creada por la app vieja no quedo abierta y asignada a quien la creo';
  end if;
  if not exists (select 1 from public.oportunidad_etapas_historial where oportunidad_id = v_op
                 and etapa_anterior_id is null and etapa_nueva_id = v_etapa1
                 and usuario_id = 'a7a7a7a7-1111-0000-0000-000000000002') then
    raise exception 'FALLA: el alta de una oportunidad no registro su etapa inicial en el historial';
  end if;

  -- Bitacora como la app vieja (solo `tipo`, y un autor ajeno).
  insert into public.bitacora_entradas (empresa_id, contacto_id, tipo, titulo, autor_id)
  values ('a7a7a7a7-2222-0000-0000-000000000001', 'a7a7a7a7-3333-0000-0000-000000000001', 'whatsapp', 'Vieja',
          'a7a7a7a7-1111-0000-0000-000000000003');
  if not exists (select 1 from public.bitacora_entradas b join public.tipos_actividad t on t.id = b.tipo_actividad_id
                 where b.titulo = 'Vieja' and t.nombre = 'Mensaje'
                   and b.autor_id = 'a7a7a7a7-1111-0000-0000-000000000002') then
    raise exception 'FALLA: la bitacora de la app vieja no completo el tipo de catalogo o acepto un autor ajeno';
  end if;
  insert into public.bitacora_entradas (empresa_id, tipo, titulo)
  values ('a7a7a7a7-2222-0000-0000-000000000001', 'consulta', 'Consulta vieja');
  if not exists (select 1 from public.bitacora_entradas b join public.tipos_actividad t on t.id = b.tipo_actividad_id
                 where b.titulo = 'Consulta vieja' and t.codigo = 'otro') then
    raise exception 'FALLA: el tipo viejo "consulta" no se mapeo a Otro';
  end if;

  -- Bitacora como la app nueva: cliente individual (sin empresa), con oportunidad.
  insert into public.bitacora_entradas (contacto_id, oportunidad_id, tipo_actividad_id, titulo, resultado)
  values ('a7a7a7a7-3333-0000-0000-000000000003', 'a7a7a7a7-5555-0000-0000-000000000001',
          (select id from public.tipos_actividad where nombre = 'Reclamo'), 'Nueva', 'Se cambia la red');
  if not exists (select 1 from public.bitacora_entradas where titulo = 'Nueva' and tipo = 'queja' and empresa_id is null) then
    raise exception 'FALLA: la actividad de un cliente individual no se guardo o no completo el tipo viejo';
  end if;
end $$;

-- Asignar a otro al crear, y reasignar: sin permiso, lo frena el trigger.
select pg_temp.debe_fallar(
  $q$insert into public.empresas (nombre, responsable_id) values ('Para otro', 'a7a7a7a7-1111-0000-0000-000000000003')$q$,
  '42501', 'No tenés permiso para asignar o reasignar el responsable.',
  'el vendedor pudo crear una empresa asignada a otro');
select pg_temp.debe_fallar(
  $q$update public.empresas set responsable_id = 'a7a7a7a7-1111-0000-0000-000000000003'
     where id = 'a7a7a7a7-2222-0000-0000-000000000001'$q$,
  '42501', 'No tenés permiso para asignar o reasignar el responsable.',
  'el vendedor pudo reasignar una empresa sin clientes.asignar');
select pg_temp.debe_fallar(
  $q$update public.contactos set responsable_id = 'a7a7a7a7-1111-0000-0000-000000000003'
     where id = 'a7a7a7a7-3333-0000-0000-000000000003'$q$,
  '42501', 'No tenés permiso para asignar o reasignar el responsable.',
  'el vendedor pudo reasignar un contacto sin clientes.asignar');
select pg_temp.debe_fallar(
  $q$update public.oportunidades set responsable_id = 'a7a7a7a7-1111-0000-0000-000000000003'
     where id = 'a7a7a7a7-5555-0000-0000-000000000001'$q$,
  '42501', 'No tenés permiso para asignar o reasignar el responsable.',
  'el vendedor pudo reasignar una oportunidad sin oportunidades.asignar');

-- Catalogos y embudo: sin configuracion.gestionar, la RLS.
select pg_temp.debe_fallar(
  $q$insert into public.origenes (nombre) values ('colado')$q$,
  '42501', 'new row violates row-level security policy for table "origenes"',
  'el vendedor pudo crear un origen');
select pg_temp.debe_fallar(
  $q$insert into public.etapas (nombre, orden) values ('colada', 99)$q$,
  '42501', 'new row violates row-level security policy for table "etapas"',
  'el vendedor pudo crear una etapa');

-- Cargar ventas, items o alertas sobre la cartera de otro: la RLS.
select pg_temp.debe_fallar(
  $q$insert into public.ventas (empresa_id) values ('a7a7a7a7-2222-0000-0000-000000000002')$q$,
  '42501', 'new row violates row-level security policy for table "ventas"',
  'el vendedor pudo cargar una venta a un cliente ajeno');
select pg_temp.debe_fallar(
  $q$insert into public.venta_items (venta_id, producto_id)
     values ('a7a7a7a7-6666-0000-0000-000000000002', 'a7a7a7a7-4444-0000-0000-000000000001')$q$,
  '42501', 'new row violates row-level security policy for table "venta_items"',
  'el vendedor pudo agregar items a una venta ajena');
select pg_temp.debe_fallar(
  $q$insert into public.alertas_enviadas (venta_item_id, canal, destinatario)
     values ('a7a7a7a7-7777-0000-0000-000000000002', 'email', 'x@test.invalid')$q$,
  '42501', 'new row violates row-level security policy for table "alertas_enviadas"',
  'el vendedor pudo registrar una alerta sobre un item ajeno');

-- Actividades: cada referencia tiene que ser visible y coherente (RLS).
select pg_temp.debe_fallar(
  $q$insert into public.bitacora_entradas (empresa_id, oportunidad_id, tipo, titulo)
     values ('a7a7a7a7-2222-0000-0000-000000000002', 'a7a7a7a7-5555-0000-0000-000000000001', 'nota', 'colada en E2')$q$,
  '42501', 'new row violates row-level security policy for table "bitacora_entradas"',
  'el vendedor colgo una actividad en el cliente de otro usando su propia oportunidad');
select pg_temp.debe_fallar(
  $q$insert into public.bitacora_entradas (empresa_id, oportunidad_id, tipo, titulo)
     values ('a7a7a7a7-2222-0000-0000-000000000002', 'a7a7a7a7-5555-0000-0000-000000000003', 'nota', 'colada en E2')$q$,
  '42501', 'new row violates row-level security policy for table "bitacora_entradas"',
  'el vendedor colgo una actividad en el cliente de otro usando su oportunidad sin empresa');
select pg_temp.debe_fallar(
  $q$insert into public.bitacora_entradas (empresa_id, tipo, titulo)
     values ('a7a7a7a7-2222-0000-0000-000000000002', 'nota', 'colada en E2')$q$,
  '42501', 'new row violates row-level security policy for table "bitacora_entradas"',
  'el vendedor registro una actividad en el cliente de otro');
select pg_temp.debe_fallar(
  $q$insert into public.bitacora_entradas (empresa_id, contacto_id, tipo, titulo)
     values ('a7a7a7a7-2222-0000-0000-000000000001', 'a7a7a7a7-3333-0000-0000-000000000003', 'nota', 'contacto de otra empresa')$q$,
  '42501', 'new row violates row-level security policy for table "bitacora_entradas"',
  'se guardo una actividad con un contacto que no es de esa empresa');
select pg_temp.debe_fallar(
  $q$insert into public.bitacora_entradas (empresa_id, oportunidad_id, tipo, titulo)
     values ((select id from public.empresas where nombre = 'Alta del vendedor'),
             'a7a7a7a7-5555-0000-0000-000000000001', 'nota', 'oportunidad de otra empresa')$q$,
  '42501', 'new row violates row-level security policy for table "bitacora_entradas"',
  'se guardo una actividad con una oportunidad que es de otra empresa');
select pg_temp.debe_fallar(
  $q$insert into public.bitacora_entradas (tipo, titulo, oportunidad_id)
     values ('nota', 'huerfana', 'a7a7a7a7-5555-0000-0000-000000000001')$q$,
  '23514', '%violates check constraint "bitacora_entradas_empresa_o_contacto"%',
  'se guardo una actividad sin empresa ni contacto');

-- Reglas del embudo (trigger).
select pg_temp.debe_fallar(
  $q$update public.oportunidades set etapa_id = (select id from public.etapas where tipo = 'perdida')
     where id = 'a7a7a7a7-5555-0000-0000-000000000001'$q$,
  '23514', 'Para marcar la oportunidad como perdida hay que indicar el motivo de pérdida.',
  'se pudo marcar perdida una oportunidad sin motivo (soltar la tarjeta en Perdida)');
select pg_temp.debe_fallar(
  $q$update public.oportunidades set estado = 'ganada' where id = 'a7a7a7a7-5555-0000-0000-000000000001'$q$,
  '23514', 'La etapa elegida no es compatible con el estado "ganada".',
  'una oportunidad quedo ganada en una etapa abierta');

-- Logo: sin configuracion.gestionar, la RLS de Storage.
select pg_temp.debe_fallar(
  $q$insert into storage.objects (bucket_id, name) values ('logos', 'a7a7a7a7-0000-0000-0000-000000000000/logo.png')$q$,
  '42501', 'new row violates row-level security policy for table "objects"',
  'el vendedor pudo subir el logo');

-- Marcar perdida CON motivo (la RPC), editarla cerrada y querer reabrirla.
do $$
declare
  v_op public.oportunidades;
  v_ant uuid := (select etapa_id from public.oportunidades where id = 'a7a7a7a7-5555-0000-0000-000000000001');
  v_perdida uuid := (select id from public.etapas where tipo = 'perdida');
begin
  v_op := public.cambiar_etapa('a7a7a7a7-5555-0000-0000-000000000001', v_perdida,
                               'Eligió el presupuesto más barato',
                               (select id from public.motivos_perdida where nombre = 'Precio'));
  if v_op.estado <> 'perdida' or v_op.fecha_cierre is distinct from current_date or v_op.motivo_perdida_id is null then
    raise exception 'FALLA: perdida con motivo no quedo con estado, fecha de cierre y motivo';
  end if;
  if not exists (select 1 from public.oportunidad_etapas_historial
                 where oportunidad_id = v_op.id and etapa_anterior_id = v_ant and etapa_nueva_id = v_perdida
                   and usuario_id = 'a7a7a7a7-1111-0000-0000-000000000002'
                   and observacion = 'Eligió el presupuesto más barato') then
    raise exception 'FALLA: el cambio de etapa no quedo en el historial con usuario, anterior, nueva y observacion';
  end if;
  if coalesce(current_setting('crm.observacion', true), '') <> '' then
    raise exception 'FALLA: la observacion de cambiar_etapa quedo pegada para el proximo update';
  end if;

  update public.oportunidades set monto = 999 where id = v_op.id;
  if not exists (select 1 from public.oportunidad_auditoria
                 where oportunidad_id = v_op.id and usuario_id = 'a7a7a7a7-1111-0000-0000-000000000002'
                   and (cambios -> 'monto' ->> 'despues')::numeric = 999) then
    raise exception 'FALLA: la edicion de una oportunidad cerrada no quedo auditada';
  end if;
end $$;

select pg_temp.debe_fallar(
  $q$update public.oportunidades set fecha_cierre = null where id = 'a7a7a7a7-5555-0000-0000-000000000001'$q$,
  '23514', 'Una oportunidad cerrada tiene que tener fecha real de cierre.',
  'a una oportunidad cerrada se le pudo borrar la fecha de cierre');
select pg_temp.debe_fallar(
  $q$select public.cambiar_etapa('a7a7a7a7-5555-0000-0000-000000000001',
                                 (select id from public.etapas where orden = 2), 'reabro')$q$,
  '42501', 'La oportunidad está cerrada: reabrirla requiere autorización (oportunidades.reabrir).',
  'el vendedor pudo reabrir una oportunidad con cambiar_etapa sin oportunidades.reabrir');
select pg_temp.debe_fallar(
  $q$update public.oportunidades set etapa_id = (select id from public.etapas where orden = 2)
     where id = 'a7a7a7a7-5555-0000-0000-000000000001'$q$,
  '42501', 'La oportunidad está cerrada: reabrirla requiere autorización (oportunidades.reabrir).',
  'el vendedor pudo reabrir una oportunidad con un update directo sin oportunidades.reabrir');

-- ══ SOY RESPONSABLE COMERCIAL ═════════════════════════════════════════════════
select set_config('request.jwt.claims', '{"sub":"a7a7a7a7-1111-0000-0000-000000000004","role":"authenticated"}', true);

do $$
declare
  n int;
  v_op public.oportunidades;
  v_ganada uuid := (select id from public.etapas where tipo = 'ganada');
  v_perdida uuid := (select id from public.etapas where tipo = 'perdida');
begin
  if (select count(*) from public.empresas) <> 3 or (select count(*) from public.oportunidades) <> 4
     or (select count(*) from public.alertas_enviadas) <> 1 then
    raise exception 'FALLA: el responsable comercial no ve toda la cartera del equipo';
  end if;

  -- Reabrir: con permiso, si. Limpia fecha de cierre y motivo.
  v_op := public.cambiar_etapa('a7a7a7a7-5555-0000-0000-000000000001',
                               (select id from public.etapas where orden = 2), 'El club volvió a llamar');
  if v_op.estado <> 'abierta' or v_op.fecha_cierre is not null or v_op.motivo_perdida_id is not null then
    raise exception 'FALLA: reabrir no dejo la oportunidad abierta y sin datos de cierre';
  end if;
  if not exists (select 1 from public.oportunidad_etapas_historial
                 where oportunidad_id = v_op.id and usuario_id = 'a7a7a7a7-1111-0000-0000-000000000004'
                   and observacion = 'El club volvió a llamar') then
    raise exception 'FALLA: la reapertura no quedo en el historial';
  end if;

  -- Reasignar: con permiso, si.
  update public.oportunidades set responsable_id = 'a7a7a7a7-1111-0000-0000-000000000002'
  where id = 'a7a7a7a7-5555-0000-0000-000000000002';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FALLA: el responsable comercial no pudo reasignar'; end if;

  -- Ganada por update directo (el tablero viejo): fecha de cierre hoy.
  update public.oportunidades set etapa_id = v_ganada where id = 'a7a7a7a7-5555-0000-0000-000000000002';
  if not exists (select 1 from public.oportunidades where id = 'a7a7a7a7-5555-0000-0000-000000000002'
                 and estado = 'ganada' and fecha_cierre = current_date) then
    raise exception 'FALLA: marcar ganada no registro el estado y la fecha real de cierre';
  end if;

  -- Cambiar el resultado (ganada -> perdida): la fecha es la del NUEVO cierre,
  -- no la del anterior. Sin fecha explicita, hoy; con fecha, esa.
  update public.oportunidades set fecha_cierre = current_date - 10 where id = 'a7a7a7a7-5555-0000-0000-000000000002';
  v_op := public.cambiar_etapa('a7a7a7a7-5555-0000-0000-000000000002', v_perdida, 'Devolvió el pedido',
                               (select id from public.motivos_perdida where nombre = 'Plazo de entrega'));
  if v_op.estado <> 'perdida' or v_op.fecha_cierre <> current_date then
    raise exception 'FALLA: al pasar de ganada a perdida la fecha de cierre quedo en % (deberia ser hoy)', v_op.fecha_cierre;
  end if;
  v_op := public.cambiar_etapa('a7a7a7a7-5555-0000-0000-000000000002', v_ganada, 'Finalmente lo compró',
                               null, current_date - 2);
  if v_op.estado <> 'ganada' or v_op.fecha_cierre <> current_date - 2 or v_op.motivo_perdida_id is not null then
    raise exception 'FALLA: al pasar de perdida a ganada con fecha explicita no quedo esa fecha (o quedo el motivo)';
  end if;

  -- Ni el responsable comercial borra oportunidades.
  if pg_temp.filas($q$delete from public.oportunidades where id = 'a7a7a7a7-5555-0000-0000-000000000002'$q$) <> 0 then
    raise exception 'FALLA: el responsable comercial pudo borrar una oportunidad';
  end if;
end $$;

select pg_temp.debe_fallar(
  $q$insert into public.motivos_perdida (nombre) values ('colado')$q$,
  '42501', 'new row violates row-level security policy for table "motivos_perdida"',
  'el responsable comercial pudo crear un motivo sin configuracion.gestionar');

-- ══ SOY SOLO LECTURA: sigue viendo todos los clientes (no regresiona) ═════════
select set_config('request.jwt.claims', '{"sub":"a7a7a7a7-1111-0000-0000-000000000005","role":"authenticated"}', true);

do $$ begin
  if (select count(*) from public.empresas) <> 3 or exists (select 1 from public.oportunidades) then
    raise exception 'FALLA: Solo lectura no ve todos los clientes, o ve oportunidades sin permiso';
  end if;
end $$;

-- ══ SOY ADMIN DE A ════════════════════════════════════════════════════════════
select set_config('request.jwt.claims', '{"sub":"a7a7a7a7-1111-0000-0000-000000000001","role":"authenticated"}', true);

do $$
declare n int;
begin
  insert into public.origenes (nombre, orden) values ('Instagram', 8);
  update public.tipos_actividad set nombre = 'Llamado telefónico' where codigo = 'llamada';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FALLA: el admin no pudo editar un tipo de actividad'; end if;
  insert into public.etapas (nombre, orden, tipo) values ('Muestra entregada', 7, 'abierta');

  update public.organizaciones set razon_social = 'Tuco SA', presupuesto_validez_dias = 30;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FALLA: el admin no pudo cargar los datos de su empresa'; end if;

  insert into storage.objects (bucket_id, name) values ('logos', 'a7a7a7a7-0000-0000-0000-000000000000/logo.png');
  if (select count(*) from storage.objects where bucket_id = 'logos') <> 1 then
    raise exception 'FALLA: el admin de A ve un logo que no es el suyo';
  end if;

  -- El logo de B: ni cambiarlo ni borrarlo (no lo ve: 0 filas).
  if pg_temp.filas($q$update storage.objects set name = name where name like 'b7b7b7b7-%'$q$) <> 0
     or pg_temp.filas($q$delete from storage.objects where name like 'b7b7b7b7-%'$q$) <> 0 then
    raise exception 'FALLA: el admin de A pudo cambiar o borrar el logo de B';
  end if;

  -- Puede asignar a otro al crear.
  insert into public.empresas (nombre, responsable_id) values ('Asignada por admin', 'a7a7a7a7-1111-0000-0000-000000000003');

  -- Ni el admin borra oportunidades.
  if pg_temp.filas($q$delete from public.oportunidades$q$) <> 0 then
    raise exception 'FALLA: el admin pudo borrar oportunidades';
  end if;
end $$;

select pg_temp.debe_fallar(
  $q$update storage.objects set name = 'b7b7b7b7-0000-0000-0000-000000000000/logo.webp'
     where name = 'a7a7a7a7-0000-0000-0000-000000000000/logo.png'$q$,
  '42501', 'new row violates row-level security policy for table "objects"',
  'el admin de A pudo mover su logo a la carpeta de B');
select pg_temp.debe_fallar(
  $q$insert into storage.objects (bucket_id, name) values ('logos', 'a7a7a7a7-0000-0000-0000-000000000000/logo.svg')$q$,
  '42501', 'new row violates row-level security policy for table "objects"',
  'se pudo subir un logo SVG');
select pg_temp.debe_fallar(
  $q$insert into storage.objects (bucket_id, name) values ('logos', 'b7b7b7b7-0000-0000-0000-000000000000/logo.png')$q$,
  '42501', 'new row violates row-level security policy for table "objects"',
  'el admin de A pudo subir el logo de B');

select pg_temp.debe_fallar(
  $q$update public.etapas set tipo = 'ganada' where orden = 1$q$,
  '23514', 'La etapa "Consulta recibida" tiene oportunidades: movelas antes de cambiarle el tipo.',
  'se pudo cambiar el tipo de una etapa con oportunidades adentro');
select pg_temp.debe_fallar(
  $q$update public.organizaciones set activa = false$q$,
  '42501', 'El nombre y el estado de la organización los administra la plataforma.',
  'el admin del cliente pudo suspender su propia organizacion');
select pg_temp.debe_fallar(
  $q$update public.organizaciones set nombre = 'otro nombre'$q$,
  '42501', 'El nombre y el estado de la organización los administra la plataforma.',
  'el admin del cliente pudo renombrar su organizacion');
select pg_temp.debe_fallar(
  $q$insert into public.oportunidades (titulo, etapa_id, responsable_id)
     values ('para B', (select id from public.etapas where orden = 1), 'b7b7b7b7-1111-0000-0000-000000000001')$q$,
  '23514', 'El responsable tiene que ser un usuario de la misma organización.',
  'una oportunidad de A quedo asignada a un usuario de B');

-- Un contacto con actividades no se borra fisicamente (baja logica por estado):
-- lo frena la FK, con un error que dice que esta referenciado.
select pg_temp.debe_fallar(
  $q$delete from public.contactos where id = 'a7a7a7a7-3333-0000-0000-000000000003'$q$,
  '23503', '%violates foreign key constraint "bitacora_entradas_contacto_id_fkey"%',
  'se pudo borrar un contacto con actividades');

-- ══ SOY ADMIN DE B: no ve nada de A en las tablas nuevas ══════════════════════
select set_config('request.jwt.claims', '{"sub":"b7b7b7b7-1111-0000-0000-000000000001","role":"authenticated"}', true);

do $$ begin
  if exists (select 1 from public.origenes where organizacion_id = 'a7a7a7a7-0000-0000-0000-000000000000')
     or exists (select 1 from public.motivos_perdida where organizacion_id = 'a7a7a7a7-0000-0000-0000-000000000000')
     or exists (select 1 from public.tipos_actividad where organizacion_id = 'a7a7a7a7-0000-0000-0000-000000000000')
     or exists (select 1 from public.oportunidad_etapas_historial where organizacion_id = 'a7a7a7a7-0000-0000-0000-000000000000')
     or exists (select 1 from public.oportunidad_auditoria where organizacion_id = 'a7a7a7a7-0000-0000-0000-000000000000')
     or exists (select 1 from storage.objects where name like 'a7a7a7a7-%') then
    raise exception 'FALLA: B ve catalogos, historial, auditoria o el logo de A';
  end if;
  if (select count(*) from public.origenes) <> 7 then
    raise exception 'FALLA: B no ve exactamente sus 7 origenes';
  end if;
  if not exists (select 1 from storage.objects where name = 'b7b7b7b7-0000-0000-0000-000000000000/logo.png') then
    raise exception 'FALLA: B no ve su propio logo';
  end if;
  if (select razon_social from public.organizaciones) is not null then
    raise exception 'FALLA: B ve datos de empresa que no son los suyos';
  end if;
end $$;

select pg_temp.debe_fallar(
  $q$select public.cambiar_etapa('a7a7a7a7-5555-0000-0000-000000000001',
                                 (select id from public.etapas where orden = 1))$q$,
  '42501', 'No existe la oportunidad o no tenés permiso para modificarla.',
  'B pudo mover de etapa una oportunidad de A');

-- ══ SIN SESION ════════════════════════════════════════════════════════════════
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

do $$ begin
  if exists (select 1 from public.origenes) or exists (select 1 from public.motivos_perdida)
     or exists (select 1 from public.tipos_actividad) or exists (select 1 from public.oportunidad_etapas_historial)
     or exists (select 1 from public.oportunidad_auditoria) or exists (select 1 from storage.objects where bucket_id = 'logos') then
    raise exception 'FALLA: un visitante sin sesion ve datos de las tablas nuevas';
  end if;
end $$;

-- ══ SIN USUARIO (service_role / scripts): las reglas valen, el permiso no ═════
reset role;
select set_config('request.jwt.claims', '', true);

do $$
declare v_op public.oportunidades;
begin
  -- O2 esta ganada; sin usuario se puede reabrir y el historial queda sin autor.
  v_op := public.cambiar_etapa('a7a7a7a7-5555-0000-0000-000000000002',
                               (select id from public.etapas where organizacion_id = 'a7a7a7a7-0000-0000-0000-000000000000' and orden = 1),
                               'Ajuste del sistema');
  if v_op.estado <> 'abierta' or not exists (
       select 1 from public.oportunidad_etapas_historial
       where oportunidad_id = v_op.id and usuario_id is null and observacion = 'Ajuste del sistema') then
    raise exception 'FALLA: sin usuario no se pudo cambiar de etapa o el historial no quedo registrado';
  end if;

  if not exists (select 1 from storage.buckets where id = 'logos' and not public
                 and file_size_limit = 1048576
                 and allowed_mime_types @> array['image/png', 'image/jpeg', 'image/webp']
                 and array_length(allowed_mime_types, 1) = 3) then
    raise exception 'FALLA: el bucket logos no es privado o no limita a PNG/JPG/WebP de 1 MB';
  end if;

  -- Una cerrada mas (Alta vieja, ganada) para la prueba de borrar la organizacion.
  perform public.cambiar_etapa((select id from public.oportunidades where titulo = 'Alta vieja'),
                               (select id from public.etapas where organizacion_id = 'a7a7a7a7-0000-0000-0000-000000000000' and tipo = 'ganada'));
end $$;

select pg_temp.debe_fallar(
  $q$update public.oportunidades
     set etapa_id = (select id from public.etapas where organizacion_id = 'a7a7a7a7-0000-0000-0000-000000000000' and tipo = 'perdida')
     where id = 'a7a7a7a7-5555-0000-0000-000000000002'$q$,
  '23514', 'Para marcar la oportunidad como perdida hay que indicar el motivo de pérdida.',
  'sin usuario se pudo marcar perdida sin motivo');

-- Ni postgres borra una oportunidad con historial: NO ACTION de la FK.
select pg_temp.debe_fallar(
  $q$delete from public.oportunidades where id = 'a7a7a7a7-5555-0000-0000-000000000001'$q$,
  '23503', '%violates foreign key constraint "oportunidad_etapas_historial_oportunidad_id_fkey"%',
  'se pudo borrar fisicamente una oportunidad con historial');

-- ══ BORRAR UNA ORGANIZACION ENTERA (superadmin) SIGUE ANDANDO ═════════════════
-- A tiene oportunidades cerradas, historial, auditoria, actividades de un
-- cliente individual y contactos referenciados; sus perfiles se van en el
-- mismo cascade.
do $$
declare
  a constant uuid := 'a7a7a7a7-0000-0000-0000-000000000000';
begin
  if (select count(*) from public.oportunidades where organizacion_id = a and estado <> 'abierta') = 0
     or not exists (select 1 from public.oportunidad_etapas_historial where organizacion_id = a)
     or not exists (select 1 from public.oportunidad_auditoria where organizacion_id = a)
     or not exists (select 1 from public.bitacora_entradas where organizacion_id = a and empresa_id is null) then
    raise exception 'FALLA: la organizacion A no llego con cerradas, historial, auditoria y actividades de contacto';
  end if;

  delete from public.organizaciones where id = a;

  if exists (select 1 from public.oportunidades where organizacion_id = a)
     or exists (select 1 from public.oportunidad_etapas_historial where organizacion_id = a)
     or exists (select 1 from public.oportunidad_auditoria where organizacion_id = a)
     or exists (select 1 from public.bitacora_entradas where organizacion_id = a)
     or exists (select 1 from public.contactos where organizacion_id = a) then
    raise exception 'FALLA: borrar la organizacion dejo filas huerfanas';
  end if;
end $$;

reset role;
rollback;

-- Solo se llega hasta aca si ninguna prueba corto con "FALLA:". Va despues del
-- rollback porque el SQL Editor muestra el resultado de la ULTIMA sentencia.
select 'TODO OK: reglas de la 0007 verificadas. Nada quedo guardado (rollback).' as resultado;
