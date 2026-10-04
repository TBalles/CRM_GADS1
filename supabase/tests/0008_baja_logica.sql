-- Tuco & Nito - PRUEBA DE LA BAJA LOGICA (0008)
--
-- Correr en el SQL Editor de Supabase DESPUES de aplicar la 0008 (o, para
-- ensayarla sin aplicarla: `begin;` + 0007 + 0008 + este archivo; el ROLLBACK de
-- aca abajo deshace todo).
--
-- Prueba que, en la base y no solo en la interfaz:
--   - un DELETE de empresas o contactos toca 0 filas para quien tiene
--     clientes.editar y ve la fila (Administrador, Vendedor dueno de la cartera):
--     no queda ninguna politica de borrar;
--   - la empresa con ventas y bitacora sigue entera despues del intento;
--   - la baja logica (estado = 'inactivo') anda, tambien para el Vendedor sobre
--     lo suyo;
--   - el embudo conserva siempre una etapa ganada y una perdida (trigger);
--   - borrar una organizacion entera (superadmin / postgres) sigue andando.
--
-- 0007_reglas.sql sigue valiendo con la 0008 aplicada: el borrado de un contacto
-- con actividades ya no llega a la FK (lo frena la RLS con 0 filas) y esa prueba
-- acepta las dos cosas.
--
-- NO DEJA NADA EN LA BASE: todo corre dentro de una transaccion con ROLLBACK.
--
-- Resultado esperado: una fila que dice "TODO OK". Si algo falla, se corta con
-- un ERROR que empieza con "FALLA:".
--
-- Ids: A = a8a8a8a8-..., usuarios: ...-1111-...-01 admin, 02 vendedor.

begin;

create function pg_temp.filas(p_sql text)
returns int language plpgsql as $f$
declare n int;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end $f$;

grant execute on function pg_temp.filas(text) to authenticated;

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

grant execute on function pg_temp.debe_fallar(text, text, text, text) to authenticated;

insert into public.organizaciones (id, nombre) values ('a8a8a8a8-0000-0000-0000-000000000000', 'TEST 0008 Org A');

insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select v.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', v.email,
       jsonb_build_object('organizacion_id', 'a8a8a8a8-0000-0000-0000-000000000000',
                          'rol_id', (select id from public.roles
                                     where organizacion_id = 'a8a8a8a8-0000-0000-0000-000000000000' and nombre = v.rol)),
       jsonb_build_object('nombre', v.email), now(), now()
from (values
  ('a8a8a8a8-1111-0000-0000-000000000001'::uuid, 'a8.admin@test.invalid', 'Administrador'),
  ('a8a8a8a8-1111-0000-0000-000000000002'::uuid, 'a8.vend@test.invalid',  'Vendedor')
) as v(id, email, rol);

-- Una empresa del vendedor con contacto, venta y actividad: justo lo que el
-- on delete cascade se llevaba puesto.
insert into public.empresas (id, organizacion_id, nombre, responsable_id) values
  ('a8a8a8a8-2222-0000-0000-000000000001', 'a8a8a8a8-0000-0000-0000-000000000000', 'E1 del vendedor', 'a8a8a8a8-1111-0000-0000-000000000002');
insert into public.contactos (id, organizacion_id, empresa_id, nombre, responsable_id) values
  ('a8a8a8a8-3333-0000-0000-000000000001', 'a8a8a8a8-0000-0000-0000-000000000000', 'a8a8a8a8-2222-0000-0000-000000000001', 'C1 de E1', 'a8a8a8a8-1111-0000-0000-000000000002');
insert into public.ventas (id, organizacion_id, empresa_id) values
  ('a8a8a8a8-6666-0000-0000-000000000001', 'a8a8a8a8-0000-0000-0000-000000000000', 'a8a8a8a8-2222-0000-0000-000000000001');
insert into public.bitacora_entradas (organizacion_id, empresa_id, tipo, titulo) values
  ('a8a8a8a8-0000-0000-0000-000000000000', 'a8a8a8a8-2222-0000-0000-000000000001', 'llamada', 'Llamada a E1');

-- Ninguna politica de DELETE en las dos tablas.
do $$ begin
  if exists (select 1 from pg_policies
             where schemaname = 'public' and tablename in ('empresas', 'contactos') and cmd in ('DELETE', 'ALL')) then
    raise exception 'FALLA: empresas o contactos todavia tienen una politica que permite borrar';
  end if;
end $$;

-- ══ SOY EL ADMIN: tiene clientes.editar y ve toda la cartera ══════════════════
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a8a8a8a8-1111-0000-0000-000000000001","role":"authenticated"}', true);

do $$ begin
  if pg_temp.filas($q$delete from public.contactos where id = 'a8a8a8a8-3333-0000-0000-000000000001'$q$) <> 0 then
    raise exception 'FALLA: el admin pudo borrar un contacto';
  end if;
  if pg_temp.filas($q$delete from public.empresas where id = 'a8a8a8a8-2222-0000-0000-000000000001'$q$) <> 0 then
    raise exception 'FALLA: el admin pudo borrar una empresa';
  end if;
  if pg_temp.filas($q$delete from public.empresas$q$) <> 0 or pg_temp.filas($q$delete from public.contactos$q$) <> 0 then
    raise exception 'FALLA: un delete sin filtro borro empresas o contactos';
  end if;
  if not exists (select 1 from public.empresas where id = 'a8a8a8a8-2222-0000-0000-000000000001')
     or not exists (select 1 from public.contactos where id = 'a8a8a8a8-3333-0000-0000-000000000001')
     or not exists (select 1 from public.ventas where id = 'a8a8a8a8-6666-0000-0000-000000000001')
     or not exists (select 1 from public.bitacora_entradas where empresa_id = 'a8a8a8a8-2222-0000-0000-000000000001') then
    raise exception 'FALLA: despues del intento de borrado la empresa, su contacto, su venta o su actividad ya no estan';
  end if;
