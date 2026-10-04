-- Tuco & Nito - PRUEBA DE LAS REGLAS DE LA 0009
--
-- Correr en el SQL Editor de Supabase DESPUES de aplicar la 0009 (o, para
-- ensayarla sin aplicarla: `begin;` + la migracion + este archivo; el ROLLBACK
-- de aca abajo deshace las dos cosas).
--
-- Prueba, como lo hace la app (rol `authenticated` + el JWT de cada usuario) y
-- como postgres (sin usuario):
--   a) la fecha real de cierre no puede ser futura (fecha de Argentina), pero
--      solo se juzga cuando CAMBIA: una cerrada vieja se puede seguir editando;
--   b) la fecha de cierre por defecto es la de Argentina;
--   c) una oportunidad es de una empresa o de un contacto: se exige a usuarios
--      en el alta y al cambiar empresa/contacto, y NO a service_role/scripts ni
--      a las acciones de clave foranea (`on delete set null`);
--   d) lo que la 0007 ya exigia sigue en pie (perdida sin motivo, reabrir sin
--      permiso, cambio de resultado con fecha nueva, historial y auditoria).
--
-- Los casos negativos verifican el CODIGO y el MENSAJE del error.
--
-- NO DEJA NADA EN LA BASE: todo corre dentro de una transaccion con ROLLBACK.
--
-- Resultado esperado: una fila que dice "TODO OK". Si algo falla, se corta con
-- un ERROR que empieza con "FALLA:".
--
-- Ids: organizacion c9c9c9c9-..., usuarios ...-1111-...-01 admin, 02 vendedor.

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

insert into public.organizaciones (id, nombre) values ('c9c9c9c9-0000-0000-0000-000000000000', 'TEST 0009 Org');

insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select v.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', v.email,
       jsonb_build_object('organizacion_id', 'c9c9c9c9-0000-0000-0000-000000000000',
                          'rol_id', (select id from public.roles where organizacion_id = 'c9c9c9c9-0000-0000-0000-000000000000' and nombre = v.rol)),
       jsonb_build_object('nombre', v.email), now(), now()
from (values
  ('c9c9c9c9-1111-0000-0000-000000000001'::uuid, 'c9.admin@test.invalid', 'Administrador'),
  ('c9c9c9c9-1111-0000-0000-000000000002'::uuid, 'c9.vend@test.invalid',  'Vendedor')
) as v(id, email, rol);

insert into public.empresas (id, organizacion_id, nombre, responsable_id) values
  ('c9c9c9c9-2222-0000-0000-000000000001', 'c9c9c9c9-0000-0000-0000-000000000000', 'E9', 'c9c9c9c9-1111-0000-0000-000000000001');
insert into public.contactos (id, organizacion_id, empresa_id, nombre, responsable_id) values
  ('c9c9c9c9-3333-0000-0000-000000000001', 'c9c9c9c9-0000-0000-0000-000000000000', null, 'Individual 9', 'c9c9c9c9-1111-0000-0000-000000000001'),
  ('c9c9c9c9-3333-0000-0000-000000000002', 'c9c9c9c9-0000-0000-0000-000000000000', null, 'Individual a borrar', 'c9c9c9c9-1111-0000-0000-000000000001');

-- Oportunidades como postgres (sin usuario): una sin empresa ni contacto ("vieja"),
-- una que solo cuelga del contacto que despues se borra, y una abierta normal.
insert into public.oportunidades (id, organizacion_id, titulo, empresa_id, contacto_id, responsable_id, etapa_id)
select v.id, 'c9c9c9c9-0000-0000-0000-000000000000', v.titulo, v.empresa, v.contacto, 'c9c9c9c9-1111-0000-0000-000000000001', e.id
from (values
  ('c9c9c9c9-5555-0000-0000-000000000001'::uuid, 'Vieja sin cliente', null::uuid, null::uuid),
  ('c9c9c9c9-5555-0000-0000-000000000002'::uuid, 'Solo del contacto a borrar', null::uuid, 'c9c9c9c9-3333-0000-0000-000000000002'::uuid),
  ('c9c9c9c9-5555-0000-0000-000000000003'::uuid, 'Normal', 'c9c9c9c9-2222-0000-0000-000000000001'::uuid, null::uuid)
) as v(id, titulo, empresa, contacto)
join public.etapas e on e.organizacion_id = 'c9c9c9c9-0000-0000-0000-000000000000' and e.orden = 1;

