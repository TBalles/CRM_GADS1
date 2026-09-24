-- Tuco & Nito - DEMO PARA LA CATEDRA
--
-- Crea una organizacion cliente ("Cátedra UNLaM (demo)") con cuatro cuentas,
-- una por cada rol por defecto, y la carga con datos en TODOS los modulos:
-- clientes, contactos, bitacora, productos, oportunidades, ventas y alertas.
--
-- COMO CORRERLO
--   Pegar TODO el archivo en el SQL Editor de Supabase y ejecutar.
--   Requiere 0001 a 0006 aplicadas.
--
-- ES RE-EJECUTABLE: todas las filas tienen id fijo y usan ON CONFLICT DO
-- NOTHING, asi que correrlo dos veces no duplica nada. Para borrar la demo
-- entera alcanza con:
--     delete from public.organizaciones where id = '11111111-1111-1111-1111-111111111111';
--     delete from auth.users where email like '%@demo.tuconito.com.ar';
--
-- CUENTAS (contraseña unica para las cuatro: Catedra.2026)
--   administrador@demo.tuconito.com.ar  -> Administrador  (todo + usuarios y roles)
--   ventas@demo.tuconito.com.ar         -> Ventas         (todo el CRM, sin usuarios)
--   corporativo@demo.tuconito.com.ar    -> Corporativo    (ve todo, no modifica)
--   lectura@demo.tuconito.com.ar        -> Solo lectura   (clientes y catalogo)
--
-- Las fechas se calculan contra current_date: las alertas de vida util quedan
-- bien sin importar el dia en que se ejecute.

begin;

-- crypt()/gen_salt() viven en `extensions` en los proyectos de Supabase y en
-- `public` si pgcrypto se instalo a mano. Con las dos en el search_path anda
-- en los dos casos.
set local search_path = public, extensions;

-- ============================================================
-- 1. LA ORGANIZACION
--
-- El trigger organizaciones_inicial (0005) le crea solos los cuatro roles y
-- las seis etapas del embudo. Las dos sentencias que siguen son la red de
-- seguridad para el caso de que la organizacion ya existiera sin ellos.
-- ============================================================
insert into public.organizaciones (id, nombre, activa) values
  ('11111111-1111-1111-1111-111111111111', 'Cátedra UNLaM (demo)', true)
on conflict (id) do nothing;

select public.crear_roles_iniciales('11111111-1111-1111-1111-111111111111');

insert into public.etapas (organizacion_id, nombre, orden, color) values
  ('11111111-1111-1111-1111-111111111111', 'Nuevo', 1, '#94a3b8'),
  ('11111111-1111-1111-1111-111111111111', 'Calificación', 2, '#60a5fa'),
  ('11111111-1111-1111-1111-111111111111', 'Propuesta Enviada', 3, '#fbbf24'),
  ('11111111-1111-1111-1111-111111111111', 'Negociación', 4, '#fb923c'),
  ('11111111-1111-1111-1111-111111111111', 'Ganada', 5, '#4ade80'),
  ('11111111-1111-1111-1111-111111111111', 'Perdida', 6, '#f87171')
on conflict (organizacion_id, orden) do nothing;

-- ============================================================
-- 2. LAS CUATRO CUENTAS
--
-- Se insertan directo en auth.users con la contraseña ya hasheada (bcrypt, el
-- mismo algoritmo que usa GoTrue) y el mail confirmado, asi las cuentas
-- ingresan sin mandar ninguna invitacion.
--
-- organizacion_id y rol_id van en raw_APP_meta_data, nunca en
-- raw_user_meta_data: el trigger handle_new_user (0005) los lee de ahi, y esa
-- columna solo la puede escribir el servidor.
--
-- Los cuatro campos de token se ponen en '' y no en NULL: GoTrue los lee como
-- string y con NULL falla al comparar.
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
  crypt('Catedra.2026', gen_salt('bf')),
  now(),
  jsonb_build_object(
    'provider', 'email',
    'providers', jsonb_build_array('email'),
    'organizacion_id', '11111111-1111-1111-1111-111111111111',
    'rol_id', r.id::text
  ),
  jsonb_build_object('nombre', u.nombre, 'email_verified', true),
  now(), now(), '', '', '', ''
from (values
  ('a0a0a0a0-0000-0000-0000-000000000001'::uuid, 'administrador@demo.tuconito.com.ar', 'Demo · Administrador', 'Administrador'),
  ('a0a0a0a0-0000-0000-0000-000000000002'::uuid, 'ventas@demo.tuconito.com.ar',        'Demo · Ventas',        'Ventas'),
  ('a0a0a0a0-0000-0000-0000-000000000003'::uuid, 'corporativo@demo.tuconito.com.ar',   'Demo · Corporativo',   'Corporativo'),
  ('a0a0a0a0-0000-0000-0000-000000000004'::uuid, 'lectura@demo.tuconito.com.ar',       'Demo · Solo lectura',  'Solo lectura')
) as u(id, email, nombre, rol)
join public.roles r
  on r.organizacion_id = '11111111-1111-1111-1111-111111111111' and r.nombre = u.rol
