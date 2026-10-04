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
