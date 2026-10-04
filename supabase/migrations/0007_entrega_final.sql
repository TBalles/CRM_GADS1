-- Tuco & Nito - 0007: ENTREGA FINAL
--
-- Lo que piden los "Modulos Principales" y la consigna y todavia no estaba en
-- la base:
--   - catalogos configurables por organizacion (origenes, motivos de perdida,
--     tipos de actividad) y etapas con TIPO (abierta / ganada / perdida);
--   - empresas y contactos con estado, responsable y origen (baja logica);
--   - oportunidades con estado, fechas de cierre, origen, motivo de perdida,
--     probabilidad y tipo (directa / licitacion);
--   - reglas del embudo EN LA BASE (trigger), historial de etapas, auditoria
--     de oportunidades cerradas y la RPC cambiar_etapa();
--   - actividades (bitacora) con tipo de catalogo, oportunidad y resultado;
--   - roles Administrador / Vendedor / Responsable comercial / Solo lectura y
--     cartera propia: un vendedor ve solo lo que tiene asignado;
--   - datos fiscales del proveedor y su logo (bucket privado `logos`).
--
-- ORDEN PARA APLICARLA EN PRODUCCION (importante)
--   1. Aplicar esta migracion.
--   2. Desplegar la app INMEDIATAMENTE despues (push a main).
--   3. Entre 1 y 2, NO editar roles desde /usuarios: la app vieja no conoce los
--      permisos nuevos y, al guardar un rol, los descarta (un Responsable
--      comercial perderia clientes.ver_todos sin aviso).
--
-- NO ES SOLO ADITIVA: ademas de agregar tablas y columnas, MIGRA DATOS Y
-- PERMISOS existentes. Renombra roles (Ventas -> Vendedor, Corporativo ->
-- Responsable comercial), agrega permisos a los roles que ya existen, renombra
-- las etapas por defecto, cierra (estado ganada/perdida) las oportunidades que
-- estaban en esas etapas, asigna responsables a la cartera existente y le pone
-- tipo de catalogo a la bitacora vieja. Esas migraciones de datos corren UNA
-- sola vez (cada una tiene su marca); el resto es idempotente. Se puede volver
-- a correr sin efectos, pero no deshace nada.
--
-- COMO CORRERLO: pegar TODO en el SQL Editor y ejecutar (o via
-- `supabase db push` / apply_migration). El SQL Editor manda el archivo como
-- UNA sola consulta, y Postgres la corre en UNA transaccion implicita: si algo
-- falla no se aplica nada. NO lleva BEGIN/COMMIT propios a proposito: asi se
-- puede ensayar con `begin; <este archivo>; <supabase/tests/0007_reglas.sql>`
-- (el test termina en ROLLBACK) sin que un COMMIT del medio deje la migracion
-- aplicada.
--
-- Despues: correr supabase/tests/0005_permisos.sql y 0007_reglas.sql, y
-- volver a correr supabase/seeds/demo_catedra.sql.
--
-- Requiere 0001 a 0006 aplicadas.
--
-- COMPATIBILIDAD con la app ya desplegada (la que todavia no conoce estas
-- columnas): sus altas directas de empresas, contactos, oportunidades y
-- bitacora siguen andando (todo lo nuevo tiene default o lo completa un
-- trigger), igual que mover una tarjeta de etapa con un update de etapa_id.
-- Lo que cambia A PROPOSITO: soltar una oportunidad en la etapa "Perdida" sin
-- motivo de perdida da error; sacar una oportunidad cerrada a una etapa abierta
-- pide oportunidades.reabrir; asignarle un cliente u oportunidad a otro pide
-- el permiso de asignar; y las oportunidades ya no se borran (baja logica).
--
-- SINCRONIA: el catalogo de permisos (CHECK de roles.permisos) y los roles por
-- defecto (crear_roles_iniciales) tienen que coincidir con src/lib/permisos.ts.
-- El test src/lib/permisos.check.ts lee ESTE archivo y falla si divergen.

-- ============================================================
-- 1. PERMISOS Y ROLES
--
-- Permisos nuevos:
--   clientes.ver_todos      ve la cartera de todos (sin el, solo la propia)
--   clientes.asignar        asigna / reasigna el responsable de empresas y contactos
--   oportunidades.asignar   asigna / reasigna el responsable de oportunidades
--   oportunidades.reabrir   vuelve a abrir (o cambia el resultado de) una cerrada
--   configuracion.gestionar etapas, catalogos y datos de la empresa
--
-- Roles por defecto: "Ventas" pasa a llamarse Vendedor y "Corporativo" pasa a
-- Responsable comercial (los nombres que usa la consigna). Se renombran EN
-- LUGAR (mismo id), asi los usuarios que ya los tienen no pierden el rol.
--
-- UNA SOLA VEZ: la marca es el CHECK de roles.permisos. Si ya conoce
-- clientes.ver_todos, esta migracion ya corrio y los roles no se tocan (un
-- admin pudo haberle sacado ver_todos a un rol a proposito: no se le devuelve).
-- ============================================================
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.roles'::regclass and conname = 'roles_permisos_validos'
      and pg_get_constraintdef(oid) like '%clientes.ver_todos%'
  ) then
    return;
  end if;

  alter table public.roles drop constraint if exists roles_permisos_validos;

  -- Administrador: todo, incluido lo nuevo (es el rol que nadie puede editar).
  update public.roles
  set permisos = array['tablero.ver', 'clientes.ver', 'clientes.ver_todos', 'clientes.editar', 'clientes.asignar',
                       'bitacora.ver', 'bitacora.escribir', 'oportunidades.ver', 'oportunidades.editar',
                       'oportunidades.asignar', 'oportunidades.reabrir', 'productos.ver', 'productos.editar',
                       'ventas.ver', 'ventas.editar', 'alertas.ver', 'alertas.enviar',
                       'configuracion.gestionar', 'usuarios.gestionar'],
      descripcion = 'Acceso total, incluida la gestión de usuarios, roles y configuración.'
  where es_admin;

  -- Los roles que ya veian clientes siguen viendo TODO: sin esto, la cartera
  -- propia dejaria de golpe sin ver nada a Solo lectura y a los roles propios
  -- de cada cliente. Los unicos que pasan a cartera propia son los vendedores:
  -- "Ventas" y, si la organizacion ya tenia uno propio, "Vendedor".
  update public.roles
  set permisos = permisos || array['clientes.ver_todos']
  where not es_admin
    and nombre not in ('Ventas', 'Vendedor')
    and 'clientes.ver' = any (permisos)
    and not 'clientes.ver_todos' = any (permisos);

  -- Corporativo -> Responsable comercial: sus permisos de antes (lo que el
  -- admin le haya agregado se conserva) MAS los de supervisar al equipo.
  update public.roles r
  set permisos = array(
        select distinct p from unnest(r.permisos || array[
          'tablero.ver', 'clientes.ver', 'clientes.ver_todos', 'clientes.editar', 'clientes.asignar',
          'bitacora.ver', 'bitacora.escribir', 'oportunidades.ver', 'oportunidades.editar',
          'oportunidades.asignar', 'oportunidades.reabrir', 'productos.ver', 'ventas.ver', 'alertas.ver'
        ]) as p order by p)
  where r.nombre = 'Corporativo' and not r.es_admin;

  -- Renombres. Si la organizacion ya tenia un rol con el nombre nuevo, el
  -- viejo conserva su nombre (no se puede repetir) pero ya recibio el mismo
  -- trato de arriba: "Ventas" queda como vendedor (sin ver_todos) y
  -- "Corporativo" con los permisos de supervision.
  update public.roles r
  set nombre = 'Vendedor',
      descripcion = 'Trabaja sus clientes y oportunidades asignados, ventas y alertas. No reasigna ni reabre.'
  where r.nombre = 'Ventas' and not r.es_admin
    and not exists (select 1 from public.roles x where x.organizacion_id = r.organizacion_id and x.nombre = 'Vendedor');

  update public.roles r
  set nombre = 'Responsable comercial',
      descripcion = 'Supervisa al equipo: ve toda la cartera, asigna, reasigna y reabre oportunidades.'
  where r.nombre = 'Corporativo' and not r.es_admin
    and not exists (select 1 from public.roles x where x.organizacion_id = r.organizacion_id and x.nombre = 'Responsable comercial');
