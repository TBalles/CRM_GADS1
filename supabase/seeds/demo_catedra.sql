-- Tuco & Nito - DEMO PARA LA CATEDRA
--
-- Crea una organizacion cliente ("Cátedra UNLaM (demo)") con cuatro cuentas,
-- una por cada rol por defecto, y la carga con datos en TODOS los modulos:
-- clientes, contactos, actividades, productos, oportunidades (con su historial
-- de etapas), ventas y alertas.
--
-- COMO CORRERLO
--   Pegar TODO el archivo en el SQL Editor de Supabase y ejecutar.
--   Requiere 0001 a 0007 aplicadas.
--
-- ES RE-EJECUTABLE: todas las filas tienen id fijo, asi que correrlo dos veces
-- no duplica nada. Los datos que agrego la 0007 (responsable, estado, origen,
-- cierre de oportunidades) se REFRESCAN en cada corrida: sirve tanto para una
-- base nueva como para la demo que ya existia antes de la 0007. Para borrar la
-- demo entera alcanza con:
--     delete from public.organizaciones where id = '11111111-1111-1111-1111-111111111111';
--     delete from auth.users where email like '%@demo.tuconito.com.ar';
--
-- CUENTAS (contraseña unica para las cuatro: Catedra.2026)
--   administrador@demo.tuconito.com.ar  -> Administrador         (todo + usuarios, roles y configuracion)
--   ventas@demo.tuconito.com.ar         -> Vendedor              (SOLO su cartera: 4 de los 8 clientes)
--   corporativo@demo.tuconito.com.ar    -> Responsable comercial (ve todo el equipo, asigna y reabre)
--   lectura@demo.tuconito.com.ar        -> Solo lectura          (clientes y catalogo)
--
-- CARTERA: el Vendedor tiene San Justo, La Tablada, Ramos Mejía y Los Pibes F5
-- (con sus contactos, oportunidades, ventas y alertas) y al profesor Ibarra
-- como cliente individual; el resto es del Administrador. Entrar con las dos
-- cuentas muestra la diferencia.
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
-- El trigger organizaciones_inicial (0007) le crea solos los cuatro roles, las
-- seis etapas del embudo y los catalogos. Las sentencias que siguen son la red
-- de seguridad para el caso de que la organizacion ya existiera sin ellos.
-- ============================================================
insert into public.organizaciones (id, nombre, activa) values
  ('11111111-1111-1111-1111-111111111111', 'Cátedra UNLaM (demo)', true)
on conflict (id) do nothing;

select public.crear_roles_iniciales('11111111-1111-1111-1111-111111111111');
select public.crear_catalogos_iniciales('11111111-1111-1111-1111-111111111111');

insert into public.etapas (organizacion_id, nombre, orden, color, tipo) values
  ('11111111-1111-1111-1111-111111111111', 'Consulta recibida',      1, '#94a3b8', 'abierta'),
  ('11111111-1111-1111-1111-111111111111', 'Relevamiento de cancha', 2, '#60a5fa', 'abierta'),
  ('11111111-1111-1111-1111-111111111111', 'Presupuesto enviado',    3, '#fbbf24', 'abierta'),
  ('11111111-1111-1111-1111-111111111111', 'Negociación',            4, '#fb923c', 'abierta'),
  ('11111111-1111-1111-1111-111111111111', 'Entregado',              5, '#4ade80', 'ganada'),
  ('11111111-1111-1111-1111-111111111111', 'Perdida',                6, '#f87171', 'perdida')
on conflict (organizacion_id, orden) do nothing;

-- Datos del proveedor para los presupuestos (solo si todavia no se cargaron:
-- no pisa lo que se edite desde Configuracion).
update public.organizaciones set
  razon_social = 'Equipamiento Deportivo Cátedra SRL (demo)',
  cuit = '30-00000000-0',
  condicion_iva = 'responsable_inscripto',
  direccion = 'Florencio Varela 1903, San Justo',
  telefono = '11 4480-0000',
  email = 'ventas@demo.tuconito.com.ar',
  presupuesto_condiciones = 'Precios en pesos, IVA incluido. Entrega en 10 días hábiles desde la aprobación.'
