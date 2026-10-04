-- ===========================================================================
-- Tuco & Nito - KIT DE MIGRACIONES 0008 a 0012 (archivo GENERADO, no editar a mano)
-- 
-- Pegar ENTERO en el SQL Editor de Supabase y ejecutar. Orden: 0008, 0009, 0010, 0011, 0012.
-- Es idempotente: se puede volver a correr sin efecto. Requiere 0001 a 0007 aplicadas.
-- Sin BEGIN/COMMIT: el editor lo manda como un solo pedido; si algo falla, se revierte todo.
-- Termina con una tabla de verificacion: todo tiene que decir OK y el TOTAL, 'TODO OK'.
-- Pasos completos y que hacer si falla: supabase/aplicar/LEEME.md
-- 
-- Se regenera con: npm run migraciones:consolidar   (lo verifica `npm test`)
-- ===========================================================================

-- ===========================================================================
-- >>> 0008_baja_logica.sql   (1 de 5)
-- ===========================================================================

-- Tuco & Nito - 0008: BAJA LOGICA DE EMPRESAS Y CONTACTOS EN LA BASE
--
-- La consigna pide baja logica: una empresa o un contacto con historia no se
-- borra, se da de baja (estado = 'inactivo'). Hasta la 0007 eso era solo una
-- convencion de la interfaz: la politica `borrar` de `empresas` y `contactos`
-- seguia vigente para quien tenia clientes.editar, y borrar una empresa
-- arrastra sus ventas y su bitacora (on delete cascade). Una llamada directa a
-- la API podia borrar una cartera entera.
--
-- Esta migracion saca esas dos politicas. Sin politica de DELETE, la RLS hace
-- que un borrado afecte 0 filas para todo rol de usuario (authenticated). Lo
-- mismo que ya pasa con las oportunidades desde la 0007.
--
-- La 0007 ya no vuelve a crear esas politicas, asi que re-ejecutarla despues de
-- esta migracion no deshace nada (en una base donde la 0007 se aplico ANTES de
-- este cambio, estas dos lineas son las que las sacan). Si tenes una copia vieja
-- de la 0007 y la re-ejecutas, volve a ejecutar la 0008 despues.
--
-- Ademas agrega una garantia del embudo: la organizacion no puede quedarse sin
-- ninguna etapa de tipo ganada ni sin ninguna de tipo perdida (ver el final).
--
-- NO cambia:
--   - borrar una organizacion entera (superadmin / service_role): las FK con
--     `on delete cascade` no pasan por la RLS de la tabla hija;
--   - la baja logica, que es un UPDATE (estado = 'inactivo'), cubierto por la
--     politica `editar` que ya existe.
--
-- Aditiva e idempotente: solo `drop policy if exists`. Se puede volver a correr.
-- Sin BEGIN/COMMIT propios (igual que la 0007), para poder ensayarla dentro de
-- una transaccion. Requiere 0001 a 0007 aplicadas.
--
-- Despues: correr supabase/tests/0008_baja_logica.sql.
--
-- COMPATIBILIDAD: ninguna pantalla borra empresas ni contactos (ver
-- docs/notas-de-version.md), asi que la app desplegada no se entera.

drop policy if exists "borrar" on public.empresas;
drop policy if exists "borrar" on public.contactos;

-- ============================================================
-- EMBUDO: SIEMPRE AL MENOS UNA ETAPA GANADA Y UNA PERDIDA
--
-- Sin una etapa ganada o sin una perdida ninguna oportunidad podria cerrarse
-- como corresponde. La pantalla /configuracion ya lo avisa antes de intentarlo;
-- este trigger es la garantia de ultima linea para cualquier otro camino.
--
-- Salta al borrar la ultima etapa de un tipo, o al cambiarle el tipo. NO salta
-- cuando se borra la organizacion entera (el cascade borra sus etapas): ahi la
-- organizacion ya no existe cuando corre el trigger.
-- SECURITY DEFINER: tiene que ver TODAS las etapas de la organizacion, no solo
-- las que la RLS le muestra a quien configura.
-- ============================================================
create or replace function public.etapas_conservar_cierres()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if old.tipo not in ('ganada', 'perdida') then
    return coalesce(new, old);
  end if;
  if tg_op = 'UPDATE' and new.tipo is not distinct from old.tipo then
    return new;
  end if;

  -- Borrar la organizacion entera: nada que proteger.
  if tg_op = 'DELETE' and not exists (select 1 from public.organizaciones o where o.id = old.organizacion_id) then
    return old;
  end if;

  if not exists (
    select 1 from public.etapas e
    where e.organizacion_id = old.organizacion_id and e.tipo = old.tipo and e.id <> old.id
  ) then
    raise exception 'Tiene que quedar al menos una etapa de tipo %: creá otra antes de % "%".',
      case old.tipo when 'ganada' then 'Ganada' else 'Perdida' end,
      case when tg_op = 'DELETE' then 'borrar' else 'cambiarle el tipo a' end,
      old.nombre
      using errcode = '23514';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists etapas_conservar_cierres on public.etapas;
create trigger etapas_conservar_cierres
  before update of tipo or delete on public.etapas
  for each row execute procedure public.etapas_conservar_cierres();

-- ===========================================================================
-- <<< fin de 0008_baja_logica.sql
-- ===========================================================================

-- ===========================================================================
-- >>> 0009_reglas_oportunidades.sql   (2 de 5)
-- ===========================================================================