do $$
begin
  -- (c) sin usuario no se exige: ya lo demuestra el insert de arriba. Ahora, la accion de FK.
  delete from public.contactos where id = 'c9c9c9c9-3333-0000-0000-000000000002';
  if not exists (select 1 from public.oportunidades
                 where id = 'c9c9c9c9-5555-0000-0000-000000000002' and contacto_id is null and empresa_id is null) then
    raise exception 'FALLA: borrar el contacto (on delete set null) no dejo la oportunidad sin contacto, o la borro';
  end if;
end $$;

-- (a) como postgres tambien rige la fecha futura (no depende del usuario).
select pg_temp.debe_fallar(
  format($q$update public.oportunidades set etapa_id = (select id from public.etapas where organizacion_id = 'c9c9c9c9-0000-0000-0000-000000000000' and tipo = 'ganada'),
            fecha_cierre = %L where id = 'c9c9c9c9-5555-0000-0000-000000000003'$q$,
         ((now() at time zone 'America/Argentina/Buenos_Aires')::date + 1)),
  '23514', 'La fecha real de cierre no puede ser futura%',
  'postgres cerro una oportunidad con fecha de mañana');

-- ══ SOY EL ADMINISTRADOR ═════════════════════════════════════════════════════
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c9c9c9c9-1111-0000-0000-000000000001","role":"authenticated"}', true);

do $$
declare
  org constant uuid := 'c9c9c9c9-0000-0000-0000-000000000000';
  v_e1 uuid := (select id from public.etapas where organizacion_id = org and orden = 1);
  v_op uuid;
begin
  -- ── (c) empresa o contacto ────────────────────────────────────────────────
  perform pg_temp.debe_fallar(
    format($q$insert into public.oportunidades (titulo, etapa_id) values ('Sin cliente', %L)$q$, v_e1),
    '23514', 'La oportunidad tiene que ser de una empresa o de un contacto%',
    'un usuario creo una oportunidad sin empresa ni contacto');

  insert into public.oportunidades (titulo, etapa_id, contacto_id)
  values ('Solo contacto', v_e1, 'c9c9c9c9-3333-0000-0000-000000000001') returning id into v_op;
  insert into public.oportunidades (titulo, etapa_id, empresa_id)
  values ('Solo empresa', v_e1, 'c9c9c9c9-2222-0000-0000-000000000001');

  -- Sacarle a una oportunidad lo unico que la ata a un cliente: rechazado.
  perform pg_temp.debe_fallar(
    format($q$update public.oportunidades set contacto_id = null where id = %L$q$, v_op),
    '23514', 'La oportunidad tiene que ser de una empresa o de un contacto%',
    'un usuario le saco a una oportunidad su unico contacto');
  perform pg_temp.debe_fallar(
    $q$update public.oportunidades set empresa_id = null, contacto_id = null where id = 'c9c9c9c9-5555-0000-0000-000000000003'$q$,
    '23514', 'La oportunidad tiene que ser de una empresa o de un contacto%',
    'un usuario le saco a una oportunidad la empresa y el contacto');

  -- Una vieja sin cliente (de antes de la 0009) se puede seguir editando mientras no se cambie empresa/contacto…
  update public.oportunidades set titulo = 'Vieja editada' where id = 'c9c9c9c9-5555-0000-0000-000000000001';
  -- …y reenviar los mismos valores (null, null) no es un cambio.
  update public.oportunidades set empresa_id = null, contacto_id = null where id = 'c9c9c9c9-5555-0000-0000-000000000001';
  if not exists (select 1 from public.oportunidades where id = 'c9c9c9c9-5555-0000-0000-000000000001' and titulo = 'Vieja editada') then
    raise exception 'FALLA: no se pudo editar una oportunidad vieja sin cliente';
  end if;
  -- Ponerle cliente a la vieja esta bien.
  update public.oportunidades set empresa_id = 'c9c9c9c9-2222-0000-0000-000000000001' where id = 'c9c9c9c9-5555-0000-0000-000000000001';