where id = '11111111-1111-1111-1111-111111111111' and razon_social is null;

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
  ('a0a0a0a0-0000-0000-0000-000000000002'::uuid, 'ventas@demo.tuconito.com.ar',        'Demo · Vendedor',       'Vendedor'),
  ('a0a0a0a0-0000-0000-0000-000000000003'::uuid, 'corporativo@demo.tuconito.com.ar',   'Demo · Responsable comercial', 'Responsable comercial'),
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
  ('a0a0a0a0-0000-0000-0000-000000000002'::uuid, 'ventas@demo.tuconito.com.ar',        'Demo · Vendedor',       'Vendedor'),
  ('a0a0a0a0-0000-0000-0000-000000000003'::uuid, 'corporativo@demo.tuconito.com.ar',   'Demo · Responsable comercial', 'Responsable comercial'),
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
--
-- responsable_id arma la CARTERA: el Vendedor (...0002) ve solo lo suyo; el
-- Administrador (...0001) y el Responsable comercial ven todo. ON CONFLICT DO
-- UPDATE solo sobre las columnas de la 0007: refresca la demo vieja sin pisar
-- el resto de lo que se haya editado. Los Pibes F5 (potencial) y Villa Madero
-- (inactivo = baja logica) muestran estados distintos de "cliente".
-- ============================================================
insert into public.empresas (id, organizacion_id, nombre, cuit, telefono, email, direccion, notas, created_at,
                             responsable_id, estado, origen_id, tipo_cliente, sitio_web)
select v.id, '11111111-1111-1111-1111-111111111111', v.nombre, v.cuit, v.telefono, v.email, v.direccion, v.notas, v.created_at,
       v.responsable_id, v.estado, og.id, v.tipo_cliente, v.sitio_web
from (values
  ('e1e1e1e1-0000-0000-0000-000000000001'::uuid, 'Club Atlético San Justo', '30-71234567-9', '11 4482-1100', 'contacto@casanjusto.com.ar', 'Av. Juan Manuel de Rosas 1200, San Justo', 'Cliente desde 2023. Compra por licitación interna: siempre pide tres presupuestos.', now() - interval '22 months',
   'a0a0a0a0-0000-0000-0000-000000000002'::uuid, 'cliente', 'Web', 'club', 'https://casanjusto.com.ar'),
  ('e1e1e1e1-0000-0000-0000-000000000002'::uuid, 'Complejo Fútbol 5 La Tablada', '30-70998877-4', '11 4651-8020', 'reservas@f5latablada.com.ar', 'Cristianía 430, La Tablada', 'Seis canchas de sintético. Renueva pelotas todos los años.', now() - interval '14 months',
   'a0a0a0a0-0000-0000-0000-000000000002'::uuid, 'cliente', 'Redes sociales', 'complejo_f5', null),
  ('e1e1e1e1-0000-0000-0000-000000000003'::uuid, 'Escuela de Fútbol Infantil Ramos Mejía', '30-71555321-0', '11 4654-3311', 'info@efiramos.com.ar', 'Av. de Mayo 890, Ramos Mejía', 'Categorías 2012 a 2019. Compra grande antes de que arranque el torneo.', now() - interval '15 months',
   'a0a0a0a0-0000-0000-0000-000000000002'::uuid, 'cliente', 'Torneo / feria', 'escuela_futbol', null),
  ('e1e1e1e1-0000-0000-0000-000000000004'::uuid, 'Club Deportivo Morón', '30-68112233-7', '11 4483-7744', 'administracion@cdmoron.org.ar', 'Yrigoyen 2050, Morón', 'Tiene predio propio con cinco canchas. El pago sale por tesorería, tarda 30 días.', now() - interval '25 months',
   'a0a0a0a0-0000-0000-0000-000000000001'::uuid, 'cliente', 'Visita a predio', 'club', 'https://cdmoron.org.ar'),
  ('e1e1e1e1-0000-0000-0000-000000000005'::uuid, 'Predio Municipal de Isidro Casanova', '30-99887766-1', '11 4620-5500', 'deportes@lamatanza.gob.ar', 'Av. Cristianía 1500, Isidro Casanova', 'Compra por expediente municipal. Requiere factura A y remito conformado.', now() - interval '4 months',
   'a0a0a0a0-0000-0000-0000-000000000001'::uuid, 'cliente', 'Licitación municipal', 'predio_municipal', null),
  ('e1e1e1e1-0000-0000-0000-000000000006'::uuid, 'Colegio San Juan Bautista', '30-63445566-2', '11 4657-9090', 'secretaria@sjb.edu.ar', 'Rivadavia 745, Villa Luzuriaga', 'Educación física de primaria y secundaria. Presupuesto anual cerrado en marzo.', now() - interval '8 months',
   'a0a0a0a0-0000-0000-0000-000000000001'::uuid, 'cliente', 'Referido de otro club', 'colegio', null),
  ('e1e1e1e1-0000-0000-0000-000000000007'::uuid, 'Complejo Los Pibes F5', null, '11 5530-7788', 'lospibesf5@gmail.com', 'Av. Brig. Gral. J. M. de Rosas 5400, Laferrere', 'Abre en marzo con tres canchas. Todavía no nos compró nada.', now() - interval '20 days',
   'a0a0a0a0-0000-0000-0000-000000000002'::uuid, 'potencial', 'Redes sociales', 'complejo_f5', null),
  ('e1e1e1e1-0000-0000-0000-000000000008'::uuid, 'Club Social Villa Madero', '30-60011223-5', '11 4442-0101', 'secretaria@csvillamadero.org.ar', 'Av. Crovara 2300, Villa Madero', 'Cerró la sede de fútbol en 2025. Dado de baja: se conserva su historial.', now() - interval '30 months',
   'a0a0a0a0-0000-0000-0000-000000000001'::uuid, 'inactivo', 'Visita a predio', 'club', null)
) as v(id, nombre, cuit, telefono, email, direccion, notas, created_at, responsable_id, estado, origen, tipo_cliente, sitio_web)
left join public.origenes og
  on og.organizacion_id = '11111111-1111-1111-1111-111111111111' and og.nombre = v.origen