-- Tuco & Nito - 0009: REGLAS DE OPORTUNIDADES QUE FALTABAN EN LA BASE
--
-- La interfaz de F2 (cierre, reapertura, formulario) exige tres cosas que hasta
-- ahora eran solo de la pantalla; cualquier otro camino (la API, un script, otra
-- app) las salteaba:
--
--   a) La fecha real de cierre no puede ser futura. Se compara con la fecha de
--      Argentina, no con la del servidor (UTC): a las 22:00 de Buenos Aires el
--      servidor ya esta en el dia siguiente. Se exige solo cuando la fecha de
--      cierre CAMBIA (o en un alta cerrada), asi una cerrada vieja sigue
--      pudiendo editarse en otros campos.
--   b) La fecha de cierre por defecto (cuando quien cierra no manda ninguna)
--      tambien es la de Argentina en vez de `current_date`.
--   c) Una oportunidad es de una empresa o de un contacto. Se exige en un
--      trigger aparte, solo cuando hay usuario (auth.uid() no es nulo) y solo
--      en el alta o cuando el cambio toca empresa_id o contacto_id: asi las FK
--      `on delete set null`, el service_role, los scripts, el SQL Editor y el
--      borrado en cascada de una organizacion siguen funcionando.
--
-- (a) y (b) redefinen `oportunidad_reglas()` con `create or replace`: es la
-- definicion de la 0007 SIN cambios en todo lo demas (el estado sale del tipo de
-- la etapa, reabrir exige oportunidades.reabrir, perdida exige motivo, una
-- cerrada que sigue cerrada no pierde su fecha, el cierre nuevo no hereda la
-- fecha del anterior). El trigger `oportunidades_reglas` ya apunta a la funcion
-- por nombre, asi que no hay que recrearlo.
--
-- Aditiva e idempotente: `create or replace` + `drop trigger if exists`. Se
-- puede volver a correr. Sin BEGIN/COMMIT propios (igual que la 0007 y la 0008),
-- para poder ensayarla dentro de una transaccion. Requiere 0001 a 0008 aplicadas.
--
-- Despues: correr supabase/tests/0009_reglas_oportunidades.sql.
--
-- COMPATIBILIDAD: la app de F2 ya valida las tres reglas en pantalla y traduce
-- estos errores. La app anterior a F2 no manda fechas futuras ni deja una
-- oportunidad sin empresa ni contacto desde el formulario.

-- ============================================================
-- (a) y (b) REGLAS DEL EMBUDO
-- ============================================================
create or replace function public.oportunidad_reglas()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_tipo text;
  -- "Hoy" en Argentina: el servidor corre en UTC.
  v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
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
    new.fecha_cierre := coalesce(new.fecha_cierre, v_hoy);
  elsif new.fecha_cierre is null then
    -- Sigue cerrada igual que antes: borrarle la fecha no se convierte en "hoy"
    -- en silencio, es un error.
    raise exception 'Una oportunidad cerrada tiene que tener fecha real de cierre.'
      using errcode = '23514';
  end if;

  -- Nueva en la 0009: la fecha real de cierre no puede ser futura. Solo si la
  -- fecha cambia (o en un alta cerrada): editar otros campos de una cerrada con
  -- una fecha ya guardada no la vuelve a juzgar.
  if new.fecha_cierre > v_hoy
     and (tg_op = 'INSERT' or new.fecha_cierre is distinct from old.fecha_cierre) then
    raise exception 'La fecha real de cierre no puede ser futura.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

-- ============================================================
-- (c) UNA OPORTUNIDAD ES DE UNA EMPRESA O DE UN CONTACTO
-- ============================================================
create or replace function public.oportunidad_requiere_cliente()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Sin usuario (service_role, scripts, SQL Editor, cascadas, acciones de FK):
  -- caminos de confianza, no se exige.
  if auth.uid() is null then
    return new;
  end if;

  if new.empresa_id is null and new.contacto_id is null
     and (tg_op = 'INSERT'
          or new.empresa_id is distinct from old.empresa_id
          or new.contacto_id is distinct from old.contacto_id) then
    raise exception 'La oportunidad tiene que ser de una empresa o de un contacto.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists oportunidades_requiere_cliente on public.oportunidades;
create trigger oportunidades_requiere_cliente
  before insert or update of empresa_id, contacto_id on public.oportunidades
  for each row execute procedure public.oportunidad_requiere_cliente();

-- ===========================================================================
-- <<< fin de 0009_reglas_oportunidades.sql
-- ===========================================================================

-- ===========================================================================
-- >>> 0010_indices_busqueda.sql   (3 de 5)
-- ===========================================================================

-- Tuco & Nito - 0010: INDICES PARA LA BUSQUEDA Y LA PAGINACION DEL SERVIDOR (F3)
--
-- Desde F3 las listas (empresas, contactos, oportunidades, productos, ventas,
-- usuarios) se pagan en el servidor: cada pagina es un
--     where organizacion_id = ... [filtros] order by <orden> limit N offset M
-- con la busqueda como `ilike '%texto%'`. Esta migracion agrega solo indices
-- (no cambia ninguna tabla, regla ni politica):
--
--   1) BTREE POR ORGANIZACION + ORDEN DE LA LISTA. Sirven al `order by ... limit`
--      de cada pantalla y al filtro por estado. La RLS ya filtra por
--      `organizacion_id`, asi que ese es siempre el primer campo.
--   2) TRIGRAMAS (OPCIONAL, ver el bloque de abajo). Un `ilike '%x%'` no usa un
--      btree; con pg_trgm si. Con cientos de filas no se nota: recien importa
--      con decenas de miles. Por eso va en un bloque aparte, que se puede borrar
--      o saltear sin perder nada de lo demas.
--
-- Aditiva e idempotente: `create index if not exists`. Se puede volver a correr.
-- Sin BEGIN/COMMIT propios (igual que la 0007 a la 0009), para poder ensayarla
-- dentro de una transaccion. Requiere 0001 a 0009 aplicadas.
--
-- Cuesta algo de escritura (cada insert/update toca los indices nuevos): para el
-- volumen de un CRM comercial es despreciable. Si una base ya tiene millones de
-- filas, crear los indices con `create index concurrently` fuera de una
-- transaccion.
--
-- NO ESTA APLICADA EN LA BASE VIVA: se pega a mano en el SQL Editor (ver
-- docs/deploy.md). La app funciona igual sin ella; solo es mas lenta con volumen.