end $$;

-- Solo claves del catalogo (src/lib/permisos.ts). Va despues del bloque de
-- arriba: en la primera corrida, recrearlo con ver_todos es la marca de "roles
-- ya migrados".
alter table public.roles drop constraint if exists roles_permisos_validos;
alter table public.roles add constraint roles_permisos_validos check (permisos <@ array[
    'tablero.ver',
    'clientes.ver', 'clientes.ver_todos', 'clientes.editar', 'clientes.asignar',
    'bitacora.ver', 'bitacora.escribir',
    'oportunidades.ver', 'oportunidades.editar', 'oportunidades.asignar', 'oportunidades.reabrir',
    'productos.ver', 'productos.editar',
    'ventas.ver', 'ventas.editar',
    'alertas.ver', 'alertas.enviar',
    'configuracion.gestionar',
    'usuarios.gestionar'
  ]::text[]);

-- Roles con los que arranca cada organizacion (igual que ROLES_POR_DEFECTO en
-- src/lib/permisos.ts, con las dependencias ya expandidas).
create or replace function public.crear_roles_iniciales(p_org uuid)
returns void
language sql
security definer set search_path = public
as $$
  insert into public.roles (organizacion_id, nombre, descripcion, es_admin, permisos) values
    (p_org, 'Administrador', 'Acceso total, incluida la gestión de usuarios, roles y configuración.', true,
      array['tablero.ver', 'clientes.ver', 'clientes.ver_todos', 'clientes.editar', 'clientes.asignar',
            'bitacora.ver', 'bitacora.escribir', 'oportunidades.ver', 'oportunidades.editar',
            'oportunidades.asignar', 'oportunidades.reabrir', 'productos.ver', 'productos.editar',
            'ventas.ver', 'ventas.editar', 'alertas.ver', 'alertas.enviar',
            'configuracion.gestionar', 'usuarios.gestionar']),
    (p_org, 'Vendedor', 'Trabaja sus clientes y oportunidades asignados, ventas y alertas. No reasigna ni reabre.', false,
      array['tablero.ver', 'clientes.ver', 'clientes.editar', 'bitacora.ver', 'bitacora.escribir',
            'oportunidades.ver', 'oportunidades.editar', 'productos.ver',
            'ventas.ver', 'ventas.editar', 'alertas.ver', 'alertas.enviar']),
    (p_org, 'Responsable comercial', 'Supervisa al equipo: ve toda la cartera, asigna, reasigna y reabre oportunidades.', false,
      array['tablero.ver', 'clientes.ver', 'clientes.ver_todos', 'clientes.editar', 'clientes.asignar',
            'bitacora.ver', 'bitacora.escribir', 'oportunidades.ver', 'oportunidades.editar',
            'oportunidades.asignar', 'oportunidades.reabrir', 'productos.ver', 'ventas.ver', 'alertas.ver']),
    (p_org, 'Solo lectura', 'Consulta clientes y catálogo.', false,
      array['clientes.ver', 'clientes.ver_todos', 'productos.ver'])
  on conflict (organizacion_id, nombre) do nothing;
$$;

-- Solo la usan el trigger de alta de organizacion y los scripts (como
-- postgres). Expuesta, cualquier usuario podria sembrar roles en otra
-- organizacion via /rpc.
revoke execute on function public.crear_roles_iniciales(uuid) from public, anon, authenticated;

-- ============================================================
-- 2. CATALOGOS CONFIGURABLES (por organizacion)
--
-- Se dan de baja con `activo = false`, no se borran: las oportunidades y
-- actividades viejas los siguen referenciando (FK sin cascade).
-- tipos_actividad.codigo es una clave estable para los tipos de sistema: la
-- usa la compatibilidad con la columna vieja bitacora_entradas.tipo, y no
-- cambia aunque el admin renombre el tipo.
-- ============================================================
create table if not exists public.origenes (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null default public.org_actual() references public.organizaciones (id) on delete cascade,
  nombre text not null check (btrim(nombre) <> ''),
  activo boolean not null default true,
  orden int not null default 0,
  created_at timestamptz not null default now(),
  constraint origenes_org_nombre_key unique (organizacion_id, nombre),
  constraint origenes_org_id_key unique (organizacion_id, id)
);

create table if not exists public.motivos_perdida (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null default public.org_actual() references public.organizaciones (id) on delete cascade,
  nombre text not null check (btrim(nombre) <> ''),
  activo boolean not null default true,
  orden int not null default 0,
  created_at timestamptz not null default now(),
  constraint motivos_perdida_org_nombre_key unique (organizacion_id, nombre),
  constraint motivos_perdida_org_id_key unique (organizacion_id, id)
);

create table if not exists public.tipos_actividad (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null default public.org_actual() references public.organizaciones (id) on delete cascade,
  nombre text not null check (btrim(nombre) <> ''),
  codigo text,
  activo boolean not null default true,
  orden int not null default 0,
  created_at timestamptz not null default now(),
  constraint tipos_actividad_org_nombre_key unique (organizacion_id, nombre),
  constraint tipos_actividad_org_codigo_key unique (organizacion_id, codigo),
  constraint tipos_actividad_org_id_key unique (organizacion_id, id)
);

comment on column public.tipos_actividad.codigo is
  'Clave estable de los tipos de sistema (null en los que crea el cliente). Mapea los valores viejos de bitacora_entradas.tipo.';

-- Valores del rubro con los que arranca cada organizacion. ON CONFLICT DO
-- NOTHING: re-ejecutable, y no pisa lo que el cliente ya renombro.
create or replace function public.crear_catalogos_iniciales(p_org uuid)
returns void
language sql
security definer set search_path = public
as $$
  -- Los 9 que pide la consigna + 3 del rubro (visita, entrega, reclamo).
  insert into public.tipos_actividad (organizacion_id, nombre, codigo, orden) values
    (p_org, 'Llamada',                 'llamada',         1),
    (p_org, 'Correo electrónico',      'email',           2),
    (p_org, 'Mensaje',                 'whatsapp',        3),
    (p_org, 'Reunión presencial',      'reunion',         4),
    (p_org, 'Reunión virtual',         'reunion_virtual', 5),
    (p_org, 'Demostración',            'demostracion',    6),
    (p_org, 'Envío de propuesta',      'propuesta',       7),
    (p_org, 'Visita a cancha',         'visita_cancha',   8),
    (p_org, 'Entrega de equipamiento', 'entrega',         9),
    (p_org, 'Reclamo',                 'queja',          10),
    (p_org, 'Nota interna',            'nota',           11),
    (p_org, 'Otro',                    'otro',           12)
  on conflict do nothing;

  insert into public.origenes (organizacion_id, nombre, orden) values
    (p_org, 'Recambio por vida útil',  1),
    (p_org, 'Referido de otro club',   2),
    (p_org, 'Licitación municipal',    3),
    (p_org, 'Redes sociales',          4),
    (p_org, 'Web',                     5),
    (p_org, 'Visita a predio',         6),
    (p_org, 'Torneo / feria',          7)
  on conflict do nothing;

  insert into public.motivos_perdida (organizacion_id, nombre, orden) values
    (p_org, 'Precio',                             1),
    (p_org, 'Eligió otro proveedor',              2),
    (p_org, 'Sin presupuesto del club',           3),
    (p_org, 'Licitación adjudicada a otro',       4),
    (p_org, 'Plazo de entrega',                   5),
    (p_org, 'Pospone a la próxima temporada',     6),
    (p_org, 'Dato histórico sin motivo',          7)
  on conflict do nothing;
