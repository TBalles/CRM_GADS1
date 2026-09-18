-- Tuco & Nito - ampliacion: ABM de productos con vida util, historial de
-- compras, alertas de recambio y bitacora de clientes.
--
-- Ejecutar en el SQL Editor de Supabase (o via `supabase db push`).
-- Es puramente aditivo: no borra ni altera datos existentes.

-- ============================================================
-- 1. PRODUCTOS
--
-- La tabla ya existia (precargada por seed, sin ABM). Se le agrega la
-- duracion estimada de vida util, que es el dato del que sale toda la
-- seccion de alertas, y se abre la RLS a escritura para que exista el ABM.
-- ============================================================
alter table public.productos
  add column if not exists vida_util_meses int
    check (vida_util_meses is null or vida_util_meses > 0),
  add column if not exists marca text;

comment on column public.productos.vida_util_meses is
  'Duracion estimada en meses. Null = no se le hace seguimiento de recambio.';

-- La politica vieja era solo de lectura; el ABM necesita insert/update/delete.
drop policy if exists "Usuarios autenticados leen productos" on public.productos;
create policy "Usuarios autenticados gestionan productos" on public.productos
  for all to authenticated using (true) with check (true);

-- ============================================================
-- 2. VENTAS  (el historial de compras que no existia)
--
-- `oportunidades` es el EMBUDO comercial: algo que todavia puede cerrarse o
-- perderse. Una venta es un hecho consumado, y es lo unico desde donde se
-- puede contar la vida util de un equipo entregado. Son dos cosas distintas
-- y por eso son dos tablas distintas.
-- ============================================================
create table if not exists public.ventas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  contacto_id uuid references public.contactos (id) on delete set null,
  oportunidad_id uuid references public.oportunidades (id) on delete set null,
  fecha date not null default current_date,
  comprobante text,
  notas text,
  created_at timestamptz not null default now()
);

create index if not exists ventas_empresa_id_idx on public.ventas (empresa_id);
create index if not exists ventas_fecha_idx on public.ventas (fecha desc);

-- ------------------------------------------------------------
-- Items de la venta.
--
-- `vida_util_meses` se COPIA del producto al momento de vender en lugar de
-- leerse por join. Si manana el catalogo cambia la vida util de un arco de
-- 24 a 36 meses, los arcos ya entregados tienen que seguir venciendo con el
-- valor que se le prometio al cliente. Un join daria la respuesta de hoy a
-- una pregunta del pasado.
--
-- `fecha_entrega` tambien es propia del item: en una misma venta puede
-- entregarse una parte hoy y el resto el mes que viene, y el reloj de la vida
-- util arranca cuando el equipo llega a la cancha, no cuando se factura.
-- ------------------------------------------------------------
create table if not exists public.venta_items (
  id uuid primary key default gen_random_uuid(),
  venta_id uuid not null references public.ventas (id) on delete cascade,
  producto_id uuid not null references public.productos (id) on delete restrict,
  cantidad int not null default 1 check (cantidad > 0),
  precio_unitario numeric(12, 2),
  fecha_entrega date,
  vida_util_meses int check (vida_util_meses is null or vida_util_meses > 0),
  created_at timestamptz not null default now()
);

create index if not exists venta_items_venta_id_idx on public.venta_items (venta_id);
create index if not exists venta_items_producto_id_idx on public.venta_items (producto_id);

comment on column public.venta_items.vida_util_meses is
  'Snapshot de productos.vida_util_meses al momento de la venta. No es un join a proposito.';

-- Si el item no trae vida util o fecha propia, se heredan del catalogo y de
-- la venta al insertar.
-- SECURITY INVOKER (el default) a proposito: el trigger lee `productos` y
-- `ventas` con los permisos de quien inserta, que ya puede leerlas por RLS. Con
-- SECURITY DEFINER leeria como el dueño, salteando la RLS: hoy daria lo mismo,
-- pero el dia que se ajusten los permisos seria un agujero esperando.
create or replace function public.venta_items_defaults()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.vida_util_meses is null then
    select p.vida_util_meses into new.vida_util_meses
    from public.productos p where p.id = new.producto_id;
  end if;

  if new.fecha_entrega is null then
    select v.fecha into new.fecha_entrega
    from public.ventas v where v.id = new.venta_id;
  end if;

  return new;
end;
$$;

drop trigger if exists set_venta_items_defaults on public.venta_items;
create trigger set_venta_items_defaults
  before insert on public.venta_items
  for each row execute procedure public.venta_items_defaults();

-- ============================================================
-- 3. BITACORA DE CLIENTES
--
-- Cada interaccion con un cliente: lo que se charlo, lo que consulto, una
-- queja, una observacion. Es un LOG: se agrega, no se corrige el pasado.
-- ============================================================
create table if not exists public.bitacora_entradas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  contacto_id uuid references public.contactos (id) on delete set null,
  tipo text not null default 'nota'
    check (tipo in ('llamada', 'reunion', 'email', 'whatsapp', 'consulta', 'queja', 'nota')),
  titulo text not null,
  detalle text,
  autor_id uuid references public.perfiles (id) on delete set null,
  ocurrido_en timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists bitacora_empresa_id_idx
  on public.bitacora_entradas (empresa_id, ocurrido_en desc);