-- ============================================================
-- 1) BTREE: organizacion + orden de cada lista
-- ============================================================

-- Empresas: order by nombre, id (id desempata entre paginas) y filtro por estado.
create index if not exists empresas_org_nombre_idx on public.empresas (organizacion_id, nombre, id);
create index if not exists empresas_org_estado_idx on public.empresas (organizacion_id, estado);

-- Contactos: order by nombre, apellido, id y filtro por estado.
create index if not exists contactos_org_nombre_idx on public.contactos (organizacion_id, nombre, apellido, id);
create index if not exists contactos_org_estado_idx on public.contactos (organizacion_id, estado);

-- Oportunidades: order by created_at desc, id. (El filtro por estado ya lo cubre
-- oportunidades_estado_idx de la 0007, y el de etapa oportunidades_etapa_id_idx de la 0001.)
create index if not exists oportunidades_org_creada_idx on public.oportunidades (organizacion_id, created_at desc, id);

-- Ventas: order by fecha desc, created_at desc, id, y el rango de fechas.
create index if not exists ventas_org_fecha_idx on public.ventas (organizacion_id, fecha desc, created_at desc, id);

-- Usuarios: order by nombre, id dentro de la organizacion.
create index if not exists perfiles_org_nombre_idx on public.perfiles (organizacion_id, nombre, id);

-- Productos: no hace falta ninguno, la restriccion unique (organizacion_id, nombre) de la 0004
-- ya es el indice del `order by nombre`.

-- ============================================================
-- 2) TRIGRAMAS - BLOQUE OPCIONAL (pg_trgm)
-- ============================================================
-- Hace usable el `ilike '%texto%'` de los buscadores con mucho volumen.
--
-- pg_trgm viene con Supabase: se activa con `create extension` (en el esquema
-- `extensions`, que ya esta en el search_path de la base y del SQL Editor, por
-- eso los indices llaman a `gin_trgm_ops` sin esquema). Si el entorno no la
-- tiene (un Postgres pelado, el arnes de pruebas con PGlite), borrar o
-- comentar TODO lo que hay entre los dos marcadores: el resto de la migracion
-- no depende de este bloque.

-- ===========================================================================
-- OPCIONAL: PG_TRGM (apagado). Lo de abajo, entre >>> y <<<, esta COMENTADO a proposito.
-- Hace falta solo con decenas de miles de filas (acelera el ilike '%texto%' de los
-- buscadores). Con el volumen de un CRM chico no se nota. La app anda igual sin esto.
-- Para encenderlo: en las lineas entre >>> y <<<, sacale el '-- ' del principio y
-- ejecuta el archivo ENTERO de nuevo (es idempotente: lo ya aplicado no cambia).
-- ===========================================================================
-- >>> BLOQUE OPCIONAL: PG_TRGM
-- create extension if not exists pg_trgm with schema extensions;

-- create index if not exists empresas_nombre_trgm_idx on public.empresas using gin (nombre gin_trgm_ops);
-- create index if not exists empresas_email_trgm_idx on public.empresas using gin (email gin_trgm_ops);
-- create index if not exists empresas_cuit_trgm_idx on public.empresas using gin (cuit gin_trgm_ops);

-- create index if not exists contactos_nombre_trgm_idx on public.contactos using gin (nombre gin_trgm_ops);
-- create index if not exists contactos_apellido_trgm_idx on public.contactos using gin (apellido gin_trgm_ops);
-- create index if not exists contactos_email_trgm_idx on public.contactos using gin (email gin_trgm_ops);

-- create index if not exists oportunidades_titulo_trgm_idx on public.oportunidades using gin (titulo gin_trgm_ops);

-- create index if not exists productos_nombre_trgm_idx on public.productos using gin (nombre gin_trgm_ops);

-- create index if not exists ventas_comprobante_trgm_idx on public.ventas using gin (comprobante gin_trgm_ops);
-- <<< FIN BLOQUE OPCIONAL: PG_TRGM

-- ===========================================================================
-- <<< fin de 0010_indices_busqueda.sql
-- ===========================================================================

-- ===========================================================================
-- >>> 0011_rubro.sql   (4 de 5)
-- ===========================================================================