$$;

revoke execute on function public.crear_catalogos_iniciales(uuid) from public, anon, authenticated;

select public.crear_catalogos_iniciales(id) from public.organizaciones;

-- ============================================================
-- 3. ETAPAS CON TIPO
--
-- El tipo de la etapa define el estado de la oportunidad que esta en ella.
-- Las etapas por defecto pasan al vocabulario del rubro, RENOMBRADAS EN LUGAR
-- (mismo id, mismo orden): las oportunidades no se mueven. Solo se tocan las
-- que conservan el nombre por defecto; las que un cliente renombro, no.
-- ============================================================
alter table public.etapas
  add column if not exists tipo text not null default 'abierta';

alter table public.etapas drop constraint if exists etapas_tipo_check;
alter table public.etapas add constraint etapas_tipo_check check (tipo in ('abierta', 'ganada', 'perdida'));

update public.etapas set tipo = 'ganada'  where tipo = 'abierta' and nombre in ('Ganada', 'Entregado');
update public.etapas set tipo = 'perdida' where tipo = 'abierta' and nombre = 'Perdida';

update public.etapas e
set nombre = m.nuevo
from (values
  ('Nuevo',             'Consulta recibida'),
  ('Calificación',      'Relevamiento de cancha'),
  ('Propuesta Enviada', 'Presupuesto enviado'),
  ('Ganada',            'Entregado')
) as m(viejo, nuevo)
where e.nombre = m.viejo;

-- Cambiarle el tipo a una etapa con oportunidades adentro las dejaria con un
-- estado que no corresponde. Primero hay que moverlas.
-- SECURITY DEFINER: tiene que ver TODAS las oportunidades, no solo las que la
-- RLS le muestra a quien configura.
create or replace function public.etapas_validar_tipo()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.tipo is distinct from old.tipo
     and exists (select 1 from public.oportunidades o where o.etapa_id = old.id) then
    raise exception 'La etapa "%" tiene oportunidades: movelas antes de cambiarle el tipo.', old.nombre
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists etapas_validar_tipo on public.etapas;
create trigger etapas_validar_tipo
  before update on public.etapas
  for each row execute procedure public.etapas_validar_tipo();

-- ============================================================
-- 4. ALTA DE ORGANIZACION
--
-- Reemplaza a la de la 0005: roles, embudo del rubro y catalogos.
-- ============================================================
create or replace function public.organizacion_inicial()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.crear_roles_iniciales(new.id);
  insert into public.etapas (organizacion_id, nombre, orden, color, tipo) values
    (new.id, 'Consulta recibida',      1, '#94a3b8', 'abierta'),
    (new.id, 'Relevamiento de cancha', 2, '#60a5fa', 'abierta'),
    (new.id, 'Presupuesto enviado',    3, '#fbbf24', 'abierta'),
    (new.id, 'Negociación',            4, '#fb923c', 'abierta'),
    (new.id, 'Entregado',              5, '#4ade80', 'ganada'),
    (new.id, 'Perdida',                6, '#f87171', 'perdida');
  perform public.crear_catalogos_iniciales(new.id);
  return new;
end;
$$;

-- ============================================================
-- 5. EMPRESAS Y CONTACTOS
--
-- estado: Potencial, Cliente, Inactivo, No contactar. La BAJA LOGICA es
-- estado = inactivo: una empresa con historia no se borra, se desactiva.
-- responsable_id: la cartera. FK simple a perfiles (igual que en
-- oportunidades); que el responsable sea de la MISMA organizacion lo valida el
-- trigger de la seccion 8 cada vez que se asigna.
-- ============================================================
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'empresas' and column_name = 'estado') then
    alter table public.empresas add column estado text not null default 'potencial';
    -- Una empresa con ventas ya es cliente.
    update public.empresas e set estado = 'cliente'
    where exists (select 1 from public.ventas v where v.empresa_id = e.id);
  end if;

  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'contactos' and column_name = 'estado') then
    alter table public.contactos add column estado text not null default 'potencial';
    update public.contactos c set estado = 'cliente'
    from public.empresas e
    where e.id = c.empresa_id and e.estado = 'cliente';
  end if;
end $$;

alter table public.empresas
  add column if not exists responsable_id uuid references public.perfiles (id) on delete set null,
  add column if not exists origen_id uuid,
  add column if not exists tipo_cliente text,
  add column if not exists sitio_web text;

alter table public.contactos
  add column if not exists responsable_id uuid references public.perfiles (id) on delete set null,
  add column if not exists origen_id uuid,
  add column if not exists documento text;

alter table public.empresas drop constraint if exists empresas_estado_check;
alter table public.empresas add constraint empresas_estado_check
  check (estado in ('potencial', 'cliente', 'inactivo', 'no_contactar'));
alter table public.contactos drop constraint if exists contactos_estado_check;
alter table public.contactos add constraint contactos_estado_check
  check (estado in ('potencial', 'cliente', 'inactivo', 'no_contactar'));

-- "Industria o actividad" del modulo 1, en el vocabulario del rubro.
alter table public.empresas drop constraint if exists empresas_tipo_cliente_check;
alter table public.empresas add constraint empresas_tipo_cliente_check
  check (tipo_cliente is null or tipo_cliente in
         ('club', 'complejo_f5', 'escuela_futbol', 'predio_municipal', 'colegio', 'otro'));

alter table public.empresas drop constraint if exists empresas_origen_id_fkey;
alter table public.empresas add constraint empresas_origen_id_fkey
  foreign key (organizacion_id, origen_id) references public.origenes (organizacion_id, id);
alter table public.contactos drop constraint if exists contactos_origen_id_fkey;
alter table public.contactos add constraint contactos_origen_id_fkey
  foreign key (organizacion_id, origen_id) references public.origenes (organizacion_id, id);

create index if not exists empresas_responsable_id_idx on public.empresas (responsable_id);
create index if not exists empresas_origen_id_idx on public.empresas (origen_id);
create index if not exists contactos_responsable_id_idx on public.contactos (responsable_id);
create index if not exists contactos_origen_id_idx on public.contactos (origen_id);

-- ============================================================
-- 6. OPORTUNIDADES
-- ============================================================
alter table public.oportunidades
  add column if not exists estado text not null default 'abierta',
  add column if not exists fecha_estimada_cierre date,
  add column if not exists fecha_cierre date,
  add column if not exists origen_id uuid,
  add column if not exists motivo_perdida_id uuid,
  add column if not exists probabilidad int,
  add column if not exists tipo text not null default 'directa';

alter table public.oportunidades drop constraint if exists oportunidades_estado_check;
alter table public.oportunidades add constraint oportunidades_estado_check
  check (estado in ('abierta', 'ganada', 'perdida'));
alter table public.oportunidades drop constraint if exists oportunidades_tipo_check;
alter table public.oportunidades add constraint oportunidades_tipo_check
  check (tipo in ('directa', 'licitacion'));
alter table public.oportunidades drop constraint if exists oportunidades_probabilidad_check;
alter table public.oportunidades add constraint oportunidades_probabilidad_check
  check (probabilidad is null or probabilidad between 0 and 100);

alter table public.oportunidades drop constraint if exists oportunidades_origen_id_fkey;
alter table public.oportunidades add constraint oportunidades_origen_id_fkey
  foreign key (organizacion_id, origen_id) references public.origenes (organizacion_id, id);
alter table public.oportunidades drop constraint if exists oportunidades_motivo_perdida_id_fkey;
alter table public.oportunidades add constraint oportunidades_motivo_perdida_id_fkey
  foreign key (organizacion_id, motivo_perdida_id) references public.motivos_perdida (organizacion_id, id);

