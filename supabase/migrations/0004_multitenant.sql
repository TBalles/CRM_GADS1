-- Tuco & Nito - MULTITENANT: organizaciones, roles y aislamiento por RLS.
--
-- Cada cliente del CRM es una ORGANIZACION. Cada usuario pertenece a una, y la
-- base (no el codigo de la app) garantiza que solo ve y toca las filas de su
-- organizacion.
--
-- COMO CORRERLO
--   1. Cambiar el email de la linea marcada con >>> por el de la cuenta que va
--      a ser SUPERADMIN (tiene que ser un usuario que ya exista en Auth).
--   2. Pegar TODO el archivo en el SQL Editor de Supabase y ejecutar.
--   3. Correr supabase/tests/0004_aislamiento.sql para verificar el aislamiento.
--
-- Va entero dentro de BEGIN/COMMIT: si cualquier sentencia falla, no se aplica
-- nada y la base queda exactamente como estaba.
--
-- Requiere 0001, 0002 y 0003 aplicadas, y Postgres 15+ (usa
-- `on delete set null (columna)`, que es de PG15).

begin;

-- >>> Email del superadmin. Cambialo antes de ejecutar.
select set_config('tn.superadmin_email', 'admin@crmgads1.com', true);

-- ============================================================
-- 1. ORGANIZACIONES
-- ============================================================
create table if not exists public.organizaciones (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  activa boolean not null default true,
  created_at timestamptz not null default now()
);

-- Todo lo que ya existe (datos y usuarios) pasa a esta organizacion. Id fijo
-- para poder referenciarla en este script y en el de pruebas.
insert into public.organizaciones (id, nombre)
values ('00000000-0000-0000-0000-000000000001', 'Tuco & Nito (demo)')
on conflict (id) do nothing;

-- ============================================================
-- 2. PERFILES: organizacion, rol, superadmin, activo
--
-- - rol: dentro de SU organizacion. `admin` invita y administra usuarios;
--   `usuario` usa el CRM.
-- - es_superadmin: nivel PLATAFORMA (ustedes). Crea organizaciones y su
--   primer admin. NO ve los datos comerciales de otros clientes: solo
--   organizaciones y usuarios. Minimo privilegio.
-- - activo: false = usuario dado de baja. No ve nada aunque tenga sesion.
-- - activado_at: cuando la persona DEFINIO SU CONTRASEÑA. Null = invitacion
--   pendiente. No alcanza con auth.users.email_confirmed_at: Supabase lo marca
--   apenas se toca el link, y si la persona cierra la pestaña sin elegir
--   contraseña queda "confirmada" pero sin poder ingresar nunca.
-- ============================================================
alter table public.perfiles
  add column if not exists organizacion_id uuid references public.organizaciones (id) on delete cascade,
  add column if not exists rol text not null default 'usuario',
  add column if not exists es_superadmin boolean not null default false,
  add column if not exists activo boolean not null default true,
  add column if not exists activado_at timestamptz;

alter table public.perfiles drop constraint if exists perfiles_rol_check;
alter table public.perfiles add constraint perfiles_rol_check check (rol in ('admin', 'usuario'));

create index if not exists perfiles_organizacion_id_idx on public.perfiles (organizacion_id);
create index if not exists perfiles_email_idx on public.perfiles (lower(email));

-- Los usuarios existentes eran el equipo interno: quedan como admins de la demo.
update public.perfiles
set organizacion_id = '00000000-0000-0000-0000-000000000001', rol = 'admin'
where organizacion_id is null;

-- Activado = tiene contraseña. Se deriva de auth.users y no de "todos los que
-- existen": asi, si este script se vuelve a correr cuando ya hay invitaciones
-- pendientes, no las marca como activadas por error.
update public.perfiles p
set activado_at = coalesce(p.created_at, now())
where p.activado_at is null
  and exists (
    select 1 from auth.users u
    where u.id = p.id and coalesce(u.encrypted_password, '') <> ''
  );

update public.perfiles
set es_superadmin = true
where lower(email) = lower(current_setting('tn.superadmin_email'));

do $$
begin
  if not exists (select 1 from public.perfiles where es_superadmin) then
    raise exception 'No existe un usuario con el email "%". Cambialo en la linea marcada con >>> (tiene que existir en Authentication > Users).',
      current_setting('tn.superadmin_email');
  end if;