-- Tuco & Nito - 0011: FUNCIONES DEL RUBRO (F4)
--
-- Tres piezas que son propias de quien le vende equipamiento deportivo a clubes,
-- complejos, escuelas y predios municipales. Las carga el PROVEEDOR sobre SUS
-- clientes: los clientes no son usuarios del sistema.
--
--   a) `canchas`: la ficha de canchas de una empresa (formato, superficie,
--      cantidad, iluminacion). Sirve para sugerir el equipamiento que le falta.
--      Sigue los permisos y la cartera de la empresa (clientes.ver / editar).
--      Sin DELETE: se da de baja con `activa = false` (baja logica).
--   b) `licitaciones`: los datos de una oportunidad de tipo licitacion
--      (expediente, organismo, fecha de apertura, monto oficial, garantia).
--      Una por oportunidad. Sigue los permisos y la cartera de la oportunidad
--      (oportunidades.ver / editar). Regla nueva: una licitacion NO puede pasar
--      a ganada antes de su fecha de apertura (fecha de Argentina).
--   c) `oportunidades.venta_item_id`: de que equipo entregado sale una
--      oportunidad de recambio (la crea el boton "Crear oportunidad de
--      recambio" de /alertas). Clave foranea compuesta a `venta_items` e indice
--      unico parcial: una sola oportunidad ABIERTA por equipo.
--
-- La regla de la licitacion va en un trigger APARTE sobre `oportunidades`
-- (`oportunidades_licitacion_regla`), sin reescribir `oportunidad_reglas()`
-- (0007/0009): cada regla en su funcion. Calcula el tipo de la etapa por su
-- cuenta, asi no depende de si corre antes o despues de `oportunidades_reglas`.
--
-- Aditiva e idempotente: `create ... if not exists`, `add column if not exists`,
-- `drop ... if exists` + `create`. Se puede volver a correr. Sin BEGIN/COMMIT
-- propios (igual que la 0007 a la 0010), para poder ensayarla en una transaccion.
-- Requiere 0001 a 0010 aplicadas (usa org_actual(), tiene_permiso() y
-- set_updated_at()).
--
-- Despues: correr supabase/tests/0011_rubro.sql.
--
-- COMPATIBILIDAD: la app desplegada antes de esta migracion no se entera (no usa
-- nada de esto). La app de F4 detecta que falta y esconde las secciones nuevas.

-- ============================================================
-- (a) CANCHAS
-- ============================================================
create table if not exists public.canchas (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null default public.org_actual() references public.organizaciones (id) on delete cascade,
  empresa_id uuid not null,
  nombre text not null check (btrim(nombre) <> ''),
  -- F5, F7, F9, F11 y futsal: los formatos con medidas de arco estandar.
  formato text not null check (formato in ('F5', 'F7', 'F9', 'F11', 'futsal')),
  superficie text check (superficie is null or superficie in ('sintetico', 'natural', 'cemento', 'parquet')),
  -- Cuantas canchas iguales representa esta fila ("4 canchas de F5").
  cantidad int not null default 1 check (cantidad >= 1),
  iluminacion boolean not null default false,
  notas text,
  -- Baja logica: una cancha no se borra, se desactiva.
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint canchas_org_id_key unique (organizacion_id, id),
  constraint canchas_empresa_id_fkey
    foreign key (organizacion_id, empresa_id) references public.empresas (organizacion_id, id)
    on delete cascade
);

comment on table public.canchas is
  'Canchas de un cliente (empresa), cargadas por el proveedor. Alimentan la sugerencia de equipamiento.';
comment on column public.canchas.cantidad is
  'Cantidad de canchas iguales que representa la fila (>= 1).';

create index if not exists canchas_organizacion_id_idx on public.canchas (organizacion_id);
create index if not exists canchas_empresa_id_idx on public.canchas (empresa_id);

drop trigger if exists set_canchas_updated_at on public.canchas;
create trigger set_canchas_updated_at
  before update on public.canchas
  for each row execute procedure public.set_updated_at();

-- ============================================================
-- (b) LICITACIONES
-- ============================================================
create table if not exists public.licitaciones (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null default public.org_actual() references public.organizaciones (id) on delete cascade,
  oportunidad_id uuid not null,
  expediente text check (expediente is null or btrim(expediente) <> ''),
  organismo text check (organismo is null or btrim(organismo) <> ''),
  -- Obligatoria: sin ella no se puede juzgar la regla "no ganada antes de la apertura".
  fecha_apertura date not null,
  monto_oficial numeric(14, 2) check (monto_oficial is null or monto_oficial >= 0),
  -- Texto libre: puede ser un monto, un porcentaje ("1% de la oferta") o una poliza.
  garantia text check (garantia is null or btrim(garantia) <> ''),
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint licitaciones_oportunidad_key unique (oportunidad_id),
  constraint licitaciones_org_id_key unique (organizacion_id, id),
  constraint licitaciones_oportunidad_id_fkey
    foreign key (organizacion_id, oportunidad_id) references public.oportunidades (organizacion_id, id)
    on delete cascade
);

comment on table public.licitaciones is
  'Datos de una oportunidad de tipo licitacion (una por oportunidad). La oportunidad no puede ganarse antes de fecha_apertura.';

create index if not exists licitaciones_organizacion_id_idx on public.licitaciones (organizacion_id);

drop trigger if exists set_licitaciones_updated_at on public.licitaciones;
create trigger set_licitaciones_updated_at
  before update on public.licitaciones
  for each row execute procedure public.set_updated_at();

-- ------------------------------------------------------------
-- Regla: una licitacion no puede PASAR a ganada antes de su fecha de apertura.
--
-- - Se juzga solo en la transicion (alta en etapa ganada, o cambio hacia una
--   etapa de tipo ganada desde otro estado). Una licitacion que ya estaba
--   ganada se sigue pudiendo editar.
-- - "Hoy" es la fecha de Argentina, no la del servidor (UTC), igual que la 0009.
-- - Una licitacion sin fila en `licitaciones` tampoco puede ganarse: no hay
--   fecha contra la cual juzgarla.
-- - Rige para todos los caminos (usuario, script, service_role), como las
--   demas reglas de estado y fecha del embudo.
-- - SECURITY INVOKER: lee `etapas` y `licitaciones` con la RLS de quien actualiza;
--   quien puede actualizar la oportunidad puede ver su licitacion.
-- ------------------------------------------------------------
create or replace function public.oportunidad_licitacion_regla()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_tipo_etapa text;
  v_apertura date;
  v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  if new.tipo is distinct from 'licitacion' then
    return new;
  end if;

  select e.tipo into v_tipo_etapa
  from public.etapas e
  where e.id = new.etapa_id and e.organizacion_id = new.organizacion_id;

  -- No va a una etapa ganada (o la etapa no existe: que la rechace la FK).
  if v_tipo_etapa is distinct from 'ganada' then
    return new;
  end if;

  -- Ya estaba ganada: no es una transicion.
  if tg_op = 'UPDATE' and old.estado = 'ganada' then
    return new;
  end if;

  select l.fecha_apertura into v_apertura
  from public.licitaciones l
  where l.oportunidad_id = new.id and l.organizacion_id = new.organizacion_id;

  if not found then
    raise exception 'Una licitación necesita sus datos (al menos la fecha de apertura) antes de poder marcarse como ganada.'
      using errcode = '23514';
  end if;

  if v_apertura > v_hoy then
    raise exception 'No se puede marcar ganada una licitación antes de su apertura (fecha de apertura: %).',
      to_char(v_apertura, 'DD/MM/YYYY')
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists oportunidades_licitacion_regla on public.oportunidades;
create trigger oportunidades_licitacion_regla
  before insert or update of etapa_id, estado, tipo on public.oportunidades
  for each row execute procedure public.oportunidad_licitacion_regla();

-- ============================================================
-- (c) RECAMBIO -> OPORTUNIDAD
--
-- `venta_item_id`: el equipo entregado que origina la oportunidad de recambio.
-- Un equipo puede tener varias oportunidades a lo largo del tiempo (una perdida
-- y otra al ano siguiente), pero SOLO UNA ABIERTA a la vez: lo garantiza el
-- indice unico parcial `oportunidades_venta_item_abierta_key` (parte de esta
-- migracion). Evita el doble clic o dos pestanas creando la misma oportunidad de
-- recambio; la pantalla lo chequea antes solo para dar un mensaje amable. Si el
-- item de venta se borra (se deshace una venta), la oportunidad queda sin vinculo.
-- ============================================================
alter table public.oportunidades add column if not exists venta_item_id uuid;

alter table public.oportunidades drop constraint if exists oportunidades_venta_item_id_fkey;
alter table public.oportunidades add constraint oportunidades_venta_item_id_fkey
  foreign key (organizacion_id, venta_item_id) references public.venta_items (organizacion_id, id)
  on delete set null (venta_item_id);

create index if not exists oportunidades_venta_item_id_idx
  on public.oportunidades (venta_item_id) where venta_item_id is not null;

-- `estado` lo fija el trigger oportunidades_reglas desde el tipo de la etapa: al
-- cerrarse la oportunidad (ganada o perdida) sale del indice y el equipo puede
-- tener otra abierta.
create unique index if not exists oportunidades_venta_item_abierta_key
  on public.oportunidades (organizacion_id, venta_item_id)
  where venta_item_id is not null and estado = 'abierta';

comment on column public.oportunidades.venta_item_id is
  'Equipo entregado (venta_items) del que sale una oportunidad de recambio. Null en las demas.';

-- ============================================================
-- RLS
--
-- Mismo molde que ventas/venta_items (0007): organizacion propia + permiso, y la
-- cartera propia se hereda del padre con una subconsulta a `empresas` /
-- `oportunidades` (que corre con la RLS de quien consulta). Sin politica de
-- DELETE para nadie: baja logica (canchas) o cascada del padre (licitaciones).
-- ============================================================
alter table public.canchas enable row level security;
alter table public.licitaciones enable row level security;

drop policy if exists "ver" on public.canchas;
drop policy if exists "crear" on public.canchas;
drop policy if exists "editar" on public.canchas;
drop policy if exists "borrar" on public.canchas;

create policy "ver" on public.canchas for select to authenticated
  using (organizacion_id = (select public.org_actual()) and (select public.tiene_permiso('clientes.ver'))
         and ((select public.tiene_permiso('clientes.ver_todos'))
              or exists (select 1 from public.empresas e where e.id = canchas.empresa_id)));
create policy "crear" on public.canchas for insert to authenticated
  with check (organizacion_id = (select public.org_actual()) and (select public.tiene_permiso('clientes.editar'))
              and ((select public.tiene_permiso('clientes.ver_todos'))
                   or exists (select 1 from public.empresas e where e.id = canchas.empresa_id)));
create policy "editar" on public.canchas for update to authenticated
  using (organizacion_id = (select public.org_actual()) and (select public.tiene_permiso('clientes.editar'))
         and ((select public.tiene_permiso('clientes.ver_todos'))
              or exists (select 1 from public.empresas e where e.id = canchas.empresa_id)))
  with check (organizacion_id = (select public.org_actual()) and (select public.tiene_permiso('clientes.editar'))
              and ((select public.tiene_permiso('clientes.ver_todos'))
                   or exists (select 1 from public.empresas e where e.id = canchas.empresa_id)));

drop policy if exists "ver" on public.licitaciones;
drop policy if exists "crear" on public.licitaciones;
drop policy if exists "editar" on public.licitaciones;
drop policy if exists "borrar" on public.licitaciones;

create policy "ver" on public.licitaciones for select to authenticated
  using (organizacion_id = (select public.org_actual()) and (select public.tiene_permiso('oportunidades.ver'))
         and ((select public.tiene_permiso('clientes.ver_todos'))
              or exists (select 1 from public.oportunidades o where o.id = licitaciones.oportunidad_id)));
create policy "crear" on public.licitaciones for insert to authenticated
  with check (organizacion_id = (select public.org_actual()) and (select public.tiene_permiso('oportunidades.editar'))
              and ((select public.tiene_permiso('clientes.ver_todos'))
                   or exists (select 1 from public.oportunidades o where o.id = licitaciones.oportunidad_id)));
create policy "editar" on public.licitaciones for update to authenticated
  using (organizacion_id = (select public.org_actual()) and (select public.tiene_permiso('oportunidades.editar'))
         and ((select public.tiene_permiso('clientes.ver_todos'))
              or exists (select 1 from public.oportunidades o where o.id = licitaciones.oportunidad_id)))
  with check (organizacion_id = (select public.org_actual()) and (select public.tiene_permiso('oportunidades.editar'))
              and ((select public.tiene_permiso('clientes.ver_todos'))
                   or exists (select 1 from public.oportunidades o where o.id = licitaciones.oportunidad_id)));

-- ===========================================================================
-- <<< fin de 0011_rubro.sql
-- ===========================================================================

-- ===========================================================================
-- >>> 0012_presupuestos.sql   (5 de 5)
-- ===========================================================================

-- Tuco & Nito - 0012: PRESUPUESTO IMPRIMIBLE (F6)
--
-- Guarda cada presupuesto que el proveedor arma desde una oportunidad
-- (/oportunidades/[id]/presupuesto) para poder numerarlo, listarlo y
-- reimprimirlo.
--
--   a) `presupuestos`: una fila por presupuesto emitido. Lleva su numero
--      correlativo POR ORGANIZACION, las lineas (jsonb), la validez, las
--      condiciones, el total tal como se imprimio y una FOTO del emisor
--      (`condicion_iva` y `emisor`: razon social, CUIT, direccion, telefono,
--      mail y web; no el logo). Es un DOCUMENTO EMITIDO:
--      no se borra (sin politica de DELETE) y no se modifica; corregirlo es
--      armar otro. La unica columna que se completa despues es `actividad_id`
--      (la actividad "Envio de propuesta" que se registra al imprimir), una
--      sola vez.
--   b) `presupuesto_contadores`: el ultimo numero usado por organizacion. Solo
--      lo toca el trigger (SECURITY DEFINER); `authenticated` no tiene
--      acceso ni politicas.
--
-- NUMERACION. El trigger BEFORE INSERT `presupuestos_numero` toma el numero con
-- `insert ... on conflict do update ... returning` sobre el contador de la
-- organizacion. Esa sentencia bloquea la fila del contador hasta el fin de la
-- transaccion, asi que dos altas simultaneas de la misma organizacion se
-- serializan y nunca reciben el mismo numero (el UNIQUE (organizacion_id,
-- numero) es la red de seguridad). Si el alta falla despues (CHECK, RLS, FK) la
-- transaccion revierte tambien el contador, o sea que tampoco deja huecos. El
-- numero que mande el cliente se IGNORA: siempre lo asigna la base.
--
-- Permisos: como licitaciones (0011), siguen a la oportunidad. Ver = quien ve
-- la oportunidad (oportunidades.ver + cartera propia salvo clientes.ver_todos);
-- crear = oportunidades.editar sobre una oportunidad que se ve.
--
-- Aditiva e idempotente: `create ... if not exists`, `drop ... if exists` +
-- `create`. Se puede volver a correr. Sin BEGIN/COMMIT propios (igual que la
-- 0007 a la 0011), para poder ensayarla en una transaccion. Requiere 0001 a
-- 0011 aplicadas (usa org_actual(), tiene_permiso(), bitacora_entradas y
-- oportunidades).
--
-- Despues: correr supabase/tests/0012_presupuestos.sql.
--
-- COMPATIBILIDAD: la app desplegada antes de esta migracion no se entera (no usa
-- nada de esto). La app de F6 detecta que falta (`esErrorDeEsquema`): el
-- presupuesto se puede armar e imprimir como "Borrador", pero no se guarda.

