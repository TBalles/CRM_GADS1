-- Tuco & Nito - ORGANIZACION DE PRUEBAS E2E
--
-- Crea la organizacion "E2E Tuco & Nito" con dos cuentas (Administrador y Vendedor) y los datos
-- minimos que necesitan las pruebas de extremo a extremo de Playwright (carpeta e2e/, F6):
-- 12 empresas para probar paginacion y cartera propia, un contacto, un par de productos y una
-- oportunidad con la que se prueba la hoja del presupuesto.
--
-- NO ES LA DEMO. Las pruebas E2E crean y mueven registros reales; por eso corren contra esta
-- organizacion aparte y nunca contra "Catedra UNLaM (demo)". El CRM no borra nada (baja logica),
-- asi que cada corrida deja empresas y oportunidades "E2E <hora>" en esta organizacion; son
-- inofensivas y no se mezclan con ninguna otra.
--
-- COMO CORRERLO
--   1. ANTES de pegarlo, cambia la contrasena en el bloque "CONFIGURACION" de abajo (una sola linea):
--      elegi una clave larga y propia. El archivo es publico y NO trae una clave real: si la dejas
--      como esta ('CAMBIAR-ANTES-DE-EJECUTAR') el script se corta con un error y no crea nada.
--   2. Guarda esa misma clave como secreto E2E_PASSWORD y E2E_PASSWORD_VENDEDOR (ver docs/pruebas.md).
--   3. Pegar TODO el archivo en el SQL Editor de Supabase y ejecutar, UNA vez por proyecto.
--   Requiere 0001 a 0007 aplicadas (y la 0012 si se quiere probar el guardado de presupuestos).
--   Es RE-EJECUTABLE: las filas tienen id fijo y no se duplican.
--   Para borrar todo:
--     delete from public.organizaciones where id = '22222222-2222-2222-2222-222222222222';
--     delete from auth.users where email like '%@e2e.tuconito.com.ar';
--
-- CUENTAS (las dos con la contrasena que elegiste en el bloque CONFIGURACION)
--   e2e.admin@e2e.tuconito.com.ar     -> Administrador (todo, incluida Configuracion)
--   e2e.vendedor@e2e.tuconito.com.ar  -> Vendedor      (SOLO su cartera: E2E Club 07 a 12)
--
-- VARIABLES PARA CORRER LAS PRUEBAS (ver docs/pruebas.md)
--   E2E_EMAIL=e2e.admin@e2e.tuconito.com.ar               E2E_PASSWORD=<tu clave>
--   E2E_EMAIL_VENDEDOR=e2e.vendedor@e2e.tuconito.com.ar   E2E_PASSWORD_VENDEDOR=<tu clave>
--
-- Lo que las pruebas esperan encontrar (e2e/helpers.ts -> SEED):
--   - empresas "E2E Club 01" a "E2E Club 12"; del 01 al 06 son del Administrador y del 07 al 12
--     del Vendedor (el Administrador ve 12, el Vendedor 6);
--   - la oportunidad e2e0b1b1-0000-0000-0000-000000000001 (valor estimado $50.000, sin producto);
--   - el proveedor "E2E Equipamiento Deportivo SRL", Responsable Inscripto (el presupuesto
--     discrimina IVA 21 %).

begin;

set local search_path = public, extensions;

-- ============================================================
-- CONFIGURACION: lo unico que hay que editar
--
-- El repositorio es publico: la contrasena NO puede estar escrita aca. Reemplaza el valor de 'clave'
-- por una clave propia (12 caracteres o mas) antes de ejecutar. Los correos tienen que terminar en el
-- dominio de pruebas @e2e.tuconito.com.ar (asi el "borrar todo" de arriba alcanza a todos y nunca se
-- crea una cuenta con un correo real por error).
-- ============================================================
create temp table _e2e_cfg on commit drop as
select
  'CAMBIAR-ANTES-DE-EJECUTAR'::text            as clave,
  'e2e.admin@e2e.tuconito.com.ar'::text         as email_admin,
  'e2e.vendedor@e2e.tuconito.com.ar'::text      as email_vendedor;

do $$
declare
  c record;
