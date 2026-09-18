-- Tuco & Nito - ROLES CON PERMISOS dentro de cada organizacion.
--
-- Reemplaza el rol fijo `admin`/`usuario` de la 0004 por ROLES propios de cada
-- organizacion, cada uno con un conjunto de PERMISOS. Cada cliente arranca con
-- Administrador, Ventas, Corporativo y Solo lectura, y su admin puede crear
-- los suyos (RRHH, Logistica...). La base exige el permiso en cada operacion:
-- esconder un boton en la pantalla es solo comodidad.
--
-- COMO CORRERLO: pegar TODO en el SQL Editor y ejecutar. Despues, correr
-- supabase/tests/0005_permisos.sql para verificar.
--
-- Requiere la 0004 aplicada. Va dentro de BEGIN/COMMIT: si algo falla, no se
-- aplica nada.
--
-- Migracion de lo existente: rol `admin` -> Administrador; rol `usuario` ->
-- Ventas (lo mas parecido a lo que podia hacer: todo el CRM, sin administrar
-- usuarios).
--
-- SINCRONIA: la lista de permisos (CHECK de roles.permisos y roles por
-- defecto) tiene que coincidir con src/lib/permisos.ts. El test
-- src/lib/permisos.check.ts lo verifica.

begin;

-- ============================================================
-- 1. ROLES
--
-- El rol `es_admin` (Administrador) tiene todos los permisos y NO se puede
-- editar ni borrar: asi ninguna organizacion se queda sin alguien que pueda
-- administrarla.
-- ============================================================
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references public.organizaciones (id) on delete cascade,
  nombre text not null,
  descripcion text,
  es_admin boolean not null default false,
  permisos text[] not null default '{}',
  created_at timestamptz not null default now(),
  constraint roles_org_nombre_key unique (organizacion_id, nombre),
  constraint roles_org_id_key unique (organizacion_id, id),
  -- Solo claves del catalogo (src/lib/permisos.ts).
  constraint roles_permisos_validos check (permisos <@ array[
    'tablero.ver',
    'clientes.ver', 'clientes.editar',
    'bitacora.ver', 'bitacora.escribir',
    'oportunidades.ver', 'oportunidades.editar',
    'productos.ver', 'productos.editar',
    'ventas.ver', 'ventas.editar',
    'alertas.ver', 'alertas.enviar',
    'usuarios.gestionar'
  ]::text[])
);

create index if not exists roles_organizacion_id_idx on public.roles (organizacion_id);

-- Roles con los que arranca cada organizacion (igual que ROLES_POR_DEFECTO en
-- src/lib/permisos.ts, con las dependencias ya expandidas).
create or replace function public.crear_roles_iniciales(p_org uuid)
returns void
language sql
security definer set search_path = public
as $$
  insert into public.roles (organizacion_id, nombre, descripcion, es_admin, permisos) values
    (p_org, 'Administrador', 'Acceso total, incluida la gestión de usuarios y roles.', true,
      array['tablero.ver', 'clientes.ver', 'clientes.editar', 'bitacora.ver', 'bitacora.escribir',
            'oportunidades.ver', 'oportunidades.editar', 'productos.ver', 'productos.editar',
            'ventas.ver', 'ventas.editar', 'alertas.ver', 'alertas.enviar', 'usuarios.gestionar']),
    (p_org, 'Ventas', 'Trabaja clientes, oportunidades, ventas y alertas. No administra usuarios.', false,
      array['tablero.ver', 'clientes.ver', 'clientes.editar', 'bitacora.ver', 'bitacora.escribir',
            'oportunidades.ver', 'oportunidades.editar', 'productos.ver',
            'ventas.ver', 'ventas.editar', 'alertas.ver', 'alertas.enviar']),
    (p_org, 'Corporativo', 'Ve todo para seguimiento y reportes, sin modificar.', false,
      array['tablero.ver', 'clientes.ver', 'bitacora.ver', 'oportunidades.ver', 'productos.ver',
            'ventas.ver', 'alertas.ver']),
    (p_org, 'Solo lectura', 'Consulta clientes y catálogo.', false,
      array['clientes.ver', 'productos.ver'])
  on conflict (organizacion_id, nombre) do nothing;
$$;

-- Roles para TODAS las organizaciones que ya existen (la demo y las que se
-- hayan creado despues de la 0004).
select public.crear_roles_iniciales(id) from public.organizaciones;

-- ============================================================
-- 2. PERFILES: rol -> rol_id
-- ============================================================
alter table public.perfiles add column if not exists rol_id uuid;

-- El rol tiene que ser de la MISMA organizacion del usuario (FK compuesta).
-- `restrict`: no se puede borrar un rol que alguien tiene asignado.
alter table public.perfiles drop constraint if exists perfiles_rol_fkey;
alter table public.perfiles add constraint perfiles_rol_fkey
  foreign key (organizacion_id, rol_id) references public.roles (organizacion_id, id)
  on delete restrict;

