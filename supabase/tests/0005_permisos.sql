-- Tuco & Nito - PRUEBA DE AISLAMIENTO Y PERMISOS
--
-- Correr en el SQL Editor de Supabase DESPUES de aplicar 0004 y 0005.
--
-- Crea dos organizaciones de prueba (A y B) con usuarios de distintos roles, se
-- hace pasar por cada uno exactamente como lo hace la app (rol `authenticated`
-- + el JWT con su id) e intenta:
--   - ver o tocar datos del OTRO cliente (aislamiento), y
--   - hacer cosas que su ROL no permite (permisos).
--
-- NO DEJA NADA EN LA BASE: todo corre dentro de una transaccion con ROLLBACK.
--
-- Resultado esperado: una fila que dice "TODO OK". Si algo falla, se corta con
-- un ERROR que empieza con "FALLA:" y dice que se pudo hacer que no se deberia.

begin;

-- ── Organizaciones (el trigger les crea roles y etapas) ──────────────────────
insert into public.organizaciones (id, nombre) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'TEST Org A'),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'TEST Org B');

do $$
begin
  if (select count(*) from public.roles where organizacion_id = 'aaaaaaaa-0000-0000-0000-000000000000') <> 4 then
    raise exception 'FALLA: la organizacion nueva no recibio sus 4 roles iniciales';
  end if;
  if (select count(*) from public.etapas where organizacion_id = 'aaaaaaaa-0000-0000-0000-000000000000') <> 6 then
    raise exception 'FALLA: la organizacion nueva no recibio sus 6 etapas iniciales';
  end if;
end $$;

-- ── Usuarios, con el rol en app_metadata como en un alta real ────────────────
--   A-ventas:  rol Ventas de A        A-lectura: rol Solo lectura de A
--   A-admin:   rol Administrador de A B-admin:   rol Administrador de B
--   colado:    pide organizacion y rol por user_metadata (editable por el usuario)
--   cruzado:   organizacion A pero con un rol de B
insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select v.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', v.email,
       jsonb_build_object('organizacion_id', v.org, 'rol_id', (select id from public.roles where organizacion_id = v.rol_org and nombre = v.rol)),
       jsonb_build_object('nombre', v.email), now(), now()
from (values
  ('aaaaaaaa-1111-0000-0000-000000000001'::uuid, 'a.ventas@test.invalid',  'aaaaaaaa-0000-0000-0000-000000000000'::uuid, 'aaaaaaaa-0000-0000-0000-000000000000'::uuid, 'Ventas'),
  ('aaaaaaaa-1111-0000-0000-000000000002'::uuid, 'a.lectura@test.invalid', 'aaaaaaaa-0000-0000-0000-000000000000'::uuid, 'aaaaaaaa-0000-0000-0000-000000000000'::uuid, 'Solo lectura'),
  ('aaaaaaaa-1111-0000-0000-000000000003'::uuid, 'a.admin@test.invalid',   'aaaaaaaa-0000-0000-0000-000000000000'::uuid, 'aaaaaaaa-0000-0000-0000-000000000000'::uuid, 'Administrador'),
  ('bbbbbbbb-1111-0000-0000-000000000001'::uuid, 'b.admin@test.invalid',   'bbbbbbbb-0000-0000-0000-000000000000'::uuid, 'bbbbbbbb-0000-0000-0000-000000000000'::uuid, 'Administrador'),
  ('aaaaaaaa-1111-0000-0000-000000000009'::uuid, 'cruzado@test.invalid',   'aaaaaaaa-0000-0000-0000-000000000000'::uuid, 'bbbbbbbb-0000-0000-0000-000000000000'::uuid, 'Administrador')
) as v(id, email, org, rol_org, rol);

insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('cccccccc-1111-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'colado@test.invalid', '{}',
        '{"organizacion_id":"aaaaaaaa-0000-0000-0000-000000000000"}', now(), now());