begin
  select * into c from _e2e_cfg;
  if c.clave = 'CAMBIAR-ANTES-DE-EJECUTAR' then
    raise exception 'Antes de ejecutar este seed cambia la contrasena en el bloque CONFIGURACION (clave). No se creo nada.';
  end if;
  if char_length(c.clave) < 12 then
    raise exception 'La contrasena de las cuentas E2E tiene que tener al menos 12 caracteres. No se creo nada.';
  end if;
  if c.email_admin !~ '@e2e\.tuconito\.com\.ar$' or c.email_vendedor !~ '@e2e\.tuconito\.com\.ar$' then
    raise exception 'Los correos de las cuentas E2E tienen que terminar en @e2e.tuconito.com.ar. No se creo nada.';
  end if;
end $$;

-- ============================================================
-- 1. LA ORGANIZACION
--
-- El trigger organizaciones_inicial (0007) le crea solos los cuatro roles, las seis etapas del
-- embudo y los catalogos. Lo que sigue es la red de seguridad si ya existia sin ellos.
-- ============================================================
insert into public.organizaciones (id, nombre, activa) values
  ('22222222-2222-2222-2222-222222222222', 'E2E Tuco & Nito', true)
on conflict (id) do nothing;

select public.crear_roles_iniciales('22222222-2222-2222-2222-222222222222');
select public.crear_catalogos_iniciales('22222222-2222-2222-2222-222222222222');

insert into public.etapas (organizacion_id, nombre, orden, color, tipo) values
  ('22222222-2222-2222-2222-222222222222', 'Consulta recibida',      1, '#94a3b8', 'abierta'),
  ('22222222-2222-2222-2222-222222222222', 'Relevamiento de cancha', 2, '#60a5fa', 'abierta'),
  ('22222222-2222-2222-2222-222222222222', 'Presupuesto enviado',    3, '#fbbf24', 'abierta'),
  ('22222222-2222-2222-2222-222222222222', 'Negociación',            4, '#fb923c', 'abierta'),
  ('22222222-2222-2222-2222-222222222222', 'Entregado',              5, '#4ade80', 'ganada'),
  ('22222222-2222-2222-2222-222222222222', 'Perdida',                6, '#f87171', 'perdida')
on conflict (organizacion_id, orden) do nothing;

-- Datos del proveedor: lo que sale en el encabezado del presupuesto.
update public.organizaciones set
  razon_social = 'E2E Equipamiento Deportivo SRL',
  cuit = '30-00000000-0',
  condicion_iva = 'responsable_inscripto',
  direccion = 'Calle de Prueba 123, Morón',
  telefono = '11 5555-0000',
  email = 'ventas@e2e.tuconito.com.ar',
  presupuesto_validez_dias = 15,
  presupuesto_condiciones = 'Precios netos en pesos, más IVA. Plazo de entrega a convenir.'
where id = '22222222-2222-2222-2222-222222222222' and razon_social is null;

-- ============================================================
-- 2. LAS DOS CUENTAS (mismo molde que demo_catedra.sql)
-- ============================================================
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
select
  '00000000-0000-0000-0000-000000000000',
  u.id,
  'authenticated',
  'authenticated',
  u.email,
  crypt((select clave from _e2e_cfg), gen_salt('bf')),
  now(),
  jsonb_build_object(
    'provider', 'email',
    'providers', jsonb_build_array('email'),
    'organizacion_id', '22222222-2222-2222-2222-222222222222',
    'rol_id', r.id::text
  ),
  jsonb_build_object('nombre', u.nombre, 'email_verified', true),
  now(), now(), '', '', '', ''
from (values
  ('e2e0a0a0-0000-0000-0000-000000000001'::uuid, (select email_admin from _e2e_cfg),    'E2E · Administrador', 'Administrador'),
  ('e2e0a0a0-0000-0000-0000-000000000002'::uuid, (select email_vendedor from _e2e_cfg), 'E2E · Vendedor',      'Vendedor')
) as u(id, email, nombre, rol)
join public.roles r
  on r.organizacion_id = '22222222-2222-2222-2222-222222222222' and r.nombre = u.rol
where not exists (select 1 from auth.users x where x.email = u.email)
on conflict (id) do nothing;

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(),
  u.id,
  u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true, 'phone_verified', false),
  'email',
  now(), now(), now()
from auth.users u
where u.email like '%@e2e.tuconito.com.ar'
on conflict (provider_id, provider) do nothing;

insert into public.perfiles (id, nombre, email, organizacion_id, rol_id, es_superadmin, activo, activado_at)
select
  u.id, u.nombre, u.email, '22222222-2222-2222-2222-222222222222', r.id, false, true, now()