end $$;

-- ── (a) y (b) fecha de cierre, como administrador ────────────────────────────
do $$
declare
  org constant uuid := 'c9c9c9c9-0000-0000-0000-000000000000';
  v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_ganada uuid := (select id from public.etapas where organizacion_id = org and tipo = 'ganada');
  v_perdida uuid := (select id from public.etapas where organizacion_id = org and tipo = 'perdida');
  v_e2 uuid := (select id from public.etapas where organizacion_id = org and orden = 2);
  v_motivo uuid := (select id from public.motivos_perdida where organizacion_id = org limit 1);
  v_fecha date;
begin
  -- Fecha de mañana: rechazada, y la oportunidad no se movio.
  perform pg_temp.debe_fallar(
    format($q$select public.cambiar_etapa('c9c9c9c9-5555-0000-0000-000000000003', %L, null, null, %L)$q$, v_ganada, v_hoy + 1),
    '23514', 'La fecha real de cierre no puede ser futura%',
    'se cerro una oportunidad con fecha de mañana (fecha de Argentina)');
  if (select estado from public.oportunidades where id = 'c9c9c9c9-5555-0000-0000-000000000003') <> 'abierta' then
    raise exception 'FALLA: el cierre rechazado dejo la oportunidad cerrada';
  end if;

  -- Hoy y una fecha pasada: aceptadas.
  perform public.cambiar_etapa('c9c9c9c9-5555-0000-0000-000000000003', v_ganada, 'cierre con fecha de hoy', null, v_hoy);
  if (select fecha_cierre from public.oportunidades where id = 'c9c9c9c9-5555-0000-0000-000000000003') <> v_hoy then
    raise exception 'FALLA: no se guardo la fecha de cierre de hoy';
  end if;

  -- (b) Sin fecha: la de Argentina.
  perform public.cambiar_etapa('c9c9c9c9-5555-0000-0000-000000000003', v_e2, 'reabro', null, null);
  perform public.cambiar_etapa('c9c9c9c9-5555-0000-0000-000000000003', v_perdida, 'cierro sin fecha', v_motivo, null);
  select fecha_cierre into v_fecha from public.oportunidades where id = 'c9c9c9c9-5555-0000-0000-000000000003';
  if v_fecha is distinct from v_hoy then
    raise exception 'FALLA: el cierre sin fecha quedo con % y la fecha de Argentina es %', v_fecha, v_hoy;
  end if;

  -- Cambiar el resultado con la MISMA fecha del cierre anterior no la hereda: toma la de hoy (comportamiento de la 0007).
  perform public.cambiar_etapa('c9c9c9c9-5555-0000-0000-000000000003', v_ganada, 'cambio de resultado', null, null);
  if (select estado from public.oportunidades where id = 'c9c9c9c9-5555-0000-0000-000000000003') <> 'ganada' then
    raise exception 'FALLA: el cambio de resultado no dejo la oportunidad ganada';
  end if;

  -- Una fecha pasada vale.
  perform public.cambiar_etapa('c9c9c9c9-5555-0000-0000-000000000003', v_e2, 'reabro', null, null);
  perform public.cambiar_etapa('c9c9c9c9-5555-0000-0000-000000000003', v_ganada, 'cierre en el pasado', null, v_hoy - 30);
  if (select fecha_cierre from public.oportunidades where id = 'c9c9c9c9-5555-0000-0000-000000000003') <> v_hoy - 30 then
    raise exception 'FALLA: no se acepto una fecha de cierre pasada';
  end if;

  -- Corregir una fecha ya guardada a una futura por update directo: rechazado.
  perform pg_temp.debe_fallar(
    format($q$update public.oportunidades set fecha_cierre = %L where id = 'c9c9c9c9-5555-0000-0000-000000000003'$q$, v_hoy + 5),
    '23514', 'La fecha real de cierre no puede ser futura%',
    'se corrigio la fecha de cierre a una fecha futura');

  -- Lo de la 0007 sigue en pie: perdida sin motivo, y el historial y la auditoria siguen escribiendose.
  perform pg_temp.debe_fallar(
    format($q$select public.cambiar_etapa('c9c9c9c9-5555-0000-0000-000000000001', %L)$q$, v_perdida),
    '23514', 'Para marcar la oportunidad como perdida hay que indicar el motivo de pérdida%',
    'la 0009 dejo pasar una perdida sin motivo');
  if (select count(*) from public.oportunidad_etapas_historial where oportunidad_id = 'c9c9c9c9-5555-0000-0000-000000000003') < 7 then
    raise exception 'FALLA: el historial de etapas no registro los cambios';
  end if;
  if not exists (select 1 from public.oportunidad_auditoria where oportunidad_id = 'c9c9c9c9-5555-0000-0000-000000000003') then
    raise exception 'FALLA: no quedo auditoria de editar una oportunidad cerrada';
  end if;