create index if not exists oportunidades_responsable_id_idx on public.oportunidades (responsable_id);
create index if not exists oportunidades_origen_id_idx on public.oportunidades (origen_id);
create index if not exists oportunidades_motivo_perdida_id_idx on public.oportunidades (motivo_perdida_id);
create index if not exists oportunidades_estado_idx on public.oportunidades (organizacion_id, estado);

-- Backfill: lo que ya estaba en Entregado/Perdida queda cerrado, con la fecha
-- de su ultima modificacion como fecha real de cierre; las perdidas viejas, con
-- el motivo "Dato histórico sin motivo".
-- Se apaga el trigger de updated_at mientras tanto: si no, todas quedarian
-- "modificadas hoy" y se perderia el dato.
alter table public.oportunidades disable trigger set_oportunidades_updated_at;

update public.oportunidades o
set estado = e.tipo,
    fecha_cierre = coalesce(o.fecha_cierre, o.updated_at::date),
    motivo_perdida_id = case when e.tipo = 'perdida' then coalesce(o.motivo_perdida_id, (
      select m.id from public.motivos_perdida m
      where m.organizacion_id = o.organizacion_id and m.nombre = 'Dato histórico sin motivo'
    )) end
from public.etapas e
where e.id = o.etapa_id and e.tipo <> 'abierta' and o.estado = 'abierta';

alter table public.oportunidades enable trigger set_oportunidades_updated_at;

-- La regla de la consigna, como garantia de ultima linea (los triggers de la
-- seccion 9 la cumplen solos; esto atrapa cualquier camino que no pase por ellos).
alter table public.oportunidades drop constraint if exists oportunidades_estado_coherente;
alter table public.oportunidades add constraint oportunidades_estado_coherente check (
     (estado = 'abierta' and fecha_cierre is null     and motivo_perdida_id is null)
  or (estado = 'ganada'  and fecha_cierre is not null and motivo_perdida_id is null)
  or (estado = 'perdida' and fecha_cierre is not null and motivo_perdida_id is not null)
);

-- ============================================================
-- 7. RESPONSABLES DE LA CARTERA EXISTENTE
--
-- Empresa: el responsable de su oportunidad mas reciente (si ese usuario es de
-- la misma organizacion; el superadmin de la 0006, por ejemplo, ya no lo es).
-- Contacto: el de su oportunidad mas reciente, o si no el de su empresa. Lo que
-- quede sin responsable lo asigna un administrador (y hasta entonces lo ven
-- solo los que tienen clientes.ver_todos). Solo la primera vez.
-- ============================================================
do $$
begin
  if exists (select 1 from public.empresas where responsable_id is not null)
     or exists (select 1 from public.contactos where responsable_id is not null) then
    return;
  end if;

  update public.empresas e
  set responsable_id = (
    select o.responsable_id
    from public.oportunidades o
    join public.perfiles p on p.id = o.responsable_id and p.organizacion_id = o.organizacion_id
    where o.empresa_id = e.id
    order by o.created_at desc
    limit 1
  );

  update public.contactos c
  set responsable_id = coalesce(
    (select o.responsable_id
     from public.oportunidades o
     join public.perfiles p on p.id = o.responsable_id and p.organizacion_id = o.organizacion_id
     where o.contacto_id = c.id
     order by o.created_at desc
     limit 1),
    (select e.responsable_id from public.empresas e where e.id = c.empresa_id)
  );
end $$;

-- ============================================================
-- 8. ASIGNACION DE RESPONSABLE (empresas, contactos, oportunidades)
--
-- - Alta sin responsable: queda asignada a quien la crea (la app vieja manda
--   responsable_id = null explicito, por eso no alcanza con un DEFAULT).
-- - Asignar a otro al crear, o cambiar el responsable despues, pide el permiso
--   de asignar (clientes.asignar / oportunidades.asignar, por argumento).
-- - El responsable tiene que ser de la misma organizacion.
-- - Sin usuario (auth.uid() null: service_role, SQL Editor, scripts) no se
--   exige permiso: esos caminos ya son de confianza.
-- ============================================================
create or replace function public.validar_responsable()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    new.responsable_id := coalesce(new.responsable_id, v_uid);
  elsif new.responsable_id is not distinct from old.responsable_id then
    return new;
  end if;

  -- Fila de otra organizacion: la rechaza la RLS (con su error de siempre).
  if v_uid is not null and new.organizacion_id is distinct from public.org_actual() then
    return new;
  end if;

  if v_uid is not null and not public.tiene_permiso(tg_argv[0])
     and (tg_op = 'UPDATE' or new.responsable_id is distinct from v_uid) then
    raise exception 'No tenés permiso para asignar o reasignar el responsable.'
      using errcode = '42501';
  end if;

  if new.responsable_id is not null and not exists (
    select 1 from public.perfiles p
    where p.id = new.responsable_id and p.organizacion_id = new.organizacion_id
  ) then
    raise exception 'El responsable tiene que ser un usuario de la misma organización.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists empresas_validar_responsable on public.empresas;
create trigger empresas_validar_responsable
  before insert or update on public.empresas
  for each row execute procedure public.validar_responsable('clientes.asignar');

drop trigger if exists contactos_validar_responsable on public.contactos;
create trigger contactos_validar_responsable
  before insert or update on public.contactos
  for each row execute procedure public.validar_responsable('clientes.asignar');

drop trigger if exists oportunidades_validar_responsable on public.oportunidades;
create trigger oportunidades_validar_responsable
  before insert or update on public.oportunidades
  for each row execute procedure public.validar_responsable('oportunidades.asignar');

-- ============================================================
-- 9. REGLAS DEL EMBUDO, HISTORIAL Y AUDITORIA
--
-- Van en la base para que las cumplan TODOS los caminos: el tablero, el
-- formulario, la RPC y cualquier update directo.
-- ============================================================

-- Historial de etapas: de donde a donde, cuando, quien y por que. Lo escribe
-- SOLO el trigger (sin politicas de escritura).
--
-- La FK a la oportunidad es NO ACTION (no cascade): una oportunidad con
-- historial no se puede borrar fisicamente (la consigna pide baja logica). NO
-- ACTION y no RESTRICT a proposito: NO ACTION se verifica al final de la
-- sentencia, asi que borrar una organizacion entera (superadmin) sigue
-- andando, porque su cascade borra en la misma sentencia oportunidades e
-- historial. Lo mismo vale para la auditoria.
create table if not exists public.oportunidad_etapas_historial (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null default public.org_actual() references public.organizaciones (id) on delete cascade,
  oportunidad_id uuid not null,
  etapa_anterior_id uuid,
  etapa_nueva_id uuid not null,
  usuario_id uuid references public.perfiles (id) on delete set null,
  observacion text,
  cambiado_en timestamptz not null default now(),
  constraint oportunidad_etapas_historial_oportunidad_id_fkey
    foreign key (organizacion_id, oportunidad_id) references public.oportunidades (organizacion_id, id),
  constraint oportunidad_etapas_historial_etapa_anterior_id_fkey
    foreign key (organizacion_id, etapa_anterior_id) references public.etapas (organizacion_id, id),
  constraint oportunidad_etapas_historial_etapa_nueva_id_fkey
    foreign key (organizacion_id, etapa_nueva_id) references public.etapas (organizacion_id, id)
);

create index if not exists oportunidad_etapas_historial_oportunidad_idx
  on public.oportunidad_etapas_historial (oportunidad_id, cambiado_en);
create index if not exists oportunidad_etapas_historial_anterior_idx
  on public.oportunidad_etapas_historial (etapa_anterior_id);
create index if not exists oportunidad_etapas_historial_nueva_idx
  on public.oportunidad_etapas_historial (etapa_nueva_id);
create index if not exists oportunidad_etapas_historial_org_idx
  on public.oportunidad_etapas_historial (organizacion_id);

comment on table public.oportunidad_etapas_historial is
  'Cada cambio de etapa (y la etapa inicial, con etapa_anterior_id null). Lo escribe un trigger.';