from (values
  ('e2e0a0a0-0000-0000-0000-000000000001'::uuid, (select email_admin from _e2e_cfg),    'E2E · Administrador', 'Administrador'),
  ('e2e0a0a0-0000-0000-0000-000000000002'::uuid, (select email_vendedor from _e2e_cfg), 'E2E · Vendedor',      'Vendedor')
) as u(id, email, nombre, rol)
join public.roles r
  on r.organizacion_id = '22222222-2222-2222-2222-222222222222' and r.nombre = u.rol
on conflict (id) do update set
  nombre          = excluded.nombre,
  organizacion_id = excluded.organizacion_id,
  rol_id          = excluded.rol_id,
  activo          = true,
  activado_at     = coalesce(perfiles.activado_at, excluded.activado_at);

-- ============================================================
-- 3. PRODUCTOS (para el catalogo del presupuesto)
-- ============================================================
insert into public.productos (id, organizacion_id, nombre, descripcion, marca, precio, categoria, vida_util_meses, activo) values
  ('e2e0d1d1-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'E2E Arco de fútbol 5', 'Arco de prueba', 'E2E', 180000, 'Arcos', 48, true),
  ('e2e0d1d1-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'E2E Red para arco', 'Red de prueba', 'E2E', 32000, 'Redes', 18, true)
on conflict (id) do nothing;

-- ============================================================
-- 4. DOCE EMPRESAS: 01 a 06 del Administrador, 07 a 12 del Vendedor
-- ============================================================
insert into public.empresas (id, organizacion_id, nombre, estado, responsable_id, direccion, email)
select
  ('e2e0e1e1-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid,
  '22222222-2222-2222-2222-222222222222',
  'E2E Club ' || lpad(n::text, 2, '0'),
  'cliente',
  case when n <= 6 then 'e2e0a0a0-0000-0000-0000-000000000001'::uuid else 'e2e0a0a0-0000-0000-0000-000000000002'::uuid end,
  'Calle de Prueba ' || (n * 10),
  'club' || lpad(n::text, 2, '0') || '@e2e.tuconito.com.ar'
from generate_series(1, 12) as n
on conflict (id) do nothing;

insert into public.contactos (id, organizacion_id, empresa_id, nombre, apellido, email, telefono, cargo, estado, responsable_id) values
  ('e2e0c1c1-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'e2e0e1e1-0000-0000-0000-000000000001',
   'Pat', 'Prueba', 'pat@e2e.tuconito.com.ar', '11 5555-1111', 'Presidente', 'cliente', 'e2e0a0a0-0000-0000-0000-000000000001')
on conflict (id) do nothing;

-- ============================================================
-- 5. LA OPORTUNIDAD DEL PRESUPUESTO (id fijo, en la primera etapa)
-- ============================================================
insert into public.oportunidades (id, organizacion_id, titulo, empresa_id, contacto_id, responsable_id, etapa_id, monto, notas)
select
  'e2e0b1b1-0000-0000-0000-000000000001',
  '22222222-2222-2222-2222-222222222222',
  'E2E Oportunidad para el presupuesto',
  'e2e0e1e1-0000-0000-0000-000000000001',
  'e2e0c1c1-0000-0000-0000-000000000001',
  'e2e0a0a0-0000-0000-0000-000000000001',
  e.id,
  50000,
  'Oportunidad fija para probar la hoja del presupuesto. No la muevas de etapa.'
from public.etapas e
where e.organizacion_id = '22222222-2222-2222-2222-222222222222' and e.orden = 1
on conflict (id) do nothing;

commit;

-- ============================================================
-- VERIFICACION (correr aparte): 2 perfiles, 4 roles, 6 etapas, 12 empresas, 1 contacto,
-- 2 productos y al menos 1 oportunidad.
-- ============================================================
-- select 'perfiles' t, count(*) from public.perfiles where organizacion_id = '22222222-2222-2222-2222-222222222222'
-- union all select 'roles',         count(*) from public.roles         where organizacion_id = '22222222-2222-2222-2222-222222222222'
-- union all select 'etapas',        count(*) from public.etapas        where organizacion_id = '22222222-2222-2222-2222-222222222222'
-- union all select 'empresas',      count(*) from public.empresas      where organizacion_id = '22222222-2222-2222-2222-222222222222'
-- union all select 'contactos',     count(*) from public.contactos     where organizacion_id = '22222222-2222-2222-2222-222222222222'
-- union all select 'productos',     count(*) from public.productos     where organizacion_id = '22222222-2222-2222-2222-222222222222'
-- union all select 'oportunidades', count(*) from public.oportunidades where organizacion_id = '22222222-2222-2222-2222-222222222222';