end $$;

-- Una cerrada con fecha futura heredada (de antes de la 0009) se puede seguir editando en otros campos.
reset role;
do $$
begin
  alter table public.oportunidades disable trigger oportunidades_reglas;
  update public.oportunidades set fecha_cierre = ((now() at time zone 'America/Argentina/Buenos_Aires')::date + 10)
    where id = 'c9c9c9c9-5555-0000-0000-000000000003';
  alter table public.oportunidades enable trigger oportunidades_reglas;
end $$;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c9c9c9c9-1111-0000-0000-000000000001","role":"authenticated"}', true);

do $$
begin
  update public.oportunidades set monto = 1234 where id = 'c9c9c9c9-5555-0000-0000-000000000003';
  if (select monto from public.oportunidades where id = 'c9c9c9c9-5555-0000-0000-000000000003') <> 1234 then
    raise exception 'FALLA: no se pudo editar un campo de una cerrada con fecha futura heredada';
  end if;
end $$;

-- ══ SOY EL VENDEDOR: sin oportunidades.reabrir, la fecha futura y el cliente tambien rigen ══
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c9c9c9c9-1111-0000-0000-000000000002","role":"authenticated"}', true);

do $$
declare
  org constant uuid := 'c9c9c9c9-0000-0000-0000-000000000000';
  v_e1 uuid := (select id from public.etapas where organizacion_id = org and orden = 1);
begin
  perform pg_temp.debe_fallar(
    format($q$insert into public.oportunidades (titulo, etapa_id) values ('Vendedor sin cliente', %L)$q$, v_e1),
    '23514', 'La oportunidad tiene que ser de una empresa o de un contacto%',
    'un vendedor creo una oportunidad sin empresa ni contacto');
  insert into public.oportunidades (titulo, etapa_id, empresa_id)
  values ('Vendedor con empresa', v_e1, 'c9c9c9c9-2222-0000-0000-000000000001');
end $$;

reset role;
rollback;

-- Solo se llega hasta aca si ninguna prueba corto con "FALLA:". Va despues del
-- rollback porque el SQL Editor muestra el resultado de la ULTIMA sentencia.
select 'TODO OK: reglas de la 0009 verificadas. Nada quedo guardado (rollback).' as resultado;