do $$
begin
  if exists (select 1 from public.perfiles where id = 'cccccccc-1111-0000-0000-000000000000') then
    raise exception 'FALLA: un usuario obtuvo organizacion desde user_metadata (editable por el propio usuario)';
  end if;
  if (select rol_id from public.perfiles where id = 'aaaaaaaa-1111-0000-0000-000000000009') is not null then
    raise exception 'FALLA: un usuario de A quedo con un rol de la organizacion B';
  end if;
end $$;

-- Datos de prueba (como postgres, sin RLS)
insert into public.empresas (id, organizacion_id, nombre) values
  ('aaaaaaaa-2222-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000000', 'Empresa de A'),
  ('bbbbbbbb-2222-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-000000000000', 'Empresa de B');
insert into public.productos (id, organizacion_id, nombre, vida_util_meses) values
  ('aaaaaaaa-3333-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000000', 'Producto de A', 12),
  ('bbbbbbbb-3333-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-000000000000', 'Producto de B', 12);
insert into public.bitacora_entradas (id, organizacion_id, empresa_id, titulo) values
  ('aaaaaaaa-4444-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-2222-0000-0000-000000000000', 'Entrada original');

-- ══ SOY A-VENTAS ══════════════════════════════════════════════════════════════
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-1111-0000-0000-000000000001","role":"authenticated"}', true);

do $$
declare
  n int;
begin
  -- Aislamiento: solo lo de A.
  if (select count(*) from public.empresas) <> 1 then
    raise exception 'FALLA: A-ventas ve % empresas, deberia ver solo la de A', (select count(*) from public.empresas);
  end if;
  if exists (select 1 from public.productos where organizacion_id = 'bbbbbbbb-0000-0000-0000-000000000000')
     or exists (select 1 from public.etapas where organizacion_id = 'bbbbbbbb-0000-0000-0000-000000000000')
     or exists (select 1 from public.roles where organizacion_id = 'bbbbbbbb-0000-0000-0000-000000000000')
     or exists (select 1 from public.perfiles where organizacion_id = 'bbbbbbbb-0000-0000-0000-000000000000') then
    raise exception 'FALLA: A-ventas ve productos, etapas, roles o usuarios de B';
  end if;
  if (select count(*) from public.organizaciones) <> 1 then
    raise exception 'FALLA: A-ventas ve organizaciones ajenas';
  end if;

  -- Ventas PUEDE: crear clientes (la organizacion la pone la base).
  insert into public.empresas (nombre) values ('Alta de A-ventas');
  if not exists (select 1 from public.empresas where nombre = 'Alta de A-ventas'
                 and organizacion_id = 'aaaaaaaa-0000-0000-0000-000000000000') then
    raise exception 'FALLA: el alta sin organizacion no quedo en la organizacion de A';
  end if;

  -- Tocar filas de B: invisibles, 0 filas.
  update public.empresas set nombre = 'hackeada' where id = 'bbbbbbbb-2222-0000-0000-000000000000';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALLA: A-ventas pudo modificar una empresa de B'; end if;

  -- Ventas NO puede editar el catalogo (sin productos.editar): 0 filas.
  update public.productos set precio = 1 where id = 'aaaaaaaa-3333-0000-0000-000000000000';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALLA: Ventas pudo editar un producto sin productos.editar'; end if;

  -- La bitacora es un registro: nadie la edita ni la borra.
  update public.bitacora_entradas set titulo = 'reescrita' where id = 'aaaaaaaa-4444-0000-0000-000000000000';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALLA: se pudo editar una entrada de bitacora'; end if;
  delete from public.bitacora_entradas where id = 'aaaaaaaa-4444-0000-0000-000000000000';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALLA: se pudo borrar una entrada de bitacora'; end if;

  -- Escalar sobre su propio perfil: no hay politica de update.
  update public.perfiles set es_superadmin = true, rol_id = null
  where id = 'aaaaaaaa-1111-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALLA: un usuario pudo modificar su propio perfil'; end if;

  -- Ventas NO administra roles (sin usuarios.gestionar): 0 filas.
  update public.roles set permisos = array['usuarios.gestionar'] where nombre = 'Ventas';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALLA: Ventas pudo darse permisos editando su rol'; end if;
end $$;