-- ============================================================
-- (b) CONTADORES (primero: el trigger de (a) los usa)
-- ============================================================
create table if not exists public.presupuesto_contadores (
  organizacion_id uuid primary key references public.organizaciones (id) on delete cascade,
  ultimo int not null default 0 check (ultimo >= 0)
);

comment on table public.presupuesto_contadores is
  'Ultimo numero de presupuesto asignado por organizacion. Lo escribe solo el trigger presupuestos_numero.';

-- RLS prendida y SIN politicas, y sin privilegios: nadie la lee ni la escribe
-- desde la API. El trigger corre como su duenio (SECURITY DEFINER).
alter table public.presupuesto_contadores enable row level security;
revoke all on public.presupuesto_contadores from anon, authenticated;

-- ============================================================
-- (a) PRESUPUESTOS
-- ============================================================

-- La clave foranea compuesta de `actividad_id` necesita este UNIQUE en el destino
-- (bitacora_entradas todavia no lo tenia: nadie la referenciaba).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bitacora_entradas_org_id_key') then
    alter table public.bitacora_entradas add constraint bitacora_entradas_org_id_key unique (organizacion_id, id);
  end if;
end $$;

create table if not exists public.presupuestos (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null default public.org_actual() references public.organizaciones (id) on delete cascade,
  oportunidad_id uuid not null,
  -- Lo asigna el trigger (que pisa este 0 y cualquier valor del cliente). El DEFAULT 0 existe para que
  -- el INSERT sin numero llegue al trigger; sin el trigger, el CHECK rechaza el 0.
  numero int not null default 0 check (numero > 0),
  -- Fecha de emision (Argentina). La validez corre desde aca.
  fecha date not null default ((now() at time zone 'America/Argentina/Buenos_Aires')::date),
  validez_dias int not null default 15 check (validez_dias between 1 and 365),
  condiciones text check (condiciones is null or char_length(condiciones) <= 2000),
  -- [{ producto_id?, descripcion, cantidad, precio_unitario, descuento_pct }]
  lineas jsonb not null default '[]'::jsonb
    check (jsonb_typeof(lineas) = 'array' and jsonb_array_length(lineas) <= 200),
  notas text check (notas is null or char_length(notas) <= 2000),
  -- Total impreso (con IVA si el proveedor es Responsable Inscripto). Lo calcula la
  -- app con src/lib/presupuesto.ts; la base solo exige que no sea negativo.
  total numeric(14, 2) not null default 0 check (total >= 0),
  -- Siempre el usuario que guarda (el trigger lo fuerza si hay usuario).
  creado_por uuid default auth.uid() references public.perfiles (id) on delete set null,
  -- Foto del emisor al emitir: la condicion frente al IVA y sus datos (razon social, CUIT, direccion,
  -- telefono, mail y sitio web; NO el logo). Reimprimir usa esto, no lo que la organizacion tenga hoy:
  -- si el proveedor cambia de condicion o de domicilio, un presupuesto ya emitido no cambia de total.
  condicion_iva text check (condicion_iva is null or condicion_iva in ('responsable_inscripto', 'monotributo', 'exento')),
  emisor jsonb not null default '{}'::jsonb check (jsonb_typeof(emisor) = 'object'),
  created_at timestamptz not null default now(),
  -- La actividad "Envio de propuesta" que se registro al imprimir; null = todavia no.
  actividad_id uuid,
  constraint presupuestos_org_id_key unique (organizacion_id, id),
  constraint presupuestos_numero_key unique (organizacion_id, numero),
  -- Sin `on delete`: una oportunidad no se borra, y al borrar la organizacion entera
  -- la cascada de `organizacion_id` se lleva los dos lados en la misma sentencia.
  constraint presupuestos_oportunidad_id_fkey
    foreign key (organizacion_id, oportunidad_id) references public.oportunidades (organizacion_id, id),
  constraint presupuestos_actividad_id_fkey
    foreign key (organizacion_id, actividad_id) references public.bitacora_entradas (organizacion_id, id)
    on delete set null (actividad_id)
);

