-- CRM GADS1 - esquema inicial
-- Ejecutar en el SQL Editor de Supabase (o via `supabase db push`).

create extension if not exists "pgcrypto";

-- ============================================================
-- perfiles: espejo liviano de auth.users para poder mostrar
-- nombre/email como responsable de una oportunidad sin exponer
-- la tabla auth.users directamente.
-- ============================================================
create table if not exists public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text,
  email text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.perfiles (id, nombre, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'nombre', new.email), new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- Empresas (clubes, canchas, complejos, escuelas de fútbol)
-- ============================================================
create table if not exists public.empresas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  cuit text,
  telefono text,
  email text,
  direccion text,
  notas text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Contactos, relacionados opcionalmente a una empresa
-- ============================================================
create table if not exists public.contactos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas (id) on delete set null,
  nombre text not null,
  apellido text,
  email text,
  telefono text,
  cargo text,
  notas text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Productos / servicios (precargados via seed, sin ABM propio
-- todavia)
-- ============================================================
create table if not exists public.productos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  descripcion text,
  precio numeric(12, 2),
  categoria text,
  activo boolean not null default true
);

-- ============================================================
-- Etapas del embudo comercial (precargadas via seed)
-- ============================================================
create table if not exists public.etapas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  orden int not null unique,
  color text
);

-- ============================================================
-- Oportunidades
-- ============================================================
create table if not exists public.oportunidades (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  empresa_id uuid references public.empresas (id) on delete set null,
  contacto_id uuid references public.contactos (id) on delete set null,
  producto_id uuid references public.productos (id) on delete set null,
  responsable_id uuid references public.perfiles (id) on delete set null,
  etapa_id uuid not null references public.etapas (id),
  monto numeric(12, 2),
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists oportunidades_etapa_id_idx on public.oportunidades (etapa_id);
create index if not exists oportunidades_empresa_id_idx on public.oportunidades (empresa_id);
create index if not exists oportunidades_contacto_id_idx on public.oportunidades (contacto_id);
create index if not exists contactos_empresa_id_idx on public.contactos (empresa_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_oportunidades_updated_at on public.oportunidades;
create trigger set_oportunidades_updated_at
  before update on public.oportunidades
  for each row execute procedure public.set_updated_at();

-- ============================================================
-- Row Level Security
--
-- El alcance de esta entrega no pide manejo de roles/permisos,
-- asi que se usa una politica simple: cualquier usuario
-- autenticado (todo el equipo interno) puede leer y escribir.
-- ============================================================
alter table public.perfiles enable row level security;
alter table public.empresas enable row level security;
alter table public.contactos enable row level security;
alter table public.productos enable row level security;
alter table public.etapas enable row level security;
alter table public.oportunidades enable row level security;

create policy "Usuarios autenticados leen perfiles" on public.perfiles
  for select to authenticated using (true);

create policy "Usuarios autenticados gestionan empresas" on public.empresas
  for all to authenticated using (true) with check (true);

create policy "Usuarios autenticados gestionan contactos" on public.contactos
  for all to authenticated using (true) with check (true);

create policy "Usuarios autenticados leen productos" on public.productos
  for select to authenticated using (true);

create policy "Usuarios autenticados leen etapas" on public.etapas
  for select to authenticated using (true);

create policy "Usuarios autenticados gestionan oportunidades" on public.oportunidades
  for all to authenticated using (true) with check (true);