-- Crear un rol: sin usuarios.gestionar, rechazado.
do $$ begin
  begin
    insert into public.roles (nombre, organizacion_id, permisos)
    values ('Autoascenso', 'aaaaaaaa-0000-0000-0000-000000000000', array['usuarios.gestionar']);
    raise exception 'FALLA: Ventas pudo crear un rol sin usuarios.gestionar';
  exception when insufficient_privilege then null;
  end;
end $$;

-- El limite de mails no es invocable por un usuario (solo el servidor).
do $$ begin
  begin
    perform public.registrar_envio_auth('x@test.invalid', 'recuperacion');
    raise exception 'FALLA: un usuario pudo ejecutar registrar_envio_auth';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Crear productos: sin productos.editar, rechazado (42501).
do $$ begin
  begin
    insert into public.productos (nombre) values ('producto colado');
    raise exception 'FALLA: Ventas pudo crear un producto sin productos.editar';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Insertar en la organizacion de B.
do $$ begin
  begin
    insert into public.empresas (organizacion_id, nombre) values ('bbbbbbbb-0000-0000-0000-000000000000', 'colada en B');
    raise exception 'FALLA: A-ventas pudo insertar en la organizacion de B';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Mudar una fila propia a B.
do $$ begin
  begin
    update public.empresas set organizacion_id = 'bbbbbbbb-0000-0000-0000-000000000000'
    where id = 'aaaaaaaa-2222-0000-0000-000000000000';
    raise exception 'FALLA: A-ventas pudo mudar una empresa a la organizacion de B';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Colgar un contacto de una empresa de B: la FK compuesta lo frena (23503).
do $$ begin
  begin
    insert into public.contactos (nombre, empresa_id) values ('colgado de B', 'bbbbbbbb-2222-0000-0000-000000000000');
    raise exception 'FALLA: A-ventas pudo asociar un contacto a una empresa de B';
  exception when foreign_key_violation then null;
  end;
end $$;

-- Vender un producto del catalogo de B.
do $$
declare v uuid;
begin
  insert into public.ventas (empresa_id) values ('aaaaaaaa-2222-0000-0000-000000000000') returning id into v;
  begin
    insert into public.venta_items (venta_id, producto_id) values (v, 'bbbbbbbb-3333-0000-0000-000000000000');
    raise exception 'FALLA: A-ventas pudo vender un producto del catalogo de B';
  exception when foreign_key_violation then null;
  end;
end $$;

-- Crear organizaciones: solo el superadmin.
do $$ begin
  begin
    insert into public.organizaciones (nombre) values ('org colada');
    raise exception 'FALLA: un usuario comun pudo crear una organizacion';
  exception when insufficient_privilege then null;
  end;
end $$;

do $$ begin
  if exists (select 1 from public.envios_auth) then
    raise exception 'FALLA: un usuario puede leer envios_auth';
  end if;
end $$;

-- ══ SOY A-LECTURA ═════════════════════════════════════════════════════════════
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-1111-0000-0000-000000000002","role":"authenticated"}', true);

do $$
declare n int;
begin
  if not exists (select 1 from public.empresas) then
    raise exception 'FALLA: Solo lectura no puede ver clientes';
  end if;
  if exists (select 1 from public.ventas) or exists (select 1 from public.bitacora_entradas) then
    raise exception 'FALLA: Solo lectura ve ventas o bitacora sin permiso';
  end if;
  update public.empresas set nombre = 'x' where id = 'aaaaaaaa-2222-0000-0000-000000000000';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALLA: Solo lectura pudo editar un cliente'; end if;
end $$;

do $$ begin
  begin
    insert into public.empresas (nombre) values ('alta de solo lectura');
    raise exception 'FALLA: Solo lectura pudo crear un cliente';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ══ SOY A-ADMIN ═══════════════════════════════════════════════════════════════
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-1111-0000-0000-000000000003","role":"authenticated"}', true);