where not exists (select 1 from auth.users x where x.email = u.email)
on conflict (id) do nothing;

-- Identidad de tipo email. Sin esta fila, GoTrue acepta la contraseña pero
-- despues no encuentra el proveedor del usuario.
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
where u.email like '%@demo.tuconito.com.ar'
on conflict (provider_id, provider) do nothing;

-- El perfil ya lo creo el trigger; esto fija nombre, rol y el activado_at (la
-- app lo usa para distinguir "invitacion pendiente" de cuenta activa) y deja
-- la sentencia idempotente.
insert into public.perfiles (id, nombre, email, organizacion_id, rol_id, es_superadmin, activo, activado_at)
select
  u.id, u.nombre, u.email, '11111111-1111-1111-1111-111111111111', r.id, false, true, now()
from (values
  ('a0a0a0a0-0000-0000-0000-000000000001'::uuid, 'administrador@demo.tuconito.com.ar', 'Demo · Administrador', 'Administrador'),
  ('a0a0a0a0-0000-0000-0000-000000000002'::uuid, 'ventas@demo.tuconito.com.ar',        'Demo · Ventas',        'Ventas'),
  ('a0a0a0a0-0000-0000-0000-000000000003'::uuid, 'corporativo@demo.tuconito.com.ar',   'Demo · Corporativo',   'Corporativo'),
  ('a0a0a0a0-0000-0000-0000-000000000004'::uuid, 'lectura@demo.tuconito.com.ar',       'Demo · Solo lectura',  'Solo lectura')
) as u(id, email, nombre, rol)
join public.roles r
  on r.organizacion_id = '11111111-1111-1111-1111-111111111111' and r.nombre = u.rol
on conflict (id) do update set
  nombre          = excluded.nombre,
  organizacion_id = excluded.organizacion_id,
  rol_id          = excluded.rol_id,
  activo          = true,
  activado_at     = coalesce(perfiles.activado_at, excluded.activado_at);