comment on table public.presupuestos is
  'Presupuestos emitidos desde una oportunidad. Numerados por organizacion, inmutables, sin borrado.';
comment on column public.presupuestos.numero is
  'Correlativo por organizacion (1, 2, 3...). Lo asigna el trigger presupuestos_numero; se imprime con ceros a la izquierda.';
comment on column public.presupuestos.emisor is
  'Foto del emisor al emitir: razon_social, cuit, direccion, telefono, email, sitio_web. Sin el logo (se lee de la organizacion).';
comment on column public.presupuestos.actividad_id is
  'Actividad "Envio de propuesta" registrada al imprimir. Se completa una sola vez; es lo unico que cambia en un presupuesto.';

create index if not exists presupuestos_oportunidad_idx on public.presupuestos (oportunidad_id, numero desc);

-- ------------------------------------------------------------
-- Numero correlativo por organizacion
-- ------------------------------------------------------------
create or replace function public.presupuesto_asignar_numero()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.presupuesto_contadores as c (organizacion_id, ultimo)
  values (new.organizacion_id, 1)
  on conflict (organizacion_id) do update set ultimo = c.ultimo + 1
  returning c.ultimo into new.numero;
  -- Quien guarda es quien figura como autor, y la actividad se vincula despues (nunca al alta).
  if auth.uid() is not null then
    new.creado_por := auth.uid();
  end if;
  new.actividad_id := null;
  return new;