end $$;

-- Un usuario sin organizacion solo tiene sentido si es superadmin puro.
alter table public.perfiles drop constraint if exists perfiles_org_o_superadmin;
alter table public.perfiles add constraint perfiles_org_o_superadmin
  check (organizacion_id is not null or es_superadmin);

-- ============================================================
-- 3. FUNCIONES DE CONTEXTO
--
-- SECURITY DEFINER: leen `perfiles` salteando su RLS. Sin eso, la politica de
-- perfiles llamaria a una funcion que lee perfiles, que evalua la politica de
-- perfiles... recursion infinita.
--
-- org_actual() devuelve NULL si el usuario esta dado de baja o su
-- organizacion esta inactiva: con NULL, ninguna politica deja pasar una fila.
-- ============================================================
create or replace function public.org_actual()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.organizacion_id
  from public.perfiles p
  join public.organizaciones o on o.id = p.organizacion_id
  where p.id = auth.uid() and p.activo and o.activa
$$;

create or replace function public.es_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.es_superadmin from public.perfiles p where p.id = auth.uid() and p.activo),
    false
  )
$$;

-- ============================================================
-- 4. organizacion_id EN TODAS LAS TABLAS DE DATOS
--
-- DEFAULT org_actual(): la app no manda la organizacion al insertar, la pone
-- la base. Y aunque alguien la mande a mano, la politica (WITH CHECK) rechaza
-- cualquier valor que no sea la organizacion propia.
-- ============================================================
do $$
declare
  t text;
begin
  foreach t in array array[
    'empresas', 'contactos', 'productos', 'etapas', 'oportunidades',
    'ventas', 'venta_items', 'bitacora_entradas', 'alertas_enviadas'
  ] loop
    execute format(
      'alter table public.%I add column if not exists organizacion_id uuid references public.organizaciones (id) on delete cascade', t);
    execute format(
      'update public.%I set organizacion_id = %L where organizacion_id is null', t,
      '00000000-0000-0000-0000-000000000001');
    execute format('alter table public.%I alter column organizacion_id set not null', t);
    execute format('alter table public.%I alter column organizacion_id set default public.org_actual()', t);
    execute format('create index if not exists %I on public.%I (organizacion_id)', t || '_organizacion_id_idx', t);
  end loop;
end $$;

-- ============================================================
-- 5. UNICIDADES POR ORGANIZACION
--
-- Dos clientes distintos pueden tener un producto con el mismo nombre, y cada
-- uno su etapa 1. Lo que no puede pasar es repetirlo DENTRO del mismo cliente.
-- ============================================================
alter table public.productos drop constraint if exists productos_nombre_key;
alter table public.productos drop constraint if exists productos_org_nombre_key;
alter table public.productos add constraint productos_org_nombre_key unique (organizacion_id, nombre);

alter table public.etapas drop constraint if exists etapas_orden_key;
alter table public.etapas drop constraint if exists etapas_org_orden_key;
alter table public.etapas add constraint etapas_org_orden_key unique (organizacion_id, orden);

-- ============================================================
-- 6. CLAVES FORANEAS QUE NO CRUZAN ORGANIZACIONES
--
-- Una FK comun se valida SIN mirar la RLS: un usuario del cliente A que
-- conociera el id de una empresa del cliente B podria colgarle un contacto.
-- No la veria, pero ensuciaria datos ajenos. Con FKs COMPUESTAS
-- (organizacion_id, x_id) la base exige que la fila referenciada sea de la
-- MISMA organizacion. Es la garantia mas fuerte posible: no depende de ningun
-- chequeo en la app.
-- ============================================================
do $$
declare
  t text;
begin
  -- Lado referenciado: (organizacion_id, id) tiene que ser unico.
  foreach t in array array[
    'empresas', 'contactos', 'productos', 'etapas', 'oportunidades', 'ventas', 'venta_items'
  ] loop
    execute format('alter table public.%I drop constraint if exists %I', t, t || '_org_id_key');
    execute format('alter table public.%I add constraint %I unique (organizacion_id, id)', t, t || '_org_id_key');
  end loop;
end $$;

-- contactos -> empresas
alter table public.contactos drop constraint if exists contactos_empresa_id_fkey;
alter table public.contactos add constraint contactos_empresa_id_fkey
  foreign key (organizacion_id, empresa_id) references public.empresas (organizacion_id, id)
  on delete set null (empresa_id);