on conflict (id) do update set
  responsable_id = excluded.responsable_id,
  estado         = excluded.estado,
  origen_id      = excluded.origen_id,
  tipo_cliente   = excluded.tipo_cliente,
  sitio_web      = excluded.sitio_web;

-- El ultimo contacto va sin empresa a proposito: es un cliente individual (la
-- consigna lo pide) y las pantallas tienen que saber mostrarlo igual. Cada
-- contacto es del responsable de su empresa.
insert into public.contactos (id, organizacion_id, empresa_id, nombre, apellido, email, telefono, cargo, notas, created_at,
                              responsable_id, estado, origen_id, documento)
select v.id, '11111111-1111-1111-1111-111111111111', v.empresa_id, v.nombre, v.apellido, v.email, v.telefono, v.cargo, v.notas, v.created_at,
       v.responsable_id, v.estado, og.id, v.documento
from (values
  ('c1c1c1c1-0000-0000-0000-000000000001'::uuid, 'e1e1e1e1-0000-0000-0000-000000000001'::uuid, 'Martín', 'Gutiérrez', 'mgutierrez@casanjusto.com.ar', '11 6234-1100', 'Presidente', 'Decide las compras grandes. Contestar por mail, no atiende el teléfono.', now() - interval '22 months',
   'a0a0a0a0-0000-0000-0000-000000000002'::uuid, 'cliente', 'Web', '22345678'),
  ('c1c1c1c1-0000-0000-0000-000000000002'::uuid, 'e1e1e1e1-0000-0000-0000-000000000001'::uuid, 'Laura', 'Benítez', 'tesoreria@casanjusto.com.ar', '11 6234-1101', 'Tesorera', 'Maneja los pagos y los plazos.', now() - interval '21 months',
   'a0a0a0a0-0000-0000-0000-000000000002'::uuid, 'cliente', null, null),
  ('c1c1c1c1-0000-0000-0000-000000000003'::uuid, 'e1e1e1e1-0000-0000-0000-000000000002'::uuid, 'Diego', 'Sosa', 'diego@f5latablada.com.ar', '11 5588-2030', 'Dueño', 'Responde rápido por WhatsApp.', now() - interval '14 months',
   'a0a0a0a0-0000-0000-0000-000000000002'::uuid, 'cliente', 'Redes sociales', '27890123'),
  ('c1c1c1c1-0000-0000-0000-000000000004'::uuid, 'e1e1e1e1-0000-0000-0000-000000000003'::uuid, 'Carolina', 'Ferreyra', 'carolina@efiramos.com.ar', '11 6712-4455', 'Coordinadora general', 'Pide todo con factura a nombre de la escuela.', now() - interval '15 months',
   'a0a0a0a0-0000-0000-0000-000000000002'::uuid, 'cliente', 'Torneo / feria', null),
  ('c1c1c1c1-0000-0000-0000-000000000005'::uuid, 'e1e1e1e1-0000-0000-0000-000000000004'::uuid, 'Javier', 'Molina', 'jmolina@cdmoron.org.ar', '11 6099-7744', 'Jefe de mantenimiento', 'Es el que avisa cuando algo se rompe. Muy buen contacto técnico.', now() - interval '25 months',
   'a0a0a0a0-0000-0000-0000-000000000001'::uuid, 'cliente', 'Visita a predio', null),
  ('c1c1c1c1-0000-0000-0000-000000000006'::uuid, 'e1e1e1e1-0000-0000-0000-000000000004'::uuid, 'Silvina', 'Rojas', 'compras@cdmoron.org.ar', '11 6099-7745', 'Compras', 'Necesita la orden de compra firmada antes de cada entrega.', now() - interval '20 months',
   'a0a0a0a0-0000-0000-0000-000000000001'::uuid, 'cliente', null, null),
  ('c1c1c1c1-0000-0000-0000-000000000007'::uuid, 'e1e1e1e1-0000-0000-0000-000000000005'::uuid, 'Hernán', 'Costa', 'hcosta@lamatanza.gob.ar', '11 6720-5500', 'Encargado del predio', 'Coordina las entregas de lunes a viernes de 8 a 14.', now() - interval '4 months',
   'a0a0a0a0-0000-0000-0000-000000000001'::uuid, 'cliente', 'Licitación municipal', null),
  ('c1c1c1c1-0000-0000-0000-000000000008'::uuid, 'e1e1e1e1-0000-0000-0000-000000000006'::uuid, 'Mariela', 'Paz', 'mpaz@sjb.edu.ar', '11 6455-9090', 'Regente', 'Aprueba el gasto junto con la dirección. Pidió no recibir más promociones.', now() - interval '8 months',
   'a0a0a0a0-0000-0000-0000-000000000001'::uuid, 'no_contactar', null, null),
  ('c1c1c1c1-0000-0000-0000-000000000009'::uuid, null::uuid, 'Nicolás', 'Ibarra', 'nicoibarra.ef@gmail.com', '11 6388-1212', 'Profesor de educación física', 'Referido de Javier Molina. Compra como cliente individual, sin institución.', now() - interval '2 months',
   'a0a0a0a0-0000-0000-0000-000000000002'::uuid, 'potencial', 'Referido de otro club', '31456789')
) as v(id, empresa_id, nombre, apellido, email, telefono, cargo, notas, created_at, responsable_id, estado, origen, documento)
left join public.origenes og
  on og.organizacion_id = '11111111-1111-1111-1111-111111111111' and og.nombre = v.origen