-- Auditoria: cualquier modificacion de una oportunidad que ya estaba cerrada
-- (consigna: "si se modifica una oportunidad cerrada, el cambio debera quedar
-- registrado"). `cambios` = {campo: {antes, despues}}.
create table if not exists public.oportunidad_auditoria (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null default public.org_actual() references public.organizaciones (id) on delete cascade,
  oportunidad_id uuid not null,
  usuario_id uuid references public.perfiles (id) on delete set null,
  cambios jsonb not null,
  cambiado_en timestamptz not null default now(),
  constraint oportunidad_auditoria_oportunidad_id_fkey
    foreign key (organizacion_id, oportunidad_id) references public.oportunidades (organizacion_id, id)
);

create index if not exists oportunidad_auditoria_oportunidad_idx
  on public.oportunidad_auditoria (oportunidad_id, cambiado_en);
create index if not exists oportunidad_auditoria_org_idx
  on public.oportunidad_auditoria (organizacion_id);

-- Las oportunidades que ya existian arrancan su historial con la etapa en la
-- que estan HOY (no se inventa el recorrido que no quedo registrado).
insert into public.oportunidad_etapas_historial (organizacion_id, oportunidad_id, etapa_anterior_id, etapa_nueva_id, observacion)
select o.organizacion_id, o.id, null, o.etapa_id, 'Registro inicial: etapa vigente al activar el historial.'
from public.oportunidades o
where not exists (select 1 from public.oportunidad_etapas_historial h where h.oportunidad_id = o.id);

-- Reglas (BEFORE): el estado SALE del tipo de la etapa.
--   abierta -> sin fecha de cierre ni motivo
--   ganada  -> fecha_cierre (al cerrarse: la que venga, o hoy)
--   perdida -> fecha_cierre (idem) + motivo OBLIGATORIO
--   cerrada -> otro estado: solo con oportunidades.reabrir (y el nuevo cierre
--              lleva su propia fecha, no la del cierre anterior)
--   cerrada que sigue cerrada -> no se le puede borrar la fecha de cierre
-- Pedir un estado que no es el de la etapa es un error, no se corrige solo.
create or replace function public.oportunidad_reglas()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_tipo text;
begin
  select e.tipo into v_tipo
  from public.etapas e
  where e.id = new.etapa_id and e.organizacion_id = new.organizacion_id;

  -- Etapa inexistente o de otra organizacion: que la rechace la FK.
  if v_tipo is null then
    return new;
  end if;

  if (tg_op = 'INSERT' and new.estado <> 'abierta' and new.estado <> v_tipo)
     or (tg_op = 'UPDATE' and new.estado is distinct from old.estado and new.estado <> v_tipo) then
    raise exception 'La etapa elegida no es compatible con el estado "%".', new.estado
      using errcode = '23514';
  end if;
  new.estado := v_tipo;

  if tg_op = 'UPDATE' and old.estado <> 'abierta' and new.estado <> old.estado
     and auth.uid() is not null and not public.tiene_permiso('oportunidades.reabrir') then
    raise exception 'La oportunidad está cerrada: reabrirla requiere autorización (oportunidades.reabrir).'
      using errcode = '42501';
  end if;

  if new.estado = 'abierta' then
    new.fecha_cierre := null;
    new.motivo_perdida_id := null;
    return new;
  end if;

  if new.estado = 'ganada' then
    new.motivo_perdida_id := null;
  elsif new.motivo_perdida_id is null then
    raise exception 'Para marcar la oportunidad como perdida hay que indicar el motivo de pérdida.'
      using errcode = '23514';
  end if;

  if tg_op = 'INSERT' or new.estado <> old.estado then
    -- Se CIERRA ahora (desde abierta, o cambiando de resultado): la fecha real
    -- es la que mande quien cierra o, si no manda ninguna, hoy. La fecha de un
    -- cierre anterior no cuenta.
    if tg_op = 'UPDATE' and new.fecha_cierre is not distinct from old.fecha_cierre then
      new.fecha_cierre := null;
    end if;
    new.fecha_cierre := coalesce(new.fecha_cierre, current_date);
  elsif new.fecha_cierre is null then
    -- Sigue cerrada igual que antes: borrarle la fecha no se convierte en "hoy"
    -- en silencio, es un error.
    raise exception 'Una oportunidad cerrada tiene que tener fecha real de cierre.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists oportunidades_reglas on public.oportunidades;
create trigger oportunidades_reglas
  before insert or update on public.oportunidades
  for each row execute procedure public.oportunidad_reglas();

-- Historial (AFTER). La observacion llega por current_setting('crm.observacion'),
-- que pone cambiar_etapa(); un update directo la deja vacia.
-- SECURITY DEFINER: escribe en una tabla sin politicas de insert.
create or replace function public.oportunidad_registrar_etapa()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.etapa_id is distinct from old.etapa_id then
    insert into public.oportunidad_etapas_historial
      (organizacion_id, oportunidad_id, etapa_anterior_id, etapa_nueva_id, usuario_id, observacion)
    values (
      new.organizacion_id, new.id,
      case when tg_op = 'UPDATE' then old.etapa_id end,
      new.etapa_id,
      auth.uid(),
      nullif(btrim(coalesce(current_setting('crm.observacion', true), '')), '')
    );
  end if;
  return null;
end;
$$;

drop trigger if exists oportunidades_registrar_etapa on public.oportunidades;
create trigger oportunidades_registrar_etapa
  after insert or update on public.oportunidades
  for each row execute procedure public.oportunidad_registrar_etapa();

-- Auditoria (AFTER UPDATE) de oportunidades que estaban cerradas. Guarda solo
-- los campos que cambiaron (updated_at no cuenta).
create or replace function public.oportunidad_auditar_cerrada()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_cambios jsonb;
begin
  if old.estado = 'abierta' then
    return null;
  end if;

  select jsonb_object_agg(n.key, jsonb_build_object('antes', o.value, 'despues', n.value))
  into v_cambios
  from jsonb_each(to_jsonb(new)) n
  join jsonb_each(to_jsonb(old)) o using (key)
  where n.value is distinct from o.value and n.key <> 'updated_at';

  if v_cambios is not null then
    insert into public.oportunidad_auditoria (organizacion_id, oportunidad_id, usuario_id, cambios)
    values (new.organizacion_id, new.id, auth.uid(), v_cambios);
  end if;
  return null;
end;
$$;

drop trigger if exists oportunidades_auditar_cerrada on public.oportunidades;
create trigger oportunidades_auditar_cerrada
  after update on public.oportunidades
  for each row execute procedure public.oportunidad_auditar_cerrada();

-- RPC para cambiar de etapa desde el detalle o el tablero, con observacion y,
-- si corresponde, motivo y fecha de cierre. SECURITY INVOKER: corre con la RLS
-- y los permisos de quien llama, igual que un update directo. Las reglas las
-- aplica el trigger; esta funcion solo junta todo en un paso.
create or replace function public.cambiar_etapa(
  p_oportunidad uuid,
  p_etapa uuid,
  p_observacion text default null,
  p_motivo_perdida uuid default null,
  p_fecha_cierre date default null
)
returns public.oportunidades
language plpgsql
set search_path = public
as $$
declare
  v_op public.oportunidades;
begin
  perform set_config('crm.observacion', coalesce(p_observacion, ''), true);

  update public.oportunidades
  set etapa_id = p_etapa,
      motivo_perdida_id = coalesce(p_motivo_perdida, motivo_perdida_id),
      fecha_cierre = coalesce(p_fecha_cierre, fecha_cierre)
  where id = p_oportunidad
  returning * into v_op;

  perform set_config('crm.observacion', '', true);

  if v_op.id is null then
    raise exception 'No existe la oportunidad o no tenés permiso para modificarla.'
      using errcode = '42501';
  end if;
  return v_op;
end;
$$;

revoke execute on function public.cambiar_etapa(uuid, uuid, text, uuid, date) from public, anon;
grant execute on function public.cambiar_etapa(uuid, uuid, text, uuid, date) to authenticated, service_role;

-- ============================================================
-- 10. ACTIVIDADES (bitacora_entradas)
--
-- La tabla conserva su nombre. Gana tipo de catalogo, oportunidad y resultado,
-- y puede ser solo de un contacto (cliente individual, sin empresa).
--
-- COMPATIBILIDAD: la columna vieja `tipo` (texto) sigue. Se le saca el CHECK
-- de 7 valores; si un alta trae solo `tipo` (la app vieja), el trigger busca el
-- tipo de catalogo por su codigo; si trae tipo_actividad_id (la app nueva),
-- completa `tipo` con el codigo viejo equivalente para que la pantalla vieja
-- lo siga pintando.
-- ============================================================
do $$
declare
  r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.bitacora_entradas'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%llamada%'
  loop
    execute format('alter table public.bitacora_entradas drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.bitacora_entradas
  add column if not exists tipo_actividad_id uuid,
  add column if not exists oportunidad_id uuid,
  add column if not exists resultado text,
  alter column empresa_id drop not null,
  alter column autor_id set default auth.uid();

alter table public.bitacora_entradas drop constraint if exists bitacora_entradas_tipo_actividad_id_fkey;
alter table public.bitacora_entradas add constraint bitacora_entradas_tipo_actividad_id_fkey
  foreign key (organizacion_id, tipo_actividad_id) references public.tipos_actividad (organizacion_id, id);
alter table public.bitacora_entradas drop constraint if exists bitacora_entradas_oportunidad_id_fkey;
alter table public.bitacora_entradas add constraint bitacora_entradas_oportunidad_id_fkey
  foreign key (organizacion_id, oportunidad_id) references public.oportunidades (organizacion_id, id)
  on delete set null (oportunidad_id);

-- Contacto: era `on delete set null` (0004). Con actividades que pueden ser
-- solo de un contacto, eso terminaba en un error confuso del CHECK de abajo.
-- Ahora es NO ACTION: un contacto con actividades no se borra fisicamente (se
-- da de baja por estado) y el error dice que lo referencian. NO ACTION y no
-- RESTRICT, para que borrar una organizacion entera siga andando.
alter table public.bitacora_entradas drop constraint if exists bitacora_entradas_contacto_id_fkey;
alter table public.bitacora_entradas add constraint bitacora_entradas_contacto_id_fkey
  foreign key (organizacion_id, contacto_id) references public.contactos (organizacion_id, id);

alter table public.bitacora_entradas drop constraint if exists bitacora_entradas_empresa_o_contacto;
alter table public.bitacora_entradas add constraint bitacora_entradas_empresa_o_contacto
  check (empresa_id is not null or contacto_id is not null);

-- Backfill del tipo: "consulta" no esta entre los tipos de la consigna, va a Otro.
update public.bitacora_entradas b
set tipo_actividad_id = t.id
from public.tipos_actividad t
where b.tipo_actividad_id is null
  and t.organizacion_id = b.organizacion_id
  and t.codigo = case b.tipo when 'consulta' then 'otro' else b.tipo end;

update public.bitacora_entradas b
set tipo_actividad_id = t.id
from public.tipos_actividad t
where b.tipo_actividad_id is null and t.organizacion_id = b.organizacion_id and t.codigo = 'otro';

alter table public.bitacora_entradas alter column tipo_actividad_id set not null;

create index if not exists bitacora_contacto_id_idx
  on public.bitacora_entradas (contacto_id, ocurrido_en desc);
create index if not exists bitacora_oportunidad_id_idx
  on public.bitacora_entradas (oportunidad_id, ocurrido_en desc);
create index if not exists bitacora_tipo_actividad_id_idx
  on public.bitacora_entradas (tipo_actividad_id);

-- El autor es SIEMPRE quien la registra (la consigna pide "usuario que la
-- registro"): no se acepta un autor_id ajeno.
create or replace function public.bitacora_defaults()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_codigo text;
begin
  if auth.uid() is not null then
    new.autor_id := auth.uid();
  end if;

  if new.tipo_actividad_id is null then
    select t.id into new.tipo_actividad_id
    from public.tipos_actividad t
    where t.organizacion_id = new.organizacion_id
      and t.codigo = case new.tipo when 'consulta' then 'otro' else new.tipo end;

    if new.tipo_actividad_id is null then
      select t.id into new.tipo_actividad_id
      from public.tipos_actividad t
      where t.organizacion_id = new.organizacion_id and t.codigo = 'otro';
    end if;
  else
    select t.codigo into v_codigo
    from public.tipos_actividad t
    where t.id = new.tipo_actividad_id and t.organizacion_id = new.organizacion_id;

    new.tipo := case when v_codigo in ('llamada', 'reunion', 'email', 'whatsapp', 'queja', 'nota')
                     then v_codigo else 'nota' end;
  end if;

  return new;
end;
$$;

drop trigger if exists bitacora_defaults on public.bitacora_entradas;
create trigger bitacora_defaults
  before insert on public.bitacora_entradas
  for each row execute procedure public.bitacora_defaults();

-- ============================================================
-- 11. DATOS DEL PROVEEDOR (para presupuestos)
--
-- Los edita quien tenga configuracion.gestionar, solo en su organizacion. El
-- nombre y el estado (activa) de la organizacion siguen siendo del superadmin:
-- un trigger impide que el admin del cliente los toque (la politica de update
-- no puede limitar columnas).
-- ============================================================
alter table public.organizaciones
  add column if not exists razon_social text,
  add column if not exists cuit text,
  add column if not exists condicion_iva text,
  add column if not exists direccion text,
  add column if not exists telefono text,
  add column if not exists email text,
  add column if not exists sitio_web text,
  add column if not exists logo_path text,
  add column if not exists presupuesto_validez_dias int not null default 15,
  add column if not exists presupuesto_condiciones text;

alter table public.organizaciones drop constraint if exists organizaciones_condicion_iva_check;
alter table public.organizaciones add constraint organizaciones_condicion_iva_check
  check (condicion_iva is null or condicion_iva in ('responsable_inscripto', 'monotributo', 'exento'));
alter table public.organizaciones drop constraint if exists organizaciones_validez_check;
alter table public.organizaciones add constraint organizaciones_validez_check
  check (presupuesto_validez_dias > 0);

create or replace function public.organizaciones_proteger_plataforma()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Solo frena a los usuarios finales (rol authenticated). postgres,
  -- service_role y el superadmin siguen administrando la plataforma.
  if current_user = 'authenticated' and not public.es_superadmin()
     and (new.id, new.nombre, new.activa, new.created_at)
         is distinct from (old.id, old.nombre, old.activa, old.created_at) then
    raise exception 'El nombre y el estado de la organización los administra la plataforma.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists organizaciones_proteger_plataforma on public.organizaciones;
create trigger organizaciones_proteger_plataforma
  before update on public.organizaciones
  for each row execute procedure public.organizaciones_proteger_plataforma();

-- ============================================================
-- 12. RLS
--
-- Cartera propia: empresas, contactos y oportunidades se ven si el usuario
-- tiene clientes.ver_todos o es el responsable (un contacto, tambien si se ve
-- su empresa). Lo que cuelga de una empresa (ventas, items, alertas enviadas,
-- actividades) se ve si se ve la empresa: la subconsulta a `empresas` corre
-- con la RLS de quien consulta, asi que hereda la misma regla. La vista
-- alertas_vida_util es security_invoker y hace JOIN con empresas: ya queda
-- filtrada sin tocarla.
--
-- `(select ...)` evalua la funcion una vez por consulta y no una vez por fila.
-- Se borran y rearman solo las politicas de estas tablas (por nombre).
-- ============================================================

-- Empresas y contactos
drop policy if exists "ver" on public.empresas;
drop policy if exists "crear" on public.empresas;
drop policy if exists "editar" on public.empresas;
drop policy if exists "borrar" on public.empresas;

create policy "ver" on public.empresas for select to authenticated
  using (organizacion_id = (select public.org_actual()) and (select public.tiene_permiso('clientes.ver'))
         and ((select public.tiene_permiso('clientes.ver_todos')) or responsable_id = (select auth.uid())));
create policy "crear" on public.empresas for insert to authenticated
  with check (organizacion_id = (select public.org_actual()) and (select public.tiene_permiso('clientes.editar')));
create policy "editar" on public.empresas for update to authenticated
  using (organizacion_id = (select public.org_actual()) and (select public.tiene_permiso('clientes.editar'))
         and ((select public.tiene_permiso('clientes.ver_todos')) or responsable_id = (select auth.uid())))
  with check (organizacion_id = (select public.org_actual()) and (select public.tiene_permiso('clientes.editar')));
-- SIN politica de borrar (se quita arriba y NO se vuelve a crear; ver la 0008):
-- una empresa no se borra, se da de baja con estado = 'inactivo'.

drop policy if exists "ver" on public.contactos;
drop policy if exists "crear" on public.contactos;
drop policy if exists "editar" on public.contactos;
drop policy if exists "borrar" on public.contactos;

create policy "ver" on public.contactos for select to authenticated
  using (organizacion_id = (select public.org_actual()) and (select public.tiene_permiso('clientes.ver'))
         and ((select public.tiene_permiso('clientes.ver_todos')) or responsable_id = (select auth.uid())
              or exists (select 1 from public.empresas e where e.id = contactos.empresa_id)));
create policy "crear" on public.contactos for insert to authenticated
  with check (organizacion_id = (select public.org_actual()) and (select public.tiene_permiso('clientes.editar')));
create policy "editar" on public.contactos for update to authenticated
  using (organizacion_id = (select public.org_actual()) and (select public.tiene_permiso('clientes.editar'))
         and ((select public.tiene_permiso('clientes.ver_todos')) or responsable_id = (select auth.uid())
              or exists (select 1 from public.empresas e where e.id = contactos.empresa_id)))
  with check (organizacion_id = (select public.org_actual()) and (select public.tiene_permiso('clientes.editar')));
-- SIN politica de borrar (idem empresas): baja logica por estado.

-- Oportunidades
drop policy if exists "ver" on public.oportunidades;
drop policy if exists "crear" on public.oportunidades;
drop policy if exists "editar" on public.oportunidades;
drop policy if exists "borrar" on public.oportunidades;

create policy "ver" on public.oportunidades for select to authenticated
  using (organizacion_id = (select public.org_actual()) and (select public.tiene_permiso('oportunidades.ver'))
         and ((select public.tiene_permiso('clientes.ver_todos')) or responsable_id = (select auth.uid())));
create policy "crear" on public.oportunidades for insert to authenticated
  with check (organizacion_id = (select public.org_actual()) and (select public.tiene_permiso('oportunidades.editar')));
create policy "editar" on public.oportunidades for update to authenticated
  using (organizacion_id = (select public.org_actual()) and (select public.tiene_permiso('oportunidades.editar'))
         and ((select public.tiene_permiso('clientes.ver_todos')) or responsable_id = (select auth.uid())))
  with check (organizacion_id = (select public.org_actual()) and (select public.tiene_permiso('oportunidades.editar')));
-- SIN politica de borrar: una oportunidad no se borra, se marca perdida (baja
-- logica). Ademas su historial y su auditoria la referencian sin cascade.

-- Ventas e items: siguen a su empresa (y los items, a su venta).
drop policy if exists "ver" on public.ventas;
drop policy if exists "crear" on public.ventas;
drop policy if exists "editar" on public.ventas;
drop policy if exists "borrar" on public.ventas;

create policy "ver" on public.ventas for select to authenticated
  using (organizacion_id = (select public.org_actual()) and (select public.tiene_permiso('ventas.ver'))
         and ((select public.tiene_permiso('clientes.ver_todos'))
              or exists (select 1 from public.empresas e where e.id = ventas.empresa_id)));
create policy "crear" on public.ventas for insert to authenticated
  with check (organizacion_id = (select public.org_actual()) and (select public.tiene_permiso('ventas.editar'))
              and ((select public.tiene_permiso('clientes.ver_todos'))
                   or exists (select 1 from public.empresas e where e.id = ventas.empresa_id)));
create policy "editar" on public.ventas for update to authenticated
  using (organizacion_id = (select public.org_actual()) and (select public.tiene_permiso('ventas.editar'))
         and ((select public.tiene_permiso('clientes.ver_todos'))
              or exists (select 1 from public.empresas e where e.id = ventas.empresa_id)))
  with check (organizacion_id = (select public.org_actual()) and (select public.tiene_permiso('ventas.editar'))
              and ((select public.tiene_permiso('clientes.ver_todos'))
                   or exists (select 1 from public.empresas e where e.id = ventas.empresa_id)));
create policy "borrar" on public.ventas for delete to authenticated
  using (organizacion_id = (select public.org_actual()) and (select public.tiene_permiso('ventas.editar'))
         and ((select public.tiene_permiso('clientes.ver_todos'))
              or exists (select 1 from public.empresas e where e.id = ventas.empresa_id)));

drop policy if exists "ver" on public.venta_items;
drop policy if exists "crear" on public.venta_items;
drop policy if exists "editar" on public.venta_items;
drop policy if exists "borrar" on public.venta_items;

create policy "ver" on public.venta_items for select to authenticated
  using (organizacion_id = (select public.org_actual()) and (select public.tiene_permiso('ventas.ver'))
         and ((select public.tiene_permiso('clientes.ver_todos'))
              or exists (select 1 from public.ventas v where v.id = venta_items.venta_id)));
create policy "crear" on public.venta_items for insert to authenticated
  with check (organizacion_id = (select public.org_actual()) and (select public.tiene_permiso('ventas.editar'))
              and ((select public.tiene_permiso('clientes.ver_todos'))
                   or exists (select 1 from public.ventas v where v.id = venta_items.venta_id)));
create policy "editar" on public.venta_items for update to authenticated
  using (organizacion_id = (select public.org_actual()) and (select public.tiene_permiso('ventas.editar'))
         and ((select public.tiene_permiso('clientes.ver_todos'))
              or exists (select 1 from public.ventas v where v.id = venta_items.venta_id)))
  with check (organizacion_id = (select public.org_actual()) and (select public.tiene_permiso('ventas.editar'))
              and ((select public.tiene_permiso('clientes.ver_todos'))
                   or exists (select 1 from public.ventas v where v.id = venta_items.venta_id)));
create policy "borrar" on public.venta_items for delete to authenticated
  using (organizacion_id = (select public.org_actual()) and (select public.tiene_permiso('ventas.editar'))
         and ((select public.tiene_permiso('clientes.ver_todos'))
              or exists (select 1 from public.ventas v where v.id = venta_items.venta_id)));

-- Alertas enviadas: siguen a su item (y por ahi a la empresa). Siguen siendo
-- un registro: sin update ni delete.
drop policy if exists "ver" on public.alertas_enviadas;
drop policy if exists "crear" on public.alertas_enviadas;

create policy "ver" on public.alertas_enviadas for select to authenticated
  using (organizacion_id = (select public.org_actual()) and (select public.tiene_permiso('alertas.ver'))
         and ((select public.tiene_permiso('clientes.ver_todos'))
              or exists (select 1 from public.venta_items vi where vi.id = alertas_enviadas.venta_item_id)));
create policy "crear" on public.alertas_enviadas for insert to authenticated
  with check (organizacion_id = (select public.org_actual()) and (select public.tiene_permiso('alertas.enviar'))
              and ((select public.tiene_permiso('clientes.ver_todos'))
                   or exists (select 1 from public.venta_items vi where vi.id = alertas_enviadas.venta_item_id)));

-- Actividades: se ven si se ve su empresa, su contacto o su oportunidad.
-- Siguen siendo un registro: sin update ni delete.
drop policy if exists "ver" on public.bitacora_entradas;
drop policy if exists "crear" on public.bitacora_entradas;

create policy "ver" on public.bitacora_entradas for select to authenticated
  using (organizacion_id = (select public.org_actual()) and (select public.tiene_permiso('bitacora.ver'))
         and ((select public.tiene_permiso('clientes.ver_todos'))
              or exists (select 1 from public.empresas e where e.id = bitacora_entradas.empresa_id)
              or exists (select 1 from public.contactos c where c.id = bitacora_entradas.contacto_id)
              or exists (select 1 from public.oportunidades o where o.id = bitacora_entradas.oportunidad_id)));
-- Para ESCRIBIR no alcanza con ver una de las referencias: cada una que venga
-- tiene que ser visible para quien registra, y tienen que ser coherentes entre
-- si (el contacto, de esa empresa; la oportunidad, de esa empresa o sin
-- empresa). Si no, un vendedor podria colgar una actividad en el cliente de
-- otro usando su propia oportunidad como llave. Las subconsultas corren con la
-- RLS de quien inserta: "existe" = "lo ve".
create policy "crear" on public.bitacora_entradas for insert to authenticated
  with check (organizacion_id = (select public.org_actual()) and (select public.tiene_permiso('bitacora.escribir'))
              and (empresa_id is null
                   or exists (select 1 from public.empresas e where e.id = bitacora_entradas.empresa_id))
              and (contacto_id is null
                   or exists (select 1 from public.contactos c
                              where c.id = bitacora_entradas.contacto_id
                                and (bitacora_entradas.empresa_id is null
                                     or c.empresa_id = bitacora_entradas.empresa_id)))
              and (oportunidad_id is null
                   or exists (select 1 from public.oportunidades o
                              where o.id = bitacora_entradas.oportunidad_id
                                and (bitacora_entradas.empresa_id is null or o.empresa_id is null
                                     or o.empresa_id = bitacora_entradas.empresa_id))));

-- Historial y auditoria: lectura para quien ve la oportunidad. Sin politicas
-- de escritura: los escriben solo los triggers.
alter table public.oportunidad_etapas_historial enable row level security;
alter table public.oportunidad_auditoria enable row level security;

drop policy if exists "ver" on public.oportunidad_etapas_historial;
create policy "ver" on public.oportunidad_etapas_historial for select to authenticated
  using (organizacion_id = (select public.org_actual()) and (select public.tiene_permiso('oportunidades.ver'))
         and exists (select 1 from public.oportunidades o where o.id = oportunidad_etapas_historial.oportunidad_id));

drop policy if exists "ver" on public.oportunidad_auditoria;
create policy "ver" on public.oportunidad_auditoria for select to authenticated
  using (organizacion_id = (select public.org_actual()) and (select public.tiene_permiso('oportunidades.ver'))
         and exists (select 1 from public.oportunidades o where o.id = oportunidad_auditoria.oportunidad_id));

-- Catalogos: los lee quien usa el modulo; los escribe configuracion.gestionar.
-- Etapas: la lectura de la 0005 queda igual (cualquiera de la organizacion).
do $$
declare
  cfg text[];
begin
  foreach cfg slice 1 in array array[
    ['origenes',        'clientes.ver',      'oportunidades.ver'],
    ['motivos_perdida', 'oportunidades.ver', 'oportunidades.ver'],
    ['tipos_actividad', 'bitacora.ver',      'bitacora.ver']
  ] loop
    execute format('alter table public.%I enable row level security', cfg[1]);
    execute format('drop policy if exists "ver" on public.%I', cfg[1]);
    execute format(
      'create policy "ver" on public.%I for select to authenticated
         using (organizacion_id = (select public.org_actual())
                and ((select public.tiene_permiso(%L)) or (select public.tiene_permiso(%L))
                     or (select public.tiene_permiso(''configuracion.gestionar''))))',
      cfg[1], cfg[2], cfg[3]);
  end loop;
end $$;

do $$
declare
  t text;
begin
  foreach t in array array['origenes', 'motivos_perdida', 'tipos_actividad', 'etapas'] loop
    execute format('drop policy if exists "crear" on public.%I', t);
    execute format('drop policy if exists "editar" on public.%I', t);
    execute format('drop policy if exists "borrar" on public.%I', t);
    execute format(
      'create policy "crear" on public.%I for insert to authenticated
         with check (organizacion_id = (select public.org_actual())
                     and (select public.tiene_permiso(''configuracion.gestionar'')))', t);
    execute format(
      'create policy "editar" on public.%I for update to authenticated
         using (organizacion_id = (select public.org_actual())
                and (select public.tiene_permiso(''configuracion.gestionar'')))
         with check (organizacion_id = (select public.org_actual())
                     and (select public.tiene_permiso(''configuracion.gestionar'')))', t);
    execute format(
      'create policy "borrar" on public.%I for delete to authenticated
         using (organizacion_id = (select public.org_actual())
                and (select public.tiene_permiso(''configuracion.gestionar'')))', t);
  end loop;
end $$;

-- Organizaciones: los datos del proveedor los edita configuracion.gestionar.
drop policy if exists "configurar" on public.organizaciones;
create policy "configurar" on public.organizaciones for update to authenticated
  using (id = (select public.org_actual()) and (select public.tiene_permiso('configuracion.gestionar')))
  with check (id = (select public.org_actual()) and (select public.tiene_permiso('configuracion.gestionar')));

-- ============================================================
-- 13. LOGO DEL PROVEEDOR (Supabase Storage)
--
-- Bucket PRIVADO (se sirve con URLs firmadas). Solo PNG, JPG o WebP de hasta
-- 1 MB: el limite y los tipos los aplica Storage al subir. SVG queda afuera a
-- proposito: un SVG subido por un usuario puede traer scripts.
-- Ruta: {organizacion_id}/logo.{ext}. Lo ve cualquiera de la organizacion (va
-- en los presupuestos); lo sube, cambia o borra configuracion.gestionar.
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', false, 1048576, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "logos: ver el de la propia organizacion" on storage.objects;
create policy "logos: ver el de la propia organizacion" on storage.objects
  for select to authenticated
  using (bucket_id = 'logos' and split_part(name, '/', 1) = (select public.org_actual())::text);

drop policy if exists "logos: subir el de la propia organizacion" on storage.objects;
create policy "logos: subir el de la propia organizacion" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'logos'
              and split_part(name, '/', 1) = (select public.org_actual())::text
              and name ~ '^[0-9a-f-]{36}/logo\.(png|jpg|jpeg|webp)$'
              and (select public.tiene_permiso('configuracion.gestionar')));

drop policy if exists "logos: cambiar el de la propia organizacion" on storage.objects;
create policy "logos: cambiar el de la propia organizacion" on storage.objects
  for update to authenticated
  using (bucket_id = 'logos'
         and split_part(name, '/', 1) = (select public.org_actual())::text
         and (select public.tiene_permiso('configuracion.gestionar')))
  with check (bucket_id = 'logos'
              and split_part(name, '/', 1) = (select public.org_actual())::text
              and name ~ '^[0-9a-f-]{36}/logo\.(png|jpg|jpeg|webp)$'
              and (select public.tiene_permiso('configuracion.gestionar')));

drop policy if exists "logos: borrar el de la propia organizacion" on storage.objects;
create policy "logos: borrar el de la propia organizacion" on storage.objects
  for delete to authenticated
  using (bucket_id = 'logos'
         and split_part(name, '/', 1) = (select public.org_actual())::text
         and (select public.tiene_permiso('configuracion.gestionar')));