-- oportunidades -> empresas, contactos, productos, etapas
alter table public.oportunidades drop constraint if exists oportunidades_empresa_id_fkey;
alter table public.oportunidades add constraint oportunidades_empresa_id_fkey
  foreign key (organizacion_id, empresa_id) references public.empresas (organizacion_id, id)
  on delete set null (empresa_id);
alter table public.oportunidades drop constraint if exists oportunidades_contacto_id_fkey;
alter table public.oportunidades add constraint oportunidades_contacto_id_fkey
  foreign key (organizacion_id, contacto_id) references public.contactos (organizacion_id, id)
  on delete set null (contacto_id);
alter table public.oportunidades drop constraint if exists oportunidades_producto_id_fkey;
alter table public.oportunidades add constraint oportunidades_producto_id_fkey
  foreign key (organizacion_id, producto_id) references public.productos (organizacion_id, id)
  on delete set null (producto_id);
alter table public.oportunidades drop constraint if exists oportunidades_etapa_id_fkey;
alter table public.oportunidades add constraint oportunidades_etapa_id_fkey
  foreign key (organizacion_id, etapa_id) references public.etapas (organizacion_id, id);

-- ventas -> empresas, contactos, oportunidades
alter table public.ventas drop constraint if exists ventas_empresa_id_fkey;
alter table public.ventas add constraint ventas_empresa_id_fkey
  foreign key (organizacion_id, empresa_id) references public.empresas (organizacion_id, id)
  on delete cascade;
alter table public.ventas drop constraint if exists ventas_contacto_id_fkey;
alter table public.ventas add constraint ventas_contacto_id_fkey
  foreign key (organizacion_id, contacto_id) references public.contactos (organizacion_id, id)
  on delete set null (contacto_id);
alter table public.ventas drop constraint if exists ventas_oportunidad_id_fkey;
alter table public.ventas add constraint ventas_oportunidad_id_fkey
  foreign key (organizacion_id, oportunidad_id) references public.oportunidades (organizacion_id, id)
  on delete set null (oportunidad_id);

-- venta_items -> ventas, productos
alter table public.venta_items drop constraint if exists venta_items_venta_id_fkey;
alter table public.venta_items add constraint venta_items_venta_id_fkey
  foreign key (organizacion_id, venta_id) references public.ventas (organizacion_id, id)
  on delete cascade;
alter table public.venta_items drop constraint if exists venta_items_producto_id_fkey;
alter table public.venta_items add constraint venta_items_producto_id_fkey
  foreign key (organizacion_id, producto_id) references public.productos (organizacion_id, id)
  on delete restrict;

-- bitacora -> empresas, contactos
alter table public.bitacora_entradas drop constraint if exists bitacora_entradas_empresa_id_fkey;
alter table public.bitacora_entradas add constraint bitacora_entradas_empresa_id_fkey
  foreign key (organizacion_id, empresa_id) references public.empresas (organizacion_id, id)
  on delete cascade;
alter table public.bitacora_entradas drop constraint if exists bitacora_entradas_contacto_id_fkey;
alter table public.bitacora_entradas add constraint bitacora_entradas_contacto_id_fkey
  foreign key (organizacion_id, contacto_id) references public.contactos (organizacion_id, id)
  on delete set null (contacto_id);

-- alertas_enviadas -> venta_items
alter table public.alertas_enviadas drop constraint if exists alertas_enviadas_venta_item_id_fkey;
alter table public.alertas_enviadas add constraint alertas_enviadas_venta_item_id_fkey
  foreign key (organizacion_id, venta_item_id) references public.venta_items (organizacion_id, id)
  on delete cascade;

-- ============================================================
-- 7. ALTA DE USUARIOS
--
-- La organizacion y el rol se leen de raw_APP_meta_data, que SOLO puede
-- escribir el servidor con la service_role key. NUNCA de raw_user_meta_data:
-- esa la puede editar el propio usuario desde el navegador, y leer el tenant
-- de ahi es el agujero clasico de los multitenant hechos a mano (un usuario se
-- cambia la organizacion y entra a la de otro cliente).
--
-- es_superadmin nunca se toma de ningun metadato: solo se asigna por SQL.
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_org uuid := nullif(new.raw_app_meta_data ->> 'organizacion_id', '')::uuid;
  v_rol text := coalesce(nullif(new.raw_app_meta_data ->> 'rol', ''), 'usuario');