on conflict (id) do update set
  responsable_id = excluded.responsable_id,
  estado         = excluded.estado,
  origen_id      = excluded.origen_id,
  documento      = excluded.documento;

-- ============================================================
-- 5. OPORTUNIDADES
--
-- Doce oportunidades en las seis etapas: abiertas, dos Entregadas (ganadas,
-- con fecha real de cierre) y dos Perdidas (con fecha y motivo). El estado lo
-- deriva el trigger de la etapa. En una demo que ya existia solo se refrescan
-- las columnas de la 0007 (la etapa no se toca).
-- ============================================================
insert into public.oportunidades (id, organizacion_id, titulo, empresa_id, contacto_id, producto_id, responsable_id, etapa_id, monto, notas, created_at,
                                  origen_id, tipo, probabilidad, fecha_estimada_cierre, fecha_cierre, motivo_perdida_id)
select
  o.id, '11111111-1111-1111-1111-111111111111', o.titulo, o.empresa_id, o.contacto_id,
  o.producto_id, o.responsable_id, e.id, o.monto, o.notas, o.created_at,
  og.id, o.tipo, o.probabilidad, o.fecha_estimada_cierre, o.fecha_cierre, mp.id
from (values
  ('b1b1b1b1-0000-0000-0000-000000000001'::uuid, 'Recambio de redes de fútbol 11',
   'e1e1e1e1-0000-0000-0000-000000000001'::uuid, 'c1c1c1c1-0000-0000-0000-000000000001'::uuid,
   'd1d1d1d1-0000-0000-0000-000000000003'::uuid, 'a0a0a0a0-0000-0000-0000-000000000002'::uuid,
   4, 130000::numeric, 'Las redes que compraron hace 20 meses ya vencieron. Piden dos juegos.', now() - interval '9 days',
   'Recambio por vida útil', 'directa', 70, current_date + 10, null::date, null::text),

  ('b1b1b1b1-0000-0000-0000-000000000002'::uuid, 'Pelotas N°5 para la temporada',
   'e1e1e1e1-0000-0000-0000-000000000002'::uuid, 'c1c1c1c1-0000-0000-0000-000000000003'::uuid,
   'd1d1d1d1-0000-0000-0000-000000000009'::uuid, 'a0a0a0a0-0000-0000-0000-000000000002'::uuid,
   3, 180000::numeric, 'Presupuesto por 12 unidades enviado por WhatsApp. Compara con otro proveedor.', now() - interval '6 days',
   'Recambio por vida útil', 'directa', 50, current_date + 20, null, null),

  ('b1b1b1b1-0000-0000-0000-000000000003'::uuid, 'Dos arcos de fútbol 5 para la cancha nueva',
   'e1e1e1e1-0000-0000-0000-000000000002'::uuid, 'c1c1c1c1-0000-0000-0000-000000000003'::uuid,
   'd1d1d1d1-0000-0000-0000-000000000002'::uuid, 'a0a0a0a0-0000-0000-0000-000000000002'::uuid,
   2, 360000::numeric, 'Está terminando la obra de la cancha 7. Volver a llamar la semana que viene.', now() - interval '18 days',
   'Redes sociales', 'directa', 40, current_date + 45, null, null),

  ('b1b1b1b1-0000-0000-0000-000000000004'::uuid, 'Kit de entrenamiento para categorías infantiles',
   'e1e1e1e1-0000-0000-0000-000000000003'::uuid, 'c1c1c1c1-0000-0000-0000-000000000004'::uuid,
   'd1d1d1d1-0000-0000-0000-000000000007'::uuid, 'a0a0a0a0-0000-0000-0000-000000000002'::uuid,
   5, 154000::numeric, 'Cerrada. Entrega coordinada con la coordinadora para el inicio del torneo.', now() - interval '35 days',
   'Torneo / feria', 'directa', 100, current_date - 30, current_date - 33, null),

  ('b1b1b1b1-0000-0000-0000-000000000005'::uuid, 'Pecheras de recambio x 4 juegos',
   'e1e1e1e1-0000-0000-0000-000000000003'::uuid, 'c1c1c1c1-0000-0000-0000-000000000004'::uuid,
   'd1d1d1d1-0000-0000-0000-000000000008'::uuid, 'a0a0a0a0-0000-0000-0000-000000000002'::uuid,
   1, 152000::numeric, 'Entró por el aviso automático de vida útil: las de hace un año ya vencieron.', now() - interval '2 days',
   'Recambio por vida útil', 'directa', 20, current_date + 30, null, null),

  ('b1b1b1b1-0000-0000-0000-000000000006'::uuid, 'Renovación de conos y vallas del predio',
   'e1e1e1e1-0000-0000-0000-000000000004'::uuid, 'c1c1c1c1-0000-0000-0000-000000000005'::uuid,
   'd1d1d1d1-0000-0000-0000-000000000005'::uuid, 'a0a0a0a0-0000-0000-0000-000000000001'::uuid,
   4, 101000::numeric, 'Javier ya lo pidió por mantenimiento; falta la orden de compra de Silvina.', now() - interval '12 days',
   'Visita a predio', 'directa', 80, current_date + 7, null, null),

  ('b1b1b1b1-0000-0000-0000-000000000007'::uuid, 'Tablero electrónico para la cancha principal',
   'e1e1e1e1-0000-0000-0000-000000000004'::uuid, 'c1c1c1c1-0000-0000-0000-000000000006'::uuid,
   'd1d1d1d1-0000-0000-0000-00000000000d'::uuid, 'a0a0a0a0-0000-0000-0000-000000000001'::uuid,
   6, 320000::numeric, 'Perdida: el proveedor discontinuó el modelo y no llegamos con el plazo.', now() - interval '60 days',
   'Visita a predio', 'directa', null, current_date - 50, current_date - 58, 'Plazo de entrega'),

  ('b1b1b1b1-0000-0000-0000-000000000008'::uuid, 'Licitación: equipamiento completo del predio',
   'e1e1e1e1-0000-0000-0000-000000000005'::uuid, 'c1c1c1c1-0000-0000-0000-000000000007'::uuid,
   'd1d1d1d1-0000-0000-0000-000000000001'::uuid, 'a0a0a0a0-0000-0000-0000-000000000001'::uuid,
   3, 1850000::numeric, 'Pliego presentado por expediente. La apertura de sobres es el mes que viene.', now() - interval '21 days',
   'Licitación municipal', 'licitacion', 30, current_date + 40, null, null),

  ('b1b1b1b1-0000-0000-0000-000000000009'::uuid, 'Pelotas N°4 para educación física',
   'e1e1e1e1-0000-0000-0000-000000000006'::uuid, 'c1c1c1c1-0000-0000-0000-000000000008'::uuid,
   'd1d1d1d1-0000-0000-0000-00000000000a'::uuid, 'a0a0a0a0-0000-0000-0000-000000000001'::uuid,
   2, 240000::numeric, 'Espera la aprobación de la dirección. El presupuesto anual se cierra en marzo.', now() - interval '27 days',
   'Referido de otro club', 'directa', 30, current_date + 150, null, null),

  ('b1b1b1b1-0000-0000-0000-00000000000a'::uuid, 'Consulta por arcos de fútbol 11 (referido)',
   null::uuid, 'c1c1c1c1-0000-0000-0000-000000000009'::uuid,
   'd1d1d1d1-0000-0000-0000-000000000001'::uuid, 'a0a0a0a0-0000-0000-0000-000000000002'::uuid,
   1, 900000::numeric, 'Referido de Javier Molina. Todavía no sabemos para qué institución compra.', now() - interval '1 day',
   'Referido de otro club', 'directa', 10, current_date + 60, null, null),

  ('b1b1b1b1-0000-0000-0000-00000000000b'::uuid, 'Pelotas y redes de fútbol 5 (temporada pasada)',
   'e1e1e1e1-0000-0000-0000-000000000002'::uuid, 'c1c1c1c1-0000-0000-0000-000000000003'::uuid,
   'd1d1d1d1-0000-0000-0000-000000000009'::uuid, 'a0a0a0a0-0000-0000-0000-000000000002'::uuid,
   5, 288000::numeric, 'Se entregó todo junto antes del arranque de los torneos nocturnos.', now() - interval '12 months',
   'Redes sociales', 'directa', 100, current_date - 335, current_date - 334, null),

  ('b1b1b1b1-0000-0000-0000-00000000000c'::uuid, 'Pelotas N°5 para el torneo de verano',
   'e1e1e1e1-0000-0000-0000-000000000001'::uuid, 'c1c1c1c1-0000-0000-0000-000000000002'::uuid,
   'd1d1d1d1-0000-0000-0000-000000000009'::uuid, 'a0a0a0a0-0000-0000-0000-000000000002'::uuid,
   6, 210000::numeric, 'Laura consiguió otro proveedor 15% más barato.', now() - interval '4 months',
   'Web', 'directa', null, current_date - 95, current_date - 92, 'Precio')
) as o(id, titulo, empresa_id, contacto_id, producto_id, responsable_id, orden, monto, notas, created_at,
       origen, tipo, probabilidad, fecha_estimada_cierre, fecha_cierre, motivo)
