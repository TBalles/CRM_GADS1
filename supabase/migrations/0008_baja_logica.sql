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