begin
  if v_rol not in ('admin', 'usuario') then
    v_rol := 'usuario';
  end if;

  -- Sin organizacion no se crea el perfil: el check perfiles_org_o_superadmin
  -- lo rechazaria y haria fallar el alta en Auth. El servidor igual completa
  -- el perfil despues de crear el usuario (ver src/lib/cuentas.ts).
  if v_org is not null then
    insert into public.perfiles (id, nombre, email, organizacion_id, rol)
    values (new.id, coalesce(new.raw_user_meta_data ->> 'nombre', new.email), new.email, v_org, v_rol)
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

-- Toda organizacion nueva arranca con las etapas del embudo por defecto.
create or replace function public.organizacion_etapas_iniciales()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
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

drop trigger if exists organizaciones_etapas_iniciales on public.organizaciones;
create trigger organizaciones_etapas_iniciales
  after insert on public.organizaciones
  for each row execute procedure public.organizacion_etapas_iniciales();

-- ============================================================
-- 8. REGISTRO DE MAILS DE CUENTA (limite de envios)
--
-- Activacion y recuperacion de contraseña se piden desde pantallas PUBLICAS.
-- Sin limite, cualquiera podria usarlas para bombardear una casilla ajena y
-- quemar el cupo diario de Gmail. El servidor consulta esta tabla antes de
-- mandar. Sin politicas: solo la toca el servidor con la service_role key.
-- ============================================================
create table if not exists public.envios_auth (
  id bigint generated always as identity primary key,
  email text not null,
  tipo text not null check (tipo in ('activacion', 'recuperacion')),
  created_at timestamptz not null default now()
);
create index if not exists envios_auth_email_idx on public.envios_auth (lower(email), created_at desc);
alter table public.envios_auth enable row level security;

-- ============================================================
-- 9. RLS
--
-- Primero se BORRAN TODAS las politicas existentes de estas tablas. Es
-- critico: las politicas de Postgres se combinan con OR, asi que una sola
-- politica vieja `using (true)` que quedara viva anularia todo el aislamiento
-- sin que nada lo avise.
-- ============================================================
do $$
declare
  r record;
begin
  for r in
    select policyname, tablename from pg_policies
    where schemaname = 'public' and tablename in (
      'perfiles', 'organizaciones', 'empresas', 'contactos', 'productos', 'etapas',
      'oportunidades', 'ventas', 'venta_items', 'bitacora_entradas', 'alertas_enviadas'
    )
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

alter table public.organizaciones enable row level security;

-- Datos comerciales: cada uno, solo lo suyo. `(select ...)` hace que Postgres
-- evalue la funcion una vez por consulta y no una vez por fila.
do $$
declare
  t text;
begin
  foreach t in array array[
    'empresas', 'contactos', 'productos', 'oportunidades',
    'ventas', 'venta_items', 'bitacora_entradas', 'alertas_enviadas'
  ] loop
    execute format(
      'create policy "tenant: solo la propia organizacion" on public.%I for all to authenticated
         using (organizacion_id = (select public.org_actual()))
         with check (organizacion_id = (select public.org_actual()))', t);
  end loop;
end $$;

-- Etapas: solo lectura desde la app (se crean con la organizacion).
create policy "tenant: leer etapas propias" on public.etapas
  for select to authenticated
  using (organizacion_id = (select public.org_actual()));

-- Perfiles: se ve a uno mismo y a los de su organizacion; el superadmin, a
-- todos (para administrar usuarios). NO hay politica de insert/update/delete:
-- un usuario no puede tocar ni su propio rol ni su organizacion. Esos cambios
-- los hace solo el servidor, con la service_role key y despues de verificar
-- permisos.
create policy "perfiles: propios, de la organizacion o superadmin" on public.perfiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or organizacion_id = (select public.org_actual())
    or (select public.es_superadmin())
  );

-- Organizaciones: cada uno ve la suya; el superadmin, todas.
create policy "organizaciones: la propia o superadmin" on public.organizaciones
  for select to authenticated
  using (id = (select public.org_actual()) or (select public.es_superadmin()));

create policy "organizaciones: el superadmin administra" on public.organizaciones
  for all to authenticated
  using ((select public.es_superadmin()))
  with check ((select public.es_superadmin()));

commit;