join public.etapas e
  on e.organizacion_id = '11111111-1111-1111-1111-111111111111' and e.orden = o.orden
left join public.origenes og
  on og.organizacion_id = '11111111-1111-1111-1111-111111111111' and og.nombre = o.origen
left join public.motivos_perdida mp
  on mp.organizacion_id = '11111111-1111-1111-1111-111111111111' and mp.nombre = o.motivo
on conflict (id) do update set
  responsable_id        = excluded.responsable_id,
  origen_id             = excluded.origen_id,
  tipo                  = excluded.tipo,
  probabilidad          = excluded.probabilidad,
  fecha_estimada_cierre = excluded.fecha_estimada_cierre,
  -- Datos de cierre solo si sigue cerrada como en la demo; si alguien la
  -- movio, el trigger de reglas decide (y una abierta queda sin ellos).
  fecha_cierre          = case when oportunidades.estado <> 'abierta'
                               then coalesce(excluded.fecha_cierre, oportunidades.fecha_cierre) end,
  motivo_perdida_id     = case when oportunidades.estado = 'perdida'
                               then coalesce(excluded.motivo_perdida_id, oportunidades.motivo_perdida_id) end
-- Sin cambios reales no se escribe: asi correrlo de nuevo no suma filas a la
-- auditoria de oportunidades cerradas.
where (oportunidades.responsable_id, oportunidades.origen_id, oportunidades.tipo, oportunidades.probabilidad,
       oportunidades.fecha_estimada_cierre)
      is distinct from (excluded.responsable_id, excluded.origen_id, excluded.tipo, excluded.probabilidad,
                        excluded.fecha_estimada_cierre)
   or (oportunidades.estado <> 'abierta' and excluded.fecha_cierre is not null
       and oportunidades.fecha_cierre is distinct from excluded.fecha_cierre)
   or (oportunidades.estado = 'perdida' and excluded.motivo_perdida_id is not null
       and oportunidades.motivo_perdida_id is distinct from excluded.motivo_perdida_id);

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
-- Un registro por interaccion. Estas filas usan la columna vieja `tipo` (como
-- la app de la segunda entrega): el trigger de la 0007 les completa el tipo de
-- catalogo (whatsapp -> Mensaje, queja -> Reclamo, consulta -> Otro...).
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