-- ============================================================
-- 4. ALERTAS ENVIADAS
--
-- Solo se persiste lo que YA SE MANDO. Las alertas pendientes no se guardan:
-- se calculan (ver la vista de abajo). Una tabla de pendientes habria que
-- mantenerla sincronizada con un cron y podria quedar desactualizada; una
-- vista siempre dice la verdad de hoy sin ningun job corriendo.
-- ============================================================
create table if not exists public.alertas_enviadas (
  id uuid primary key default gen_random_uuid(),
  venta_item_id uuid not null references public.venta_items (id) on delete cascade,
  canal text not null check (canal in ('email', 'whatsapp')),
  destinatario text not null,
  mensaje text,
  enviado_por uuid references public.perfiles (id) on delete set null,
  enviado_at timestamptz not null default now()
);

create index if not exists alertas_enviadas_item_idx
  on public.alertas_enviadas (venta_item_id, enviado_at desc);

-- ============================================================
-- 5. VISTA DE ALERTAS DE VIDA UTIL
--
-- `security_invoker` hace que la vista se evalue con los permisos de quien
-- consulta, no del dueno. Sin esto una vista es un agujero que saltea la RLS
-- de las tablas que lee.
-- ============================================================
create or replace view public.alertas_vida_util
with (security_invoker = on) as
select
  vi.id                                   as venta_item_id,
  v.id                                    as venta_id,
  v.fecha                                 as venta_fecha,
  e.id                                    as empresa_id,
  e.nombre                                as empresa_nombre,
  e.email                                 as empresa_email,
  e.telefono                              as empresa_telefono,
  c.id                                    as contacto_id,
  nullif(trim(coalesce(c.nombre, '') || ' ' || coalesce(c.apellido, '')), '')
                                          as contacto_nombre,
  c.email                                 as contacto_email,
  c.telefono                              as contacto_telefono,
  p.id                                    as producto_id,
  p.nombre                                as producto_nombre,
  vi.cantidad,
  vi.fecha_entrega,
  vi.vida_util_meses,
  (vi.fecha_entrega + make_interval(months => vi.vida_util_meses))::date
                                          as vence_el,
  ((vi.fecha_entrega + make_interval(months => vi.vida_util_meses))::date
     - current_date)                      as dias_restantes,
  case
    when (vi.fecha_entrega + make_interval(months => vi.vida_util_meses))::date <= current_date
      then 'vencido'
    else 'por_vencer'
  end                                     as estado,
  ae.enviado_at                           as ultimo_envio,
  ae.canal                                as ultimo_canal
from public.venta_items vi
  join public.ventas    v on v.id = vi.venta_id
  join public.empresas  e on e.id = v.empresa_id
  join public.productos p on p.id = vi.producto_id
  left join public.contactos c on c.id = v.contacto_id
  -- Ultimo envio por item, para no volver a avisar lo mismo la semana que viene.
  left join lateral (
    select a.enviado_at, a.canal
    from public.alertas_enviadas a
    where a.venta_item_id = vi.id
    order by a.enviado_at desc
    limit 1
  ) ae on true
where vi.vida_util_meses is not null
  and vi.fecha_entrega is not null
  -- Entra en la lista desde 60 dias antes de vencer.
  and (vi.fecha_entrega + make_interval(months => vi.vida_util_meses))::date
      <= current_date + 60;

comment on view public.alertas_vida_util is
  'Equipos entregados que llegaron (o estan por llegar) al fin de su vida util. Se calcula en vivo, no se persiste.';

-- ============================================================
-- 6. RLS
--
-- Mismo criterio que el esquema inicial: todo el equipo interno autenticado
-- lee y escribe. El alcance no pide roles diferenciados.
-- ============================================================
alter table public.ventas             enable row level security;
alter table public.venta_items        enable row level security;
alter table public.bitacora_entradas  enable row level security;
alter table public.alertas_enviadas   enable row level security;

drop policy if exists "Usuarios autenticados gestionan ventas" on public.ventas;
create policy "Usuarios autenticados gestionan ventas" on public.ventas
  for all to authenticated using (true) with check (true);

drop policy if exists "Usuarios autenticados gestionan venta_items" on public.venta_items;
create policy "Usuarios autenticados gestionan venta_items" on public.venta_items
  for all to authenticated using (true) with check (true);

drop policy if exists "Usuarios autenticados gestionan bitacora" on public.bitacora_entradas;
create policy "Usuarios autenticados gestionan bitacora" on public.bitacora_entradas
  for all to authenticated using (true) with check (true);

drop policy if exists "Usuarios autenticados gestionan alertas_enviadas" on public.alertas_enviadas;
create policy "Usuarios autenticados gestionan alertas_enviadas" on public.alertas_enviadas
  for all to authenticated using (true) with check (true);