-- Migrar el rol viejo (solo si la columna todavia existe: re-ejecutable).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'perfiles' and column_name = 'rol'
  ) then
    update public.perfiles p
    set rol_id = r.id
    from public.roles r
    where p.rol_id is null
      and r.organizacion_id = p.organizacion_id
      and r.nombre = case when p.rol = 'admin' then 'Administrador' else 'Ventas' end;

    alter table public.perfiles drop constraint if exists perfiles_rol_check;
    alter table public.perfiles drop column rol;
  end if;
end $$;

-- Los emails se guardan en minuscula y la app los busca por igualdad exacta:
-- estos indices son los que usan esas consultas (los de lower() de la 0004 no).
create index if not exists perfiles_email_eq_idx on public.perfiles (email);
create index if not exists envios_auth_email_eq_idx on public.envios_auth (email, created_at desc);

-- ============================================================
-- 2b. LIMITE DE MAILS DE CUENTA, ATOMICO
--
-- La 0004 dejo la tabla envios_auth; la app leia cuantos mails se mandaron y
-- DESPUES insertaba. Con pedidos en paralelo, varios leian el mismo conteo y
-- se colaban mas envios que el limite. Esta funcion toma un lock por
-- (email, tipo) y chequea + registra en la misma transaccion: el segundo
-- pedido espera al primero y ya ve su registro.
--
-- Solo la llama el servidor (service_role): se le quita el permiso de
-- ejecucion a anon y authenticated.
-- ============================================================
create or replace function public.registrar_envio_auth(p_email text, p_tipo text)
returns boolean
language plpgsql
security definer set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtext(p_email || ':' || p_tipo));

  if exists (
       select 1 from public.envios_auth
       where email = p_email and tipo = p_tipo and created_at > now() - interval '1 minute'
     )
     or (
       select count(*) from public.envios_auth
       where email = p_email and tipo = p_tipo and created_at > now() - interval '1 hour'
     ) >= 5
  then
    return false;
  end if;

  insert into public.envios_auth (email, tipo) values (p_email, p_tipo);
  return true;
end;
$$;

revoke execute on function public.registrar_envio_auth(text, text) from public, anon, authenticated;
grant execute on function public.registrar_envio_auth(text, text) to service_role;

-- ============================================================
-- 3. PERMISOS
--
-- SECURITY DEFINER por el mismo motivo que org_actual(): lee perfiles y roles
-- salteando su RLS, sin recursion. Usuario dado de baja u organizacion
-- inactiva => false para todo.
-- ============================================================
create or replace function public.tiene_permiso(p_permiso text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select p_permiso = any (r.permisos)
    from public.perfiles p
    join public.organizaciones o on o.id = p.organizacion_id
    join public.roles r on r.id = p.rol_id
    where p.id = auth.uid() and p.activo and o.activa
  ), false)
$$;

-- ============================================================
-- 4. ALTAS
--
-- La organizacion y el rol se leen de raw_APP_meta_data (solo la escribe el
-- servidor con la service_role key), NUNCA de raw_user_meta_data (la edita el
-- propio usuario). Y el rol tiene que ser de esa misma organizacion: si no,
-- queda sin rol, es decir, sin ningun permiso.
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_org uuid := nullif(new.raw_app_meta_data ->> 'organizacion_id', '')::uuid;
  v_rol uuid := nullif(new.raw_app_meta_data ->> 'rol_id', '')::uuid;
begin
  -- Sin organizacion no se crea el perfil (el check perfiles_org_o_superadmin
  -- lo rechazaria y haria fallar el alta en Auth). El servidor igual completa
  -- el perfil despues de crear el usuario (ver src/lib/cuentas.ts).
  if v_org is null then
    return new;
  end if;

  if not exists (select 1 from public.roles where id = v_rol and organizacion_id = v_org) then
    v_rol := null;
  end if;

  insert into public.perfiles (id, nombre, email, organizacion_id, rol_id)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'nombre', new.email), new.email, v_org, v_rol)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Toda organizacion nueva arranca con sus roles y las etapas del embudo.
-- Reemplaza al trigger de la 0004, que solo creaba las etapas.
drop trigger if exists organizaciones_etapas_iniciales on public.organizaciones;
drop function if exists public.organizacion_etapas_iniciales();

create or replace function public.organizacion_inicial()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.crear_roles_iniciales(new.id);
  insert into public.etapas (organizacion_id, nombre, orden, color) values
    (new.id, 'Nuevo', 1, '#94a3b8'),
    (new.id, 'Calificación', 2, '#60a5fa'),
    (new.id, 'Propuesta Enviada', 3, '#fbbf24'),
    (new.id, 'Negociación', 4, '#fb923c'),
    (new.id, 'Ganada', 5, '#4ade80'),
    (new.id, 'Perdida', 6, '#f87171');
  return new;
end;
$$;

drop trigger if exists organizaciones_inicial on public.organizaciones;
create trigger organizaciones_inicial
  after insert on public.organizaciones
  for each row execute procedure public.organizacion_inicial();

-- ============================================================
-- 5. RLS
--
-- Se BORRAN TODAS las politicas de estas tablas y se rearman: las politicas
-- se combinan con OR, y una "solo la propia organizacion" de la 0004 que
-- quedara viva dejaria hacer TODO dentro de la organizacion, ignorando el rol.
--
-- Cada politica pide DOS cosas: fila de la organizacion propia Y el permiso.
-- ============================================================
do $$
declare
  r record;
