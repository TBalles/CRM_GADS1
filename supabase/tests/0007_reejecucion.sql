-- Tuco & Nito - PRUEBA DE RE-EJECUCION DE LA 0007
--
-- Prueba lo que 0007_reglas.sql no puede (porque necesita correr la migracion
-- DOS veces dentro de la prueba):
--   - la migracion de roles corre UNA sola vez: si despues un admin le saca
--     clientes.ver_todos a un rol, volver a correr la 0007 no se lo devuelve;
--   - una organizacion que YA tenia un rol propio llamado "Vendedor": su
--     "Ventas" no se renombra (no se puede repetir el nombre) pero se trata
--     igual como vendedor (sin ver_todos), y la migracion no falla;
--   - "Corporativo" conserva lo que el admin le habia agregado (union, no
--     reemplazo);
--   - correrla dos veces no duplica catalogos, etapas ni historial.
--
-- COMO CORRERLO: SOLO sobre una base SIN la 0007 aplicada. Reemplazar cada
-- linea "-- @@ MIGRACION 0007 @@" por el contenido COMPLETO de
-- supabase/migrations/0007_entrega_final.sql (son dos) y ejecutar todo junto.
-- NO DEJA NADA EN LA BASE: termina en ROLLBACK.
--
-- Resultado esperado: "TODO OK". Si algo falla, un ERROR que empieza con "FALLA:".

begin;

-- ── PARTE 0 (antes de la 0007): una organizacion con roles personalizados ────
-- El trigger de la 0005 le crea Administrador, Ventas, Corporativo y Solo lectura.
insert into public.organizaciones (id, nombre) values ('c7c7c7c7-0000-0000-0000-000000000000', 'TEST re-ejecucion');
insert into public.roles (organizacion_id, nombre, permisos) values
  ('c7c7c7c7-0000-0000-0000-000000000000', 'Vendedor',  array['clientes.ver', 'clientes.editar']),
  ('c7c7c7c7-0000-0000-0000-000000000000', 'Logística', array['clientes.ver', 'ventas.ver']);
update public.roles set permisos = permisos || array['productos.editar']
where organizacion_id = 'c7c7c7c7-0000-0000-0000-000000000000' and nombre = 'Corporativo';

-- @@ MIGRACION 0007 @@

-- ── PARTE 1 (despues de la primera corrida) ──────────────────────────────────
do $$
declare
  c constant uuid := 'c7c7c7c7-0000-0000-0000-000000000000';
begin
  if not exists (select 1 from public.roles where organizacion_id = c and nombre = 'Ventas'
                 and not 'clientes.ver_todos' = any (permisos)) then
    raise exception 'FALLA: con un "Vendedor" propio, el "Ventas" viejo se renombro o recibio clientes.ver_todos';
  end if;
  if exists (select 1 from public.roles where organizacion_id = c and nombre = 'Vendedor'
             and 'clientes.ver_todos' = any (permisos)) then
    raise exception 'FALLA: el "Vendedor" propio de la organizacion recibio clientes.ver_todos';
  end if;
  if not exists (select 1 from public.roles where organizacion_id = c and nombre = 'Responsable comercial'
                 and permisos @> array['productos.editar', 'clientes.ver_todos', 'clientes.asignar',
                                       'oportunidades.asignar', 'oportunidades.reabrir']) then
    raise exception 'FALLA: Corporativo no paso a Responsable comercial conservando lo que el admin le habia agregado';
  end if;
  if not exists (select 1 from public.roles where organizacion_id = c and nombre = 'Logística'
                 and 'clientes.ver_todos' = any (permisos))
     or not exists (select 1 from public.roles where organizacion_id = c and nombre = 'Solo lectura'
                    and 'clientes.ver_todos' = any (permisos)) then
    raise exception 'FALLA: los roles que veian clientes no recibieron clientes.ver_todos';
  end if;
  if (select array_length(permisos, 1) from public.roles where organizacion_id = c and es_admin) <> 19 then
    raise exception 'FALLA: el Administrador no tiene los 19 permisos';
  end if;
end $$;

-- Un admin decide restringir roles despues de la migracion.
update public.roles set permisos = array_remove(permisos, 'clientes.ver_todos')
where organizacion_id = 'c7c7c7c7-0000-0000-0000-000000000000' and nombre in ('Logística', 'Solo lectura');
insert into public.roles (organizacion_id, nombre, permisos)
values ('c7c7c7c7-0000-0000-0000-000000000000', 'Restringido', array['clientes.ver']);

create temp table conteo_antes as
select (select count(*) from public.tipos_actividad) as tipos,
       (select count(*) from public.origenes) as origenes,
       (select count(*) from public.motivos_perdida) as motivos,
       (select count(*) from public.etapas) as etapas,
       (select count(*) from public.oportunidad_etapas_historial) as historial,
       (select count(*) from public.roles) as roles;

-- @@ MIGRACION 0007 @@

-- ── PARTE 2 (despues de la segunda corrida) ──────────────────────────────────
do $$
declare
  c constant uuid := 'c7c7c7c7-0000-0000-0000-000000000000';
begin
  if exists (select 1 from public.roles where organizacion_id = c
             and nombre in ('Logística', 'Solo lectura', 'Restringido', 'Ventas', 'Vendedor')
             and 'clientes.ver_todos' = any (permisos)) then
    raise exception 'FALLA: correr la 0007 de nuevo le devolvio clientes.ver_todos a un rol restringido';
  end if;
  if (select (tipos, origenes, motivos, etapas, historial, roles) from conteo_antes)
     is distinct from
     (select ((select count(*) from public.tipos_actividad), (select count(*) from public.origenes),
              (select count(*) from public.motivos_perdida), (select count(*) from public.etapas),
              (select count(*) from public.oportunidad_etapas_historial), (select count(*) from public.roles))) then
    raise exception 'FALLA: correr la 0007 de nuevo duplico catalogos, etapas, historial o roles';
  end if;
end $$;

rollback;

select 'TODO OK: la 0007 se puede re-ejecutar sin devolver permisos ni duplicar datos (rollback).' as resultado;