-- Actividades con los tipos nuevos de la 0007: oportunidad relacionada,
-- resultado, y una de un cliente individual (sin empresa). El tipo viejo
-- (`tipo`) lo completa el trigger a partir del tipo de catalogo.
insert into public.bitacora_entradas (id, organizacion_id, empresa_id, contacto_id, oportunidad_id, tipo_actividad_id, titulo, detalle, resultado, autor_id, ocurrido_en)
select v.id, '11111111-1111-1111-1111-111111111111', v.empresa_id, v.contacto_id, v.oportunidad_id, t.id, v.titulo, v.detalle, v.resultado, v.autor_id, v.ocurrido_en
from (values
  ('babababa-0000-0000-0000-00000000000d'::uuid, 'e1e1e1e1-0000-0000-0000-000000000002'::uuid, 'c1c1c1c1-0000-0000-0000-000000000003'::uuid, 'b1b1b1b1-0000-0000-0000-000000000003'::uuid,
   'visita_cancha', 'Relevamiento de la cancha 7', 'Medimos el arco existente y el anclaje. La cancha es de sintético con base de cemento.', 'Hacen falta arcos reforzados con anclaje químico.', 'a0a0a0a0-0000-0000-0000-000000000002'::uuid, now() - interval '16 days'),
  ('babababa-0000-0000-0000-00000000000e'::uuid, 'e1e1e1e1-0000-0000-0000-000000000005'::uuid, 'c1c1c1c1-0000-0000-0000-000000000007'::uuid, 'b1b1b1b1-0000-0000-0000-000000000008'::uuid,
   'propuesta', 'Oferta presentada en el expediente', 'Se presentó la oferta económica con garantía de mantenimiento de oferta.', 'Oferta admitida. Apertura de sobres el mes que viene.', 'a0a0a0a0-0000-0000-0000-000000000001'::uuid, now() - interval '20 days'),
  ('babababa-0000-0000-0000-00000000000f'::uuid, null::uuid, 'c1c1c1c1-0000-0000-0000-000000000009'::uuid, 'b1b1b1b1-0000-0000-0000-00000000000a'::uuid,
   'demostracion', 'Muestra de arcos en el depósito', 'Nicolás vino al depósito a ver el arco de fútbol 11 armado.', 'Le gustó el reforzado. Pide presupuesto por dos arcos.', 'a0a0a0a0-0000-0000-0000-000000000002'::uuid, now() - interval '20 hours')
) as v(id, empresa_id, contacto_id, oportunidad_id, codigo, titulo, detalle, resultado, autor_id, ocurrido_en)
join public.tipos_actividad t
  on t.organizacion_id = '11111111-1111-1111-1111-111111111111' and t.codigo = v.codigo