-- ============================================================
-- 3. PRODUCTOS
--
-- vida_util_meses es el dato del que sale toda la seccion de alertas. El kit
-- de mantenimiento va en null a proposito: muestra un producto sin seguimiento
-- de recambio.
-- ============================================================
insert into public.productos (id, organizacion_id, nombre, descripcion, marca, precio, categoria, vida_util_meses, activo) values
  ('d1d1d1d1-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Arco de fútbol 11 (7.32 x 2.44 m)', 'Arco reglamentario de caño estructural, con ganchos para red', 'Tuco & Nito', 450000, 'Arcos', 60, true),
  ('d1d1d1d1-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Arco de fútbol 5/7', 'Arco para fútbol reducido, aluminio reforzado', 'Tuco & Nito', 180000, 'Arcos', 48, true),
  ('d1d1d1d1-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Red para arco de fútbol 11', 'Red de nylon reforzada, juego x 2 unidades', 'Redex', 65000, 'Redes', 18, true),
  ('d1d1d1d1-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'Red para arco de fútbol 5/7', 'Red de nylon, juego x 2 unidades', 'Redex', 32000, 'Redes', 18, true),
  ('d1d1d1d1-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'Set de conos de entrenamiento x 50', 'Conos de PVC 23 cm, colores surtidos', 'Drb', 28000, 'Entrenamiento', 24, true),
  ('d1d1d1d1-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', 'Vallas de entrenamiento (juego x 6)', 'Vallas plegables regulables en altura', 'Drb', 45000, 'Entrenamiento', 36, true),
  ('d1d1d1d1-0000-0000-0000-000000000007', '11111111-1111-1111-1111-111111111111', 'Escalera y aros de agilidad', 'Kit de velocidad y coordinación', 'Drb', 22000, 'Entrenamiento', 24, true),
  ('d1d1d1d1-0000-0000-0000-000000000008', '11111111-1111-1111-1111-111111111111', 'Pecheras de entrenamiento x 15 (juego)', 'Pecheras de malla, talles adulto', 'Kapho', 38000, 'Indumentaria', 12, true),
  ('d1d1d1d1-0000-0000-0000-000000000009', '11111111-1111-1111-1111-111111111111', 'Pelota de fútbol N°5 (unidad)', 'Pelota reglamentaria cosida a máquina', 'Penalty', 15000, 'Pelotas', 12, true),
  ('d1d1d1d1-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', 'Pelota de fútbol N°4 (unidad)', 'Pelota para fútbol infantil y juvenil', 'Penalty', 12000, 'Pelotas', 12, true),
  ('d1d1d1d1-0000-0000-0000-00000000000b', '11111111-1111-1111-1111-111111111111', 'Banderines de córner (juego x 4)', 'Banderines reglamentarios con base flexible', 'Tuco & Nito', 9000, 'Accesorios', 24, true),
  ('d1d1d1d1-0000-0000-0000-00000000000c', '11111111-1111-1111-1111-111111111111', 'Kit de mantenimiento de cancha', 'Rastrillo, marcador de líneas y accesorios', 'Tuco & Nito', 95000, 'Mantenimiento', null, true),
  ('d1d1d1d1-0000-0000-0000-00000000000d', '11111111-1111-1111-1111-111111111111', 'Tablero electrónico de tanteo', 'Tablero LED con control remoto, discontinuado', 'Scorex', 320000, 'Accesorios', 60, false)
on conflict (id) do nothing;

-- ============================================================
-- 4. CLIENTES (empresas) Y CONTACTOS
-- ============================================================
insert into public.empresas (id, organizacion_id, nombre, cuit, telefono, email, direccion, notas, created_at) values
  ('e1e1e1e1-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Club Atlético San Justo', '30-71234567-9', '11 4482-1100', 'contacto@casanjusto.com.ar', 'Av. Juan Manuel de Rosas 1200, San Justo', 'Cliente desde 2023. Compra por licitación interna: siempre pide tres presupuestos.', now() - interval '22 months'),
  ('e1e1e1e1-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Complejo Fútbol 5 La Tablada', '30-70998877-4', '11 4651-8020', 'reservas@f5latablada.com.ar', 'Cristianía 430, La Tablada', 'Seis canchas de sintético. Renueva pelotas todos los años.', now() - interval '14 months'),
  ('e1e1e1e1-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Escuela de Fútbol Infantil Ramos Mejía', '30-71555321-0', '11 4654-3311', 'info@efiramos.com.ar', 'Av. de Mayo 890, Ramos Mejía', 'Categorías 2012 a 2019. Compra grande antes de que arranque el torneo.', now() - interval '15 months'),
  ('e1e1e1e1-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'Club Deportivo Morón', '30-68112233-7', '11 4483-7744', 'administracion@cdmoron.org.ar', 'Yrigoyen 2050, Morón', 'Tiene predio propio con cinco canchas. El pago sale por tesorería, tarda 30 días.', now() - interval '25 months'),
  ('e1e1e1e1-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'Predio Municipal de Isidro Casanova', '30-99887766-1', '11 4620-5500', 'deportes@lamatanza.gob.ar', 'Av. Cristianía 1500, Isidro Casanova', 'Compra por expediente municipal. Requiere factura A y remito conformado.', now() - interval '4 months'),
  ('e1e1e1e1-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', 'Colegio San Juan Bautista', '30-63445566-2', '11 4657-9090', 'secretaria@sjb.edu.ar', 'Rivadavia 745, Villa Luzuriaga', 'Educación física de primaria y secundaria. Presupuesto anual cerrado en marzo.', now() - interval '8 months')
on conflict (id) do nothing;

-- El ultimo contacto va sin empresa a proposito: la pantalla de clientes y el
-- formulario de oportunidades tienen que saber mostrarlo igual.
insert into public.contactos (id, organizacion_id, empresa_id, nombre, apellido, email, telefono, cargo, notas, created_at) values
  ('c1c1c1c1-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'e1e1e1e1-0000-0000-0000-000000000001', 'Martín', 'Gutiérrez', 'mgutierrez@casanjusto.com.ar', '11 6234-1100', 'Presidente', 'Decide las compras grandes. Contestar por mail, no atiende el teléfono.', now() - interval '22 months'),
  ('c1c1c1c1-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'e1e1e1e1-0000-0000-0000-000000000001', 'Laura', 'Benítez', 'tesoreria@casanjusto.com.ar', '11 6234-1101', 'Tesorera', 'Maneja los pagos y los plazos.', now() - interval '21 months'),
  ('c1c1c1c1-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'e1e1e1e1-0000-0000-0000-000000000002', 'Diego', 'Sosa', 'diego@f5latablada.com.ar', '11 5588-2030', 'Dueño', 'Responde rápido por WhatsApp.', now() - interval '14 months'),
  ('c1c1c1c1-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'e1e1e1e1-0000-0000-0000-000000000003', 'Carolina', 'Ferreyra', 'carolina@efiramos.com.ar', '11 6712-4455', 'Coordinadora general', 'Pide todo con factura a nombre de la escuela.', now() - interval '15 months'),
  ('c1c1c1c1-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'e1e1e1e1-0000-0000-0000-000000000004', 'Javier', 'Molina', 'jmolina@cdmoron.org.ar', '11 6099-7744', 'Jefe de mantenimiento', 'Es el que avisa cuando algo se rompe. Muy buen contacto técnico.', now() - interval '25 months'),
  ('c1c1c1c1-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', 'e1e1e1e1-0000-0000-0000-000000000004', 'Silvina', 'Rojas', 'compras@cdmoron.org.ar', '11 6099-7745', 'Compras', 'Necesita la orden de compra firmada antes de cada entrega.', now() - interval '20 months'),
  ('c1c1c1c1-0000-0000-0000-000000000007', '11111111-1111-1111-1111-111111111111', 'e1e1e1e1-0000-0000-0000-000000000005', 'Hernán', 'Costa', 'hcosta@lamatanza.gob.ar', '11 6720-5500', 'Encargado del predio', 'Coordina las entregas de lunes a viernes de 8 a 14.', now() - interval '4 months'),
  ('c1c1c1c1-0000-0000-0000-000000000008', '11111111-1111-1111-1111-111111111111', 'e1e1e1e1-0000-0000-0000-000000000006', 'Mariela', 'Paz', 'mpaz@sjb.edu.ar', '11 6455-9090', 'Regente', 'Aprueba el gasto junto con la dirección.', now() - interval '8 months'),
  ('c1c1c1c1-0000-0000-0000-000000000009', '11111111-1111-1111-1111-111111111111', null, 'Nicolás', 'Ibarra', 'nicoibarra.ef@gmail.com', '11 6388-1212', 'Profesor de educación física', 'Referido de Javier Molina. Todavía no está asociado a ninguna institución.', now() - interval '2 months')
on conflict (id) do nothing;

-- ============================================================
-- 5. OPORTUNIDADES
--
-- Diez oportunidades repartidas en las seis etapas del embudo, para que el
-- tablero y el arrastre entre columnas se vean con datos reales.
-- ============================================================
insert into public.oportunidades (id, organizacion_id, titulo, empresa_id, contacto_id, producto_id, responsable_id, etapa_id, monto, notas, created_at)
select
  o.id, '11111111-1111-1111-1111-111111111111', o.titulo, o.empresa_id, o.contacto_id,
  o.producto_id, o.responsable_id, e.id, o.monto, o.notas, o.created_at
from (values
  ('b1b1b1b1-0000-0000-0000-000000000001'::uuid, 'Recambio de redes de fútbol 11',
   'e1e1e1e1-0000-0000-0000-000000000001'::uuid, 'c1c1c1c1-0000-0000-0000-000000000001'::uuid,
   'd1d1d1d1-0000-0000-0000-000000000003'::uuid, 'a0a0a0a0-0000-0000-0000-000000000002'::uuid,
   4, 130000::numeric, 'Las redes que compraron hace 20 meses ya vencieron. Piden dos juegos.', now() - interval '9 days'),

  ('b1b1b1b1-0000-0000-0000-000000000002'::uuid, 'Pelotas N°5 para la temporada',
   'e1e1e1e1-0000-0000-0000-000000000002'::uuid, 'c1c1c1c1-0000-0000-0000-000000000003'::uuid,
   'd1d1d1d1-0000-0000-0000-000000000009'::uuid, 'a0a0a0a0-0000-0000-0000-000000000002'::uuid,
   3, 180000::numeric, 'Presupuesto por 12 unidades enviado por WhatsApp. Compara con otro proveedor.', now() - interval '6 days'),

  ('b1b1b1b1-0000-0000-0000-000000000003'::uuid, 'Dos arcos de fútbol 5 para la cancha nueva',
   'e1e1e1e1-0000-0000-0000-000000000002'::uuid, 'c1c1c1c1-0000-0000-0000-000000000003'::uuid,
   'd1d1d1d1-0000-0000-0000-000000000002'::uuid, 'a0a0a0a0-0000-0000-0000-000000000001'::uuid,
   2, 360000::numeric, 'Está terminando la obra de la cancha 7. Volver a llamar la semana que viene.', now() - interval '18 days'),

  ('b1b1b1b1-0000-0000-0000-000000000004'::uuid, 'Kit de entrenamiento para categorías infantiles',
   'e1e1e1e1-0000-0000-0000-000000000003'::uuid, 'c1c1c1c1-0000-0000-0000-000000000004'::uuid,
   'd1d1d1d1-0000-0000-0000-000000000007'::uuid, 'a0a0a0a0-0000-0000-0000-000000000002'::uuid,
   5, 154000::numeric, 'Cerrada. Entrega coordinada con la coordinadora para el inicio del torneo.', now() - interval '35 days'),

  ('b1b1b1b1-0000-0000-0000-000000000005'::uuid, 'Pecheras de recambio x 4 juegos',
   'e1e1e1e1-0000-0000-0000-000000000003'::uuid, 'c1c1c1c1-0000-0000-0000-000000000004'::uuid,
   'd1d1d1d1-0000-0000-0000-000000000008'::uuid, 'a0a0a0a0-0000-0000-0000-000000000002'::uuid,
   1, 152000::numeric, 'Entró por el aviso automático de vida útil: las de hace un año ya vencieron.', now() - interval '2 days'),

  ('b1b1b1b1-0000-0000-0000-000000000006'::uuid, 'Renovación de conos y vallas del predio',
   'e1e1e1e1-0000-0000-0000-000000000004'::uuid, 'c1c1c1c1-0000-0000-0000-000000000005'::uuid,
   'd1d1d1d1-0000-0000-0000-000000000005'::uuid, 'a0a0a0a0-0000-0000-0000-000000000001'::uuid,
   4, 101000::numeric, 'Javier ya lo pidió por mantenimiento; falta la orden de compra de Silvina.', now() - interval '12 days'),

  ('b1b1b1b1-0000-0000-0000-000000000007'::uuid, 'Tablero electrónico para la cancha principal',
   'e1e1e1e1-0000-0000-0000-000000000004'::uuid, 'c1c1c1c1-0000-0000-0000-000000000006'::uuid,
   'd1d1d1d1-0000-0000-0000-00000000000d'::uuid, 'a0a0a0a0-0000-0000-0000-000000000001'::uuid,
   6, 320000::numeric, 'Perdida: el proveedor discontinuó el modelo y no llegamos con el plazo.', now() - interval '60 days'),

  ('b1b1b1b1-0000-0000-0000-000000000008'::uuid, 'Licitación: equipamiento completo del predio',
   'e1e1e1e1-0000-0000-0000-000000000005'::uuid, 'c1c1c1c1-0000-0000-0000-000000000007'::uuid,
   'd1d1d1d1-0000-0000-0000-000000000001'::uuid, 'a0a0a0a0-0000-0000-0000-000000000001'::uuid,
   3, 1850000::numeric, 'Pliego presentado por expediente. La apertura de sobres es el mes que viene.', now() - interval '21 days'),

  ('b1b1b1b1-0000-0000-0000-000000000009'::uuid, 'Pelotas N°4 para educación física',
   'e1e1e1e1-0000-0000-0000-000000000006'::uuid, 'c1c1c1c1-0000-0000-0000-000000000008'::uuid,
   'd1d1d1d1-0000-0000-0000-00000000000a'::uuid, 'a0a0a0a0-0000-0000-0000-000000000002'::uuid,
   2, 240000::numeric, 'Espera la aprobación de la dirección. El presupuesto anual se cierra en marzo.', now() - interval '27 days'),

  ('b1b1b1b1-0000-0000-0000-00000000000a'::uuid, 'Consulta por arcos de fútbol 11 (referido)',
   null::uuid, 'c1c1c1c1-0000-0000-0000-000000000009'::uuid,
   'd1d1d1d1-0000-0000-0000-000000000001'::uuid, 'a0a0a0a0-0000-0000-0000-000000000002'::uuid,
   1, 900000::numeric, 'Referido de Javier Molina. Todavía no sabemos para qué institución compra.', now() - interval '1 day')
) as o(id, titulo, empresa_id, contacto_id, producto_id, responsable_id, orden, monto, notas, created_at)
join public.etapas e
  on e.organizacion_id = '11111111-1111-1111-1111-111111111111' and e.orden = o.orden
on conflict (id) do nothing;

-- ============================================================
-- 6. VENTAS E ITEMS ENTREGADOS
--
-- fecha_entrega y vida_util_meses se ponen EXPLICITOS en cada item: son los
-- que alimentan la vista alertas_vida_util, y asi la demo muestra vencidos,
-- por vencer y equipos todavia sanos sin depender de la fecha de ejecucion.
-- ============================================================
insert into public.ventas (id, organizacion_id, empresa_id, contacto_id, oportunidad_id, fecha, comprobante, notas) values
  ('f1f1f1f1-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'e1e1e1e1-0000-0000-0000-000000000001', 'c1c1c1c1-0000-0000-0000-000000000001', null, (current_date - interval '20 months')::date, 'FA-0001-00000112', 'Arcos y redes para las dos canchas de fútbol 11.'),
  ('f1f1f1f1-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'e1e1e1e1-0000-0000-0000-000000000003', 'c1c1c1c1-0000-0000-0000-000000000004', null, (current_date - interval '13 months')::date, 'FA-0001-00000178', 'Compra de inicio de temporada de las categorías infantiles.'),
  ('f1f1f1f1-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'e1e1e1e1-0000-0000-0000-000000000002', 'c1c1c1c1-0000-0000-0000-000000000003', null, (current_date - interval '11 months')::date, 'FB-0001-00000203', 'Renovación anual de pelotas y redes de fútbol 5.'),
  ('f1f1f1f1-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'e1e1e1e1-0000-0000-0000-000000000004', 'c1c1c1c1-0000-0000-0000-000000000006', null, (current_date - interval '23 months')::date, 'FA-0001-00000095', 'Material de entrenamiento para el predio. Pago a 30 días por tesorería.'),
  ('f1f1f1f1-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'e1e1e1e1-0000-0000-0000-000000000005', 'c1c1c1c1-0000-0000-0000-000000000007', null, (current_date - interval '2 months')::date, 'FA-0001-00000341', 'Primera entrega del expediente municipal. Remito conformado por Hernán.'),
  ('f1f1f1f1-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', 'e1e1e1e1-0000-0000-0000-000000000006', 'c1c1c1c1-0000-0000-0000-000000000008', 'b1b1b1b1-0000-0000-0000-000000000004', (current_date - interval '6 months')::date, 'FB-0001-00000288', 'Kit de agilidad y mantenimiento para educación física.')
on conflict (id) do nothing;

insert into public.venta_items (id, organizacion_id, venta_id, producto_id, cantidad, precio_unitario, fecha_entrega, vida_util_meses) values
  -- Venta 1: las redes ya vencieron hace 2 meses; los arcos siguen vigentes.
  ('f2f2f2f2-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'f1f1f1f1-0000-0000-0000-000000000001', 'd1d1d1d1-0000-0000-0000-000000000001', 2, 410000, (current_date - interval '20 months')::date, 60),
  ('f2f2f2f2-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'f1f1f1f1-0000-0000-0000-000000000001', 'd1d1d1d1-0000-0000-0000-000000000003', 2, 58000, (current_date - interval '20 months')::date, 18),

  -- Venta 2: pecheras y pelotas N°4 vencidas hace 1 mes.
  ('f2f2f2f2-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'f1f1f1f1-0000-0000-0000-000000000002', 'd1d1d1d1-0000-0000-0000-000000000008', 2, 34000, (current_date - interval '13 months')::date, 12),
  ('f2f2f2f2-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'f1f1f1f1-0000-0000-0000-000000000002', 'd1d1d1d1-0000-0000-0000-00000000000a', 10, 11000, (current_date - interval '13 months')::date, 12),

  -- Venta 3: las pelotas N°5 vencen el mes que viene.
  ('f2f2f2f2-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'f1f1f1f1-0000-0000-0000-000000000003', 'd1d1d1d1-0000-0000-0000-000000000009', 12, 14000, (current_date - interval '11 months')::date, 12),
  ('f2f2f2f2-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', 'f1f1f1f1-0000-0000-0000-000000000003', 'd1d1d1d1-0000-0000-0000-000000000004', 4, 30000, (current_date - interval '11 months')::date, 18),

  -- Venta 4: los conos vencen el mes que viene; las vallas todavía no.
  ('f2f2f2f2-0000-0000-0000-000000000007', '11111111-1111-1111-1111-111111111111', 'f1f1f1f1-0000-0000-0000-000000000004', 'd1d1d1d1-0000-0000-0000-000000000005', 2, 26000, (current_date - interval '23 months')::date, 24),
  ('f2f2f2f2-0000-0000-0000-000000000008', '11111111-1111-1111-1111-111111111111', 'f1f1f1f1-0000-0000-0000-000000000004', 'd1d1d1d1-0000-0000-0000-000000000006', 1, 45000, (current_date - interval '23 months')::date, 36),

  -- Venta 5: entrega reciente, lejos de vencer.
  ('f2f2f2f2-0000-0000-0000-000000000009', '11111111-1111-1111-1111-111111111111', 'f1f1f1f1-0000-0000-0000-000000000005', 'd1d1d1d1-0000-0000-0000-000000000002', 2, 175000, (current_date - interval '2 months')::date, 48),
  ('f2f2f2f2-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', 'f1f1f1f1-0000-0000-0000-000000000005', 'd1d1d1d1-0000-0000-0000-00000000000b', 1, 9000, (current_date - interval '2 months')::date, 24),

  -- Venta 6: el kit de mantenimiento va sin vida útil, no genera alerta nunca.
  ('f2f2f2f2-0000-0000-0000-00000000000b', '11111111-1111-1111-1111-111111111111', 'f1f1f1f1-0000-0000-0000-000000000006', 'd1d1d1d1-0000-0000-0000-000000000007', 2, 21000, (current_date - interval '6 months')::date, 24),
  ('f2f2f2f2-0000-0000-0000-00000000000c', '11111111-1111-1111-1111-111111111111', 'f1f1f1f1-0000-0000-0000-000000000006', 'd1d1d1d1-0000-0000-0000-00000000000c', 1, 95000, (current_date - interval '6 months')::date, null)
on conflict (id) do nothing;

-- ============================================================
-- 7. ALERTAS YA ENVIADAS
--
-- Las pendientes NO se cargan: las calcula la vista alertas_vida_util. Esto
-- es solo el historial de avisos, para que la pantalla muestre la columna
-- "último envío" con datos.
-- ============================================================
insert into public.alertas_enviadas (id, organizacion_id, venta_item_id, canal, destinatario, mensaje, enviado_por, enviado_at) values
  ('a1a1a1a1-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'f2f2f2f2-0000-0000-0000-000000000002', 'email', 'mgutierrez@casanjusto.com.ar', 'Hola Martín: las redes de fútbol 11 que entregamos hace 20 meses llegaron al fin de su vida útil estimada. Te preparamos el presupuesto de recambio.', 'a0a0a0a0-0000-0000-0000-000000000002', now() - interval '10 days'),
  ('a1a1a1a1-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'f2f2f2f2-0000-0000-0000-000000000003', 'whatsapp', '11 6712-4455', 'Hola Carolina, las pecheras cumplieron su vida útil. ¿Querés que te cotice cuatro juegos nuevos?', 'a0a0a0a0-0000-0000-0000-000000000002', now() - interval '5 days'),
  ('a1a1a1a1-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'f2f2f2f2-0000-0000-0000-000000000004', 'email', 'carolina@efiramos.com.ar', 'Además de las pecheras, las diez pelotas N°4 también llegaron al final de su vida útil estimada.', 'a0a0a0a0-0000-0000-0000-000000000001', now() - interval '3 days')
on conflict (id) do nothing;

-- ============================================================
-- 8. BITACORA
--
-- Un registro por interaccion, con los siete tipos que acepta la tabla, para
-- que se vean todas las pastillas de color.
-- ============================================================
insert into public.bitacora_entradas (id, organizacion_id, empresa_id, contacto_id, tipo, titulo, detalle, autor_id, ocurrido_en) values
  ('babababa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'e1e1e1e1-0000-0000-0000-000000000001', 'c1c1c1c1-0000-0000-0000-000000000001', 'email', 'Aviso de vencimiento de las redes', 'Le mandamos el aviso automático de fin de vida útil de las redes de fútbol 11 con el presupuesto de recambio adjunto.', 'a0a0a0a0-0000-0000-0000-000000000002', now() - interval '10 days'),
  ('babababa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'e1e1e1e1-0000-0000-0000-000000000001', 'c1c1c1c1-0000-0000-0000-000000000001', 'llamada', 'Seguimiento del presupuesto de redes', 'Confirmó que lo recibió. Lo lleva a la comisión directiva del martes. Pide que no subamos el precio antes de eso.', 'a0a0a0a0-0000-0000-0000-000000000002', now() - interval '8 days'),
  ('babababa-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'e1e1e1e1-0000-0000-0000-000000000001', 'c1c1c1c1-0000-0000-0000-000000000002', 'consulta', 'Consulta por financiación en tres pagos', 'Laura preguntó si podemos facturar en tres cuotas sin interés. Queda a confirmar con administración.', 'a0a0a0a0-0000-0000-0000-000000000001', now() - interval '7 days'),
  ('babababa-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'e1e1e1e1-0000-0000-0000-000000000002', 'c1c1c1c1-0000-0000-0000-000000000003', 'whatsapp', 'Presupuesto de pelotas N°5', 'Le pasamos por WhatsApp el precio por 12 unidades. Avisó que está comparando con otro proveedor.', 'a0a0a0a0-0000-0000-0000-000000000002', now() - interval '6 days'),
  ('babababa-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'e1e1e1e1-0000-0000-0000-000000000002', 'c1c1c1c1-0000-0000-0000-000000000003', 'reunion', 'Visita a la obra de la cancha 7', 'Fuimos al complejo a medir. Necesita arcos de fútbol 5 reforzados porque la cancha es de uso intensivo.', 'a0a0a0a0-0000-0000-0000-000000000001', now() - interval '18 days'),
  ('babababa-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', 'e1e1e1e1-0000-0000-0000-000000000002', 'c1c1c1c1-0000-0000-0000-000000000003', 'queja', 'Reclamo por una red con costura floja', 'Una de las redes de fútbol 5 vino con la costura del lateral floja. Se acordó el cambio sin cargo para la semana próxima.', 'a0a0a0a0-0000-0000-0000-000000000002', now() - interval '40 days'),
  ('babababa-0000-0000-0000-000000000007', '11111111-1111-1111-1111-111111111111', 'e1e1e1e1-0000-0000-0000-000000000003', 'c1c1c1c1-0000-0000-0000-000000000004', 'whatsapp', 'Aviso de vencimiento de pecheras', 'Le avisamos que las pecheras cumplieron su vida útil. Pidió cotización por cuatro juegos.', 'a0a0a0a0-0000-0000-0000-000000000002', now() - interval '5 days'),
  ('babababa-0000-0000-0000-000000000008', '11111111-1111-1111-1111-111111111111', 'e1e1e1e1-0000-0000-0000-000000000003', 'c1c1c1c1-0000-0000-0000-000000000004', 'nota', 'Entrega del kit de agilidad', 'Se entregó el kit completo antes del inicio del torneo, como se había coordinado. Cliente conforme.', 'a0a0a0a0-0000-0000-0000-000000000002', now() - interval '33 days'),
  ('babababa-0000-0000-0000-000000000009', '11111111-1111-1111-1111-111111111111', 'e1e1e1e1-0000-0000-0000-000000000004', 'c1c1c1c1-0000-0000-0000-000000000005', 'llamada', 'Pedido de conos y vallas', 'Javier avisó que los conos están rotos. Pasa el pedido a compras para que emitan la orden.', 'a0a0a0a0-0000-0000-0000-000000000001', now() - interval '12 days'),
  ('babababa-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', 'e1e1e1e1-0000-0000-0000-000000000004', 'c1c1c1c1-0000-0000-0000-000000000006', 'email', 'Tablero electrónico discontinuado', 'Le informamos que el proveedor discontinuó el modelo. La oportunidad se marca como perdida.', 'a0a0a0a0-0000-0000-0000-000000000001', now() - interval '58 days'),
  ('babababa-0000-0000-0000-00000000000b', '11111111-1111-1111-1111-111111111111', 'e1e1e1e1-0000-0000-0000-000000000005', 'c1c1c1c1-0000-0000-0000-000000000007', 'reunion', 'Presentación del pliego en el municipio', 'Presentamos la documentación por mesa de entradas. La apertura de sobres es el mes que viene.', 'a0a0a0a0-0000-0000-0000-000000000001', now() - interval '21 days'),
  ('babababa-0000-0000-0000-00000000000c', '11111111-1111-1111-1111-111111111111', 'e1e1e1e1-0000-0000-0000-000000000006', 'c1c1c1c1-0000-0000-0000-000000000008', 'consulta', 'Consulta por pelotas N°4', 'Mariela pidió precio por 20 pelotas N°4. Depende de la aprobación de la dirección.', 'a0a0a0a0-0000-0000-0000-000000000002', now() - interval '27 days')
on conflict (id) do nothing;

commit;

-- ============================================================
-- VERIFICACION
--
-- Corriendo esto aparte, tiene que dar: 4 cuentas, 4 roles, 6 etapas,
-- 6 clientes, 9 contactos, 13 productos, 10 oportunidades, 6 ventas,
-- 12 items, 3 alertas enviadas, 12 entradas de bitacora y 5 alertas de vida
-- util pendientes (2 por vencer + 3 vencidas).
-- ============================================================
-- select 'perfiles' t, count(*) from public.perfiles where organizacion_id = '11111111-1111-1111-1111-111111111111'
-- union all select 'roles',          count(*) from public.roles          where organizacion_id = '11111111-1111-1111-1111-111111111111'
-- union all select 'etapas',         count(*) from public.etapas         where organizacion_id = '11111111-1111-1111-1111-111111111111'
-- union all select 'empresas',       count(*) from public.empresas       where organizacion_id = '11111111-1111-1111-1111-111111111111'
-- union all select 'contactos',      count(*) from public.contactos      where organizacion_id = '11111111-1111-1111-1111-111111111111'
-- union all select 'productos',      count(*) from public.productos      where organizacion_id = '11111111-1111-1111-1111-111111111111'
-- union all select 'oportunidades',  count(*) from public.oportunidades  where organizacion_id = '11111111-1111-1111-1111-111111111111'
-- union all select 'ventas',         count(*) from public.ventas         where organizacion_id = '11111111-1111-1111-1111-111111111111'
-- union all select 'venta_items',    count(*) from public.venta_items    where organizacion_id = '11111111-1111-1111-1111-111111111111'
-- union all select 'alertas_env',    count(*) from public.alertas_enviadas   where organizacion_id = '11111111-1111-1111-1111-111111111111'
-- union all select 'bitacora',       count(*) from public.bitacora_entradas  where organizacion_id = '11111111-1111-1111-1111-111111111111'
-- union all select 'alertas_vida',   count(*) from public.alertas_vida_util  where empresa_id in (select id from public.empresas where organizacion_id = '11111111-1111-1111-1111-111111111111');