do $$
declare n int;
begin
  -- PUEDE crear un rol propio (ej. RRHH)...
  insert into public.roles (nombre, organizacion_id, permisos)
  values ('RRHH', 'aaaaaaaa-0000-0000-0000-000000000000', array['usuarios.gestionar']);

  -- ...y editar los no-administradores...
  update public.roles set descripcion = 'editado' where nombre = 'Ventas';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FALLA: el admin no pudo editar el rol Ventas'; end if;

  -- ...pero NO el rol Administrador.
  update public.roles set permisos = array['clientes.ver'] where es_admin;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALLA: se pudo editar el rol Administrador'; end if;
  delete from public.roles where es_admin;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALLA: se pudo borrar el rol Administrador'; end if;
end $$;

-- Crear otro rol marcado como Administrador: rechazado.
do $$ begin
  begin
    insert into public.roles (nombre, organizacion_id, es_admin) values ('Admin 2', 'aaaaaaaa-0000-0000-0000-000000000000', true);
    raise exception 'FALLA: se pudo crear un segundo rol Administrador';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Un permiso que no existe en el catalogo: el CHECK lo rechaza.
do $$ begin
  begin
    insert into public.roles (nombre, organizacion_id, permisos) values ('Raro', 'aaaaaaaa-0000-0000-0000-000000000000', array['todo.hacer']);
    raise exception 'FALLA: se aceptó un permiso que no existe';
  exception when check_violation then null;
  end;
end $$;

-- Crear un rol en la organizacion de B.
do $$ begin
  begin
    insert into public.roles (nombre, organizacion_id) values ('colado', 'bbbbbbbb-0000-0000-0000-000000000000');
    raise exception 'FALLA: el admin de A pudo crear un rol en B';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ══ SOY B-ADMIN: no ve nada de A ══════════════════════════════════════════════
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-1111-0000-0000-000000000001","role":"authenticated"}', true);

do $$ begin
  if (select count(*) from public.empresas) <> 1
     or not exists (select 1 from public.empresas where id = 'bbbbbbbb-2222-0000-0000-000000000000') then
    raise exception 'FALLA: B-admin no ve exactamente su propia empresa';
  end if;
  if exists (select 1 from public.roles where nombre = 'RRHH') then
    raise exception 'FALLA: B-admin ve un rol creado por A';
  end if;
end $$;

-- ══ BAJAS: usuario desactivado y organizacion suspendida ═════════════════════
reset role;
update public.perfiles set activo = false where id = 'bbbbbbbb-1111-0000-0000-000000000001';
update public.organizaciones set activa = false where id = 'aaaaaaaa-0000-0000-0000-000000000000';
set local role authenticated;

do $$ begin
  if exists (select 1 from public.empresas) then
    raise exception 'FALLA: un usuario dado de baja todavia ve datos';
  end if;
end $$;

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-1111-0000-0000-000000000003","role":"authenticated"}', true);
do $$ begin
  if exists (select 1 from public.empresas) or (select public.tiene_permiso('clientes.ver')) then
    raise exception 'FALLA: el usuario de una organizacion suspendida todavia ve datos';
  end if;
end $$;

-- ══ SUPERADMIN: administra, NO ve datos comerciales de clientes ═══════════════
reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', (select id from public.perfiles where es_superadmin limit 1), 'role', 'authenticated')::text,
  true);

do $$ begin
  if (select count(*) from public.organizaciones) < 3 then
    raise exception 'FALLA: el superadmin no ve todas las organizaciones';
  end if;
  if exists (select 1 from public.empresas where organizacion_id in (
    'aaaaaaaa-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-000000000000')) then
    raise exception 'FALLA: el superadmin ve datos comerciales de otros clientes';
  end if;
end $$;

-- ══ SIN SESION ════════════════════════════════════════════════════════════════
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

do $$ begin
  if exists (select 1 from public.empresas) or exists (select 1 from public.organizaciones)
     or exists (select 1 from public.perfiles) or exists (select 1 from public.roles) then
    raise exception 'FALLA: un visitante sin sesion ve datos';
  end if;
end $$;

reset role;
rollback;

-- Solo se llega hasta aca si ninguna prueba corto con "FALLA:". Va despues del
-- rollback porque el SQL Editor muestra el resultado de la ULTIMA sentencia.
select 'TODO OK: aislamiento y permisos verificados. Nada quedo guardado (rollback).' as resultado;