on conflict (id) do nothing;

-- Las entradas viejas que hablan de una oportunidad quedan vinculadas a ella.
update public.bitacora_entradas b
set oportunidad_id = v.oportunidad_id,
    resultado = coalesce(b.resultado, v.resultado)
from (values
  ('babababa-0000-0000-0000-000000000001'::uuid, 'b1b1b1b1-0000-0000-0000-000000000001'::uuid, 'Lo recibió y lo lleva a la comisión directiva.'),
  ('babababa-0000-0000-0000-000000000002'::uuid, 'b1b1b1b1-0000-0000-0000-000000000001'::uuid, 'Pide sostener el precio hasta el martes.'),
  ('babababa-0000-0000-0000-000000000004'::uuid, 'b1b1b1b1-0000-0000-0000-000000000002'::uuid, 'Está comparando con otro proveedor.'),
  ('babababa-0000-0000-0000-000000000005'::uuid, 'b1b1b1b1-0000-0000-0000-000000000003'::uuid, 'Necesita arcos reforzados.'),
  ('babababa-0000-0000-0000-000000000007'::uuid, 'b1b1b1b1-0000-0000-0000-000000000005'::uuid, 'Pidió cotización por cuatro juegos.'),
  ('babababa-0000-0000-0000-000000000008'::uuid, 'b1b1b1b1-0000-0000-0000-000000000004'::uuid, 'Cliente conforme con la entrega.'),
  ('babababa-0000-0000-0000-000000000009'::uuid, 'b1b1b1b1-0000-0000-0000-000000000006'::uuid, 'Pasa el pedido a compras.'),
  ('babababa-0000-0000-0000-00000000000a'::uuid, 'b1b1b1b1-0000-0000-0000-000000000007'::uuid, 'Oportunidad perdida por plazo de entrega.'),
  ('babababa-0000-0000-0000-00000000000b'::uuid, 'b1b1b1b1-0000-0000-0000-000000000008'::uuid, 'Pliego presentado.'),
  ('babababa-0000-0000-0000-00000000000c'::uuid, 'b1b1b1b1-0000-0000-0000-000000000009'::uuid, 'Depende de la aprobación de la dirección.')
) as v(id, oportunidad_id, resultado)
where b.id = v.id and b.oportunidad_id is null;

-- La venta de la temporada pasada del complejo sale de la oportunidad ganada.
update public.ventas set oportunidad_id = 'b1b1b1b1-0000-0000-0000-00000000000b'
where id = 'f1f1f1f1-0000-0000-0000-000000000003' and oportunidad_id is null;