end;
$$;

revoke execute on function public.presupuesto_asignar_numero() from public, anon, authenticated;

drop trigger if exists presupuestos_numero on public.presupuestos;
create trigger presupuestos_numero
  before insert on public.presupuestos
  for each row execute procedure public.presupuesto_asignar_numero();

-- ------------------------------------------------------------
-- Un presupuesto emitido no se modifica. Lo unico que cambia es `actividad_id`,
-- una sola vez (o vuelve a nulo si borran esa actividad). Rige para todos los caminos
-- (usuario, script, service_role).
-- ------------------------------------------------------------
-- SECURITY DEFINER: mira si la actividad existe sin que la RLS de quien actualiza se lo esconda.
create or replace function public.presupuesto_proteger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (to_jsonb(new) - 'actividad_id') is distinct from (to_jsonb(old) - 'actividad_id') then
    raise exception 'Un presupuesto emitido no se modifica: armá uno nuevo.' using errcode = '23514';
  end if;
  -- Excepcion: si la actividad vinculada se borro, la clave foranea (on delete set null) tiene que poder
  -- soltarla. Se reconoce porque el vinculo pasa a nulo y la actividad ya no existe.
  if old.actividad_id is not null and new.actividad_id is null
     and not exists (select 1 from public.bitacora_entradas b where b.id = old.actividad_id) then
    return new;
  end if;
  if old.actividad_id is not null and new.actividad_id is distinct from old.actividad_id then
    raise exception 'La actividad de este presupuesto ya está registrada.' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke execute on function public.presupuesto_proteger() from public, anon, authenticated;

drop trigger if exists presupuestos_proteger on public.presupuestos;
create trigger presupuestos_proteger
  before update on public.presupuestos
  for each row execute procedure public.presupuesto_proteger();

-- ============================================================
-- RLS
--
-- Mismo molde que licitaciones (0011): organizacion propia + permiso, y la
-- cartera propia se hereda de la oportunidad con una subconsulta (que corre con
-- la RLS de quien consulta). SIN politica de DELETE para nadie.
-- ============================================================
alter table public.presupuestos enable row level security;

drop policy if exists "ver" on public.presupuestos;
drop policy if exists "crear" on public.presupuestos;
drop policy if exists "editar" on public.presupuestos;
drop policy if exists "borrar" on public.presupuestos;

