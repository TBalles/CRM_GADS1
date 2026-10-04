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

-- >>> BLOQUE OPCIONAL: PG_TRGM
create extension if not exists pg_trgm with schema extensions;

create index if not exists empresas_nombre_trgm_idx on public.empresas using gin (nombre gin_trgm_ops);
create index if not exists empresas_email_trgm_idx on public.empresas using gin (email gin_trgm_ops);
create index if not exists empresas_cuit_trgm_idx on public.empresas using gin (cuit gin_trgm_ops);

create index if not exists contactos_nombre_trgm_idx on public.contactos using gin (nombre gin_trgm_ops);
create index if not exists contactos_apellido_trgm_idx on public.contactos using gin (apellido gin_trgm_ops);
create index if not exists contactos_email_trgm_idx on public.contactos using gin (email gin_trgm_ops);

create index if not exists oportunidades_titulo_trgm_idx on public.oportunidades using gin (titulo gin_trgm_ops);

create index if not exists productos_nombre_trgm_idx on public.productos using gin (nombre gin_trgm_ops);

create index if not exists ventas_comprobante_trgm_idx on public.ventas using gin (comprobante gin_trgm_ops);
-- <<< FIN BLOQUE OPCIONAL: PG_TRGM