-- ============================================================
-- 9. HISTORIAL DE ETAPAS
--
-- Cada oportunidad de la demo recorre el embudo hasta su etapa actual (las
-- perdidas, hasta Presupuesto enviado y de ahi a Perdida), con fechas entre su
-- alta y su cierre, y su responsable como autor del cambio.
--
-- Antes se borran las filas SIN usuario de la demo: son las que dejaron los
-- triggers al cargarla (o el "Registro inicial" de la 0007), no movimientos
-- hechos por una persona. Si una oportunidad ya tiene movimientos hechos por
-- alguien, no se le inventa recorrido.
-- ============================================================
delete from public.oportunidad_etapas_historial h
where h.organizacion_id = '11111111-1111-1111-1111-111111111111'
  and h.usuario_id is null
  and h.oportunidad_id::text like 'b1b1b1b1-%';

insert into public.oportunidad_etapas_historial
  (id, organizacion_id, oportunidad_id, etapa_anterior_id, etapa_nueva_id, usuario_id, observacion, cambiado_en)
select
  md5(c.id::text || ':' || c.paso)::uuid,
  '11111111-1111-1111-1111-111111111111',
  c.id,
  lag(e.id) over (partition by c.id order by c.paso),
  e.id,
  c.responsable_id,
  case
    when c.paso = 1 then 'Ingresó la consulta.'
    when c.paso = c.pasos and c.tipo = 'ganada' then 'Equipamiento entregado y conformado por el cliente.'
    when c.paso = c.pasos and c.tipo = 'perdida' then 'El cliente no avanzó con la compra.'
  end,
  c.created_at + (c.paso - 1) * ((c.fin - c.created_at) / greatest(c.pasos - 1, 1))
from (
  select o.id, o.responsable_id, o.created_at, et.tipo, p.orden, p.paso,
         count(*) over (partition by o.id) as pasos,
         coalesce(o.fecha_cierre + time '12:00', now() - interval '1 hour') as fin
  from public.oportunidades o
  join public.etapas et on et.id = o.etapa_id
  cross join lateral unnest(
    case when et.tipo = 'perdida' then array[1, 2, 3, et.orden]
         else array(select generate_series(1, et.orden)) end
  ) with ordinality as p(orden, paso)
  where o.organizacion_id = '11111111-1111-1111-1111-111111111111'
    and o.id::text like 'b1b1b1b1-%'
    and not exists (select 1 from public.oportunidad_etapas_historial h
                    where h.oportunidad_id = o.id and h.usuario_id is not null)
) c
join public.etapas e
  on e.organizacion_id = '11111111-1111-1111-1111-111111111111' and e.orden = c.orden
on conflict (id) do nothing;

commit;

-- ============================================================
-- VERIFICACION
--
-- Corriendo esto aparte, tiene que dar: 4 cuentas, 4 roles, 6 etapas,
-- 8 clientes, 9 contactos, 13 productos, 12 oportunidades (2 ganadas y
-- 2 perdidas), 6 ventas, 12 items, 3 alertas enviadas, 15 actividades,
-- 38 cambios de etapa en el historial y 5 alertas de vida util pendientes
-- (2 por vencer + 3 vencidas). Entrando como ventas@ (Vendedor): 4 clientes,
-- 5 contactos, 8 oportunidades, 3 ventas y 4 de esas 5 alertas.
-- ============================================================
-- select 'perfiles' t, count(*) from public.perfiles where organizacion_id = '11111111-1111-1111-1111-111111111111'
-- union all select 'roles',          count(*) from public.roles          where organizacion_id = '11111111-1111-1111-1111-111111111111'
-- union all select 'etapas',         count(*) from public.etapas         where organizacion_id = '11111111-1111-1111-1111-111111111111'
-- union all select 'empresas',       count(*) from public.empresas       where organizacion_id = '11111111-1111-1111-1111-111111111111'
-- union all select 'contactos',      count(*) from public.contactos      where organizacion_id = '11111111-1111-1111-1111-111111111111'
-- union all select 'productos',      count(*) from public.productos      where organizacion_id = '11111111-1111-1111-1111-111111111111'
-- union all select 'oportunidades',  count(*) from public.oportunidades  where organizacion_id = '11111111-1111-1111-1111-111111111111'
-- union all select 'historial',      count(*) from public.oportunidad_etapas_historial where organizacion_id = '11111111-1111-1111-1111-111111111111'
-- union all select 'ventas',         count(*) from public.ventas         where organizacion_id = '11111111-1111-1111-1111-111111111111'
-- union all select 'venta_items',    count(*) from public.venta_items    where organizacion_id = '11111111-1111-1111-1111-111111111111'
-- union all select 'alertas_env',    count(*) from public.alertas_enviadas   where organizacion_id = '11111111-1111-1111-1111-111111111111'
-- union all select 'bitacora',       count(*) from public.bitacora_entradas  where organizacion_id = '11111111-1111-1111-1111-111111111111'
-- union all select 'alertas_vida',   count(*) from public.alertas_vida_util  where empresa_id in (select id from public.empresas where organizacion_id = '11111111-1111-1111-1111-111111111111');