create policy "ver" on public.presupuestos for select to authenticated
  using (organizacion_id = (select public.org_actual()) and (select public.tiene_permiso('oportunidades.ver'))
         and ((select public.tiene_permiso('clientes.ver_todos'))
              or exists (select 1 from public.oportunidades o where o.id = presupuestos.oportunidad_id)));
create policy "crear" on public.presupuestos for insert to authenticated
  with check (organizacion_id = (select public.org_actual()) and (select public.tiene_permiso('oportunidades.editar'))
              and ((select public.tiene_permiso('clientes.ver_todos'))
                   or exists (select 1 from public.oportunidades o where o.id = presupuestos.oportunidad_id)));
-- La politica de editar existe solo para completar `actividad_id`; el trigger
-- presupuestos_proteger rechaza cualquier otro cambio.
create policy "editar" on public.presupuestos for update to authenticated
  using (organizacion_id = (select public.org_actual()) and (select public.tiene_permiso('oportunidades.editar'))
         and ((select public.tiene_permiso('clientes.ver_todos'))
              or exists (select 1 from public.oportunidades o where o.id = presupuestos.oportunidad_id)))
  with check (organizacion_id = (select public.org_actual()) and (select public.tiene_permiso('oportunidades.editar'))
              and ((select public.tiene_permiso('clientes.ver_todos'))
                   or exists (select 1 from public.oportunidades o where o.id = presupuestos.oportunidad_id)));

-- ===========================================================================
-- <<< fin de 0012_presupuestos.sql
-- ===========================================================================

-- ===========================================================================
-- VERIFICACION: una fila por pieza. Todo tiene que decir OK; la ultima fila resume.
-- Si algo dice FALTA, mira supabase/aplicar/LEEME.md ("Si algo falla").
-- ===========================================================================

with v(paso, migracion, verificacion, ok) as (
  values
    (1, '0008', 'empresas: ya no hay política de borrado (baja lógica garantizada)', (not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'empresas' and policyname = 'borrar'))),
    (2, '0008', 'contactos: ya no hay política de borrado (baja lógica garantizada)', (not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'contactos' and policyname = 'borrar'))),
    (3, '0008', 'etapas: trigger que conserva una etapa ganada y una perdida', (exists (select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'etapas' and t.tgname = 'etapas_conservar_cierres' and not t.tgisinternal))),
    (4, '0009', 'oportunidades: trigger «empresa o contacto obligatorio»', (exists (select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'oportunidades' and t.tgname = 'oportunidades_requiere_cliente' and not t.tgisinternal))),
    (5, '0009', 'oportunidades: la regla de cierre rechaza la fecha futura', (coalesce((select pg_get_functiondef(p.oid) ilike '%no puede ser futura%' from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'oportunidad_reglas' limit 1), false))),
    (6, '0010', 'índice de empresas por nombre', (exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'empresas_org_nombre_idx'))),
    (7, '0010', 'índice de empresas por estado', (exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'empresas_org_estado_idx'))),
    (8, '0010', 'índice de contactos por nombre', (exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'contactos_org_nombre_idx'))),
    (9, '0010', 'índice de contactos por estado', (exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'contactos_org_estado_idx'))),
    (10, '0010', 'índice de oportunidades por fecha de alta', (exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'oportunidades_org_creada_idx'))),
    (11, '0010', 'índice de ventas por fecha', (exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'ventas_org_fecha_idx'))),
    (12, '0010', 'índice de usuarios por nombre', (exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'perfiles_org_nombre_idx'))),
    (13, '0011', 'tabla canchas, con RLS', (to_regclass('public.canchas') is not null and coalesce((select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'canchas'), false))),
    (14, '0011', 'tabla licitaciones, con RLS', (to_regclass('public.licitaciones') is not null and coalesce((select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'licitaciones'), false))),
    (15, '0011', 'canchas y licitaciones: políticas de lectura', (exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'canchas' and policyname = 'ver') and exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'licitaciones' and policyname = 'ver'))),
    (16, '0011', 'oportunidades: columna venta_item_id (recambio en 1 clic)', (exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'oportunidades' and column_name = 'venta_item_id'))),
    (17, '0011', 'oportunidades: una sola abierta por equipo (índice único parcial)', (exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'oportunidades_venta_item_abierta_key'))),
    (18, '0011', 'oportunidades: trigger «una licitación no se gana antes de su apertura»', (exists (select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'oportunidades' and t.tgname = 'oportunidades_licitacion_regla' and not t.tgisinternal))),
    (19, '0012', 'tabla presupuestos, con RLS', (to_regclass('public.presupuestos') is not null and coalesce((select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'presupuestos'), false))),
    (20, '0012', 'tabla presupuesto_contadores (numeración por organización)', (to_regclass('public.presupuesto_contadores') is not null)),
    (21, '0012', 'presupuestos: trigger que asigna el número', (exists (select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'presupuestos' and t.tgname = 'presupuestos_numero' and not t.tgisinternal))),
    (22, '0012', 'presupuestos: trigger que impide modificarlos', (exists (select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'presupuestos' and t.tgname = 'presupuestos_proteger' and not t.tgisinternal))),
    (23, '0012', 'presupuestos: política de lectura', (exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'presupuestos' and policyname = 'ver'))),
    (24, '0012', 'función que asigna el número de presupuesto', (exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'presupuesto_asignar_numero')))
)
select paso, migracion, verificacion, case when ok then 'OK' else 'FALTA' end as estado
from v
union all
select 1000, 'TOTAL', 'pg_trgm (OPCIONAL): ' || case when exists (select 1 from pg_extension where extname = 'pg_trgm') then 'activo' else 'apagado' end,
       case when bool_and(ok) then 'TODO OK' else 'HAY ' || count(*) filter (where not ok) || ' FALTANTES' end
from v
order by paso;