end $$;

-- ══ SOY EL VENDEDOR dueno de la cartera: tampoco ═══════════════════════════════
select set_config('request.jwt.claims', '{"sub":"a8a8a8a8-1111-0000-0000-000000000002","role":"authenticated"}', true);

do $$ begin
  if pg_temp.filas($q$delete from public.contactos where id = 'a8a8a8a8-3333-0000-0000-000000000001'$q$) <> 0
     or pg_temp.filas($q$delete from public.empresas where id = 'a8a8a8a8-2222-0000-0000-000000000001'$q$) <> 0 then
    raise exception 'FALLA: el vendedor pudo borrar su propia empresa o contacto';
  end if;

  -- La baja logica SI anda: un update de estado.
  if pg_temp.filas($q$update public.contactos set estado = 'inactivo' where id = 'a8a8a8a8-3333-0000-0000-000000000001'$q$) <> 1
     or pg_temp.filas($q$update public.empresas set estado = 'inactivo' where id = 'a8a8a8a8-2222-0000-0000-000000000001'$q$) <> 1 then
    raise exception 'FALLA: el vendedor no pudo dar de baja (estado inactivo) su propia empresa y contacto';
  end if;
  if not exists (select 1 from public.empresas where id = 'a8a8a8a8-2222-0000-0000-000000000001' and estado = 'inactivo')
     or not exists (select 1 from public.contactos where id = 'a8a8a8a8-3333-0000-0000-000000000001' and estado = 'inactivo') then
    raise exception 'FALLA: la baja logica no quedo guardada';
  end if;
end $$;

-- ══ EMBUDO: la ultima ganada y la ultima perdida no se pueden sacar ═══════════
select set_config('request.jwt.claims', '{"sub":"a8a8a8a8-1111-0000-0000-000000000001","role":"authenticated"}', true);

select pg_temp.debe_fallar(
  $q$update public.etapas set tipo = 'abierta' where tipo = 'ganada'$q$,
  '23514', 'Tiene que quedar al menos una etapa de tipo Ganada%',
  'se pudo cambiar el tipo de la unica etapa ganada');
select pg_temp.debe_fallar(
  $q$delete from public.etapas where tipo = 'perdida'$q$,
  '23514', 'Tiene que quedar al menos una etapa de tipo Perdida%',
  'se pudo borrar la unica etapa perdida');
select pg_temp.debe_fallar(
  $q$update public.etapas set tipo = 'ganada' where tipo = 'perdida'$q$,
  '23514', 'Tiene que quedar al menos una etapa de tipo Perdida%',
  'se pudo cambiar la unica perdida a ganada');

do $$ begin
  -- Con una segunda ganada, la primera se puede retipear y la segunda borrar...
  insert into public.etapas (nombre, orden, tipo) values ('Ganada extra', 20, 'ganada');
  if pg_temp.filas($q$update public.etapas set tipo = 'abierta' where nombre = 'Entregado'$q$) <> 1 then
    raise exception 'FALLA: no se pudo cambiar el tipo de una ganada habiendo otra';
  end if;
  -- ...pero ahora la extra es la unica.
  if (select count(*) from public.etapas where tipo = 'ganada') <> 1 then
    raise exception 'FALLA: deberia quedar exactamente una etapa ganada';
  end if;
  insert into public.etapas (nombre, orden, tipo) values ('Perdida extra', 21, 'perdida');
  if pg_temp.filas($q$delete from public.etapas where nombre = 'Perdida'$q$) <> 1 then
    raise exception 'FALLA: no se pudo borrar una perdida habiendo otra';
  end if;
end $$;

-- Las abiertas se mueven y borran libremente.
do $$ begin
  if pg_temp.filas($q$delete from public.etapas where tipo = 'abierta' and nombre = 'Negociación'$q$) <> 1 then
    raise exception 'FALLA: no se pudo borrar una etapa abierta';
  end if;
end $$;

-- ══ SIN USUARIO (superadmin / service_role): borrar la organizacion sigue andando
reset role;
select set_config('request.jwt.claims', '', true);

do $$
declare
  a constant uuid := 'a8a8a8a8-0000-0000-0000-000000000000';
begin
  delete from public.organizaciones where id = a;
  if exists (select 1 from public.empresas where organizacion_id = a)
     or exists (select 1 from public.contactos where organizacion_id = a)
     or exists (select 1 from public.ventas where organizacion_id = a)
     or exists (select 1 from public.bitacora_entradas where organizacion_id = a) then
    raise exception 'FALLA: borrar la organizacion dejo filas huerfanas';
  end if;
end $$;

rollback;

-- Solo se llega hasta aca si ninguna prueba corto con "FALLA:". Va despues del
-- rollback porque el SQL Editor muestra el resultado de la ULTIMA sentencia.
select 'TODO OK: baja logica de la 0008 verificada. Nada quedo guardado (rollback).' as resultado;