begin
  for r in
    select policyname, tablename from pg_policies
    where schemaname = 'public' and tablename in (
      'perfiles', 'organizaciones', 'roles', 'empresas', 'contactos', 'productos', 'etapas',
      'oportunidades', 'ventas', 'venta_items', 'bitacora_entradas', 'alertas_enviadas'
    )
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

alter table public.roles enable row level security;

-- Tablas con permiso de VER y de EDITAR: ver -> select; editar -> insert/update/delete.
do $$
declare
  cfg text[];
begin
  foreach cfg slice 1 in array array[
    ['empresas',      'clientes.ver',      'clientes.editar'],
    ['contactos',     'clientes.ver',      'clientes.editar'],
    ['productos',     'productos.ver',     'productos.editar'],
    ['oportunidades', 'oportunidades.ver', 'oportunidades.editar'],
    ['ventas',        'ventas.ver',        'ventas.editar'],
    ['venta_items',   'ventas.ver',        'ventas.editar']
  ] loop
    execute format(
      'create policy "ver" on public.%I for select to authenticated
         using (organizacion_id = (select public.org_actual()) and (select public.tiene_permiso(%L)))',
      cfg[1], cfg[2]);
    execute format(
      'create policy "crear" on public.%I for insert to authenticated
         with check (organizacion_id = (select public.org_actual()) and (select public.tiene_permiso(%L)))',
      cfg[1], cfg[3]);
    execute format(
      'create policy "editar" on public.%I for update to authenticated
         using (organizacion_id = (select public.org_actual()) and (select public.tiene_permiso(%L)))
         with check (organizacion_id = (select public.org_actual()) and (select public.tiene_permiso(%L)))',
      cfg[1], cfg[3], cfg[3]);
    execute format(
      'create policy "borrar" on public.%I for delete to authenticated
         using (organizacion_id = (select public.org_actual()) and (select public.tiene_permiso(%L)))',
      cfg[1], cfg[3]);
  end loop;
end $$;

-- Bitacora y alertas enviadas son REGISTROS: se leen y se agregan, nunca se
-- editan ni se borran. Sin politicas de update/delete, la base lo impide.
create policy "ver" on public.bitacora_entradas for select to authenticated
  using (organizacion_id = (select public.org_actual()) and (select public.tiene_permiso('bitacora.ver')));
create policy "crear" on public.bitacora_entradas for insert to authenticated
  with check (organizacion_id = (select public.org_actual()) and (select public.tiene_permiso('bitacora.escribir')));

create policy "ver" on public.alertas_enviadas for select to authenticated
  using (organizacion_id = (select public.org_actual()) and (select public.tiene_permiso('alertas.ver')));
create policy "crear" on public.alertas_enviadas for insert to authenticated
  with check (organizacion_id = (select public.org_actual()) and (select public.tiene_permiso('alertas.enviar')));

-- Etapas: las lee cualquier usuario de la organizacion (arman el embudo).
create policy "ver" on public.etapas for select to authenticated
  using (organizacion_id = (select public.org_actual()));

-- Roles: los ven los de la organizacion (cada uno necesita conocer sus
-- permisos) y el superadmin. Los administra quien tenga usuarios.gestionar,
-- salvo el rol Administrador (es_admin): ni editarlo, ni borrarlo, ni crear
-- otro con esa marca.
create policy "ver" on public.roles for select to authenticated
  using (organizacion_id = (select public.org_actual()) or (select public.es_superadmin()));
create policy "crear" on public.roles for insert to authenticated
  with check (organizacion_id = (select public.org_actual())
              and (select public.tiene_permiso('usuarios.gestionar')) and not es_admin);
create policy "editar" on public.roles for update to authenticated
  using (organizacion_id = (select public.org_actual())
         and (select public.tiene_permiso('usuarios.gestionar')) and not es_admin)
  with check (organizacion_id = (select public.org_actual())
              and (select public.tiene_permiso('usuarios.gestionar')) and not es_admin);
create policy "borrar" on public.roles for delete to authenticated
  using (organizacion_id = (select public.org_actual())
         and (select public.tiene_permiso('usuarios.gestionar')) and not es_admin);

-- Perfiles: uno mismo, los de la organizacion (para elegir un responsable) y
-- el superadmin. NO hay insert/update/delete: nadie toca su propio rol ni su
-- organizacion. Esos cambios los hace solo el servidor, con la service_role
-- key y despues de verificar permisos.
create policy "ver" on public.perfiles for select to authenticated
  using (
    id = (select auth.uid())
    or organizacion_id = (select public.org_actual())
    or (select public.es_superadmin())
  );

-- Organizaciones: cada uno ve la suya; el superadmin las ve y administra todas.
create policy "ver" on public.organizaciones for select to authenticated
  using (id = (select public.org_actual()) or (select public.es_superadmin()));
create policy "superadmin" on public.organizaciones for all to authenticated
  using ((select public.es_superadmin()))
  with check ((select public.es_superadmin()));

commit;
