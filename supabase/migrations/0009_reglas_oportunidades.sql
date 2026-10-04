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
