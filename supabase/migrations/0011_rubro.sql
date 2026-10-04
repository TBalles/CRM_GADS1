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
