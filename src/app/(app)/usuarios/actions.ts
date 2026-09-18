"use server";

import { revalidatePath } from "next/cache";
import { getSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, SIN_SERVICE_ROLE } from "@/lib/supabase/admin";
import { crearUsuario, enviarActivacion, validarAlta, type ResultadoCuenta } from "@/lib/cuentas";
import { conDependencias, esPermiso } from "@/lib/permisos";

/**
 * Administracion de usuarios y roles DE LA PROPIA ORGANIZACION.
 *
 * Cada accion verifica en el servidor, antes de tocar nada:
 *   1. que quien pide tenga `usuarios.gestionar` en una organizacion activa;
 *   2. que el usuario o rol destino sea de SU MISMA organizacion (el id viene
 *      del navegador y se puede falsificar);
 *   3. que no se este quitando permisos a si mismo: asi la organizacion nunca
 *      queda sin alguien que la administre.
 *
 * Los ROLES se escriben con el cliente de sesion, asi que ademas los frena la
 * RLS (no deja tocar el rol Administrador ni roles de otra organizacion). Los
 * PERFILES no tienen politica de update: esos cambios van con el cliente
 * admin, despues de estos chequeos.
 */

type Resultado = ResultadoCuenta;
const NO_AUTORIZADO: Resultado = { ok: false, error: "No tenés permiso para hacer esto." };

async function contexto() {
  const sesion = await getSesion();
  const orgId = sesion?.perfil?.organizacion_id;
  if (!sesion?.puede("usuarios.gestionar") || !orgId) return null;
  return { sesion, orgId, admin: createAdminClient() };
}

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

/** Trae al usuario destino SOLO si es de la organizacion de quien pide. */
async function usuarioDeMiOrg(admin: Admin, orgId: string, id: unknown) {
  if (typeof id !== "string") return null;
  const { data } = await admin
    .from("perfiles")
    .select("id, nombre, email, organizacion_id, rol_id, activo, activado_at")
    .eq("id", id)
    .eq("organizacion_id", orgId)
    .maybeSingle();
  return data;
}

/** El rol existe y es de la organizacion de quien pide. */
async function rolDeMiOrg(admin: Admin, orgId: string, id: unknown) {
  if (typeof id !== "string") return null;
  const { data } = await admin
    .from("roles")
    .select("id, nombre, es_admin, permisos")
    .eq("id", id)
    .eq("organizacion_id", orgId)
    .maybeSingle();
  return data;
}

// ── Usuarios ────────────────────────────────────────────────────────────────

export async function invitarUsuario(input: { nombre: unknown; email: unknown; rolId: unknown }): Promise<Resultado> {
  const ctx = await contexto();
  if (!ctx) return NO_AUTORIZADO;
  if (!ctx.admin) return { ok: false, error: SIN_SERVICE_ROLE };

  const datos = validarAlta(input);
  if (!datos.ok) return datos;
  if (!(await rolDeMiOrg(ctx.admin, ctx.orgId, datos.valor.rolId))) return { ok: false, error: "Elegí un rol válido." };

  const res = await crearUsuario({ ...datos.valor, organizacionId: ctx.orgId });
  if (res.ok) revalidatePath("/usuarios");
  return res;
}

export async function cambiarRol(input: { id: unknown; rolId: unknown }): Promise<Resultado> {
  const ctx = await contexto();
  if (!ctx) return NO_AUTORIZADO;
  if (!ctx.admin) return { ok: false, error: SIN_SERVICE_ROLE };

  const [destino, rol] = await Promise.all([
    usuarioDeMiOrg(ctx.admin, ctx.orgId, input.id),
    rolDeMiOrg(ctx.admin, ctx.orgId, input.rolId),
  ]);
  if (!destino || !rol) return NO_AUTORIZADO;
  if (destino.id === ctx.sesion.user.id) {
    return { ok: false, error: "No podés cambiar tu propio rol. Pedíselo a otro administrador." };
  }

  const { error } = await ctx.admin.from("perfiles").update({ rol_id: rol.id }).eq("id", destino.id);
  if (error) return { ok: false, error: "No se pudo cambiar el rol." };
  // app_metadata en sync con el perfil (el perfil es la fuente de verdad para
  // la RLS; esto es para que no diverjan si alguien mira Auth).
  await ctx.admin.auth.admin.updateUserById(destino.id, {
    app_metadata: { organizacion_id: ctx.orgId, rol_id: rol.id },
  });

  revalidatePath("/usuarios");
  return { ok: true };
}

/**
 * Dar de baja / reactivar. La baja es doble: `perfiles.activo = false` corta el
 * acceso a los datos AL INSTANTE (la base lo mira en cada consulta, aunque la
 * sesion siga abierta) y el ban en Auth impide volver a iniciar sesion.
 */
export async function cambiarActivo(input: { id: unknown; activo: unknown }): Promise<Resultado> {
  const ctx = await contexto();
  if (!ctx) return NO_AUTORIZADO;
  if (!ctx.admin) return { ok: false, error: SIN_SERVICE_ROLE };
  if (typeof input.activo !== "boolean") return { ok: false, error: "Dato inválido." };

  const destino = await usuarioDeMiOrg(ctx.admin, ctx.orgId, input.id);
  if (!destino) return NO_AUTORIZADO;
  if (destino.id === ctx.sesion.user.id) return { ok: false, error: "No podés darte de baja a vos mismo." };

  const { error } = await ctx.admin.from("perfiles").update({ activo: input.activo }).eq("id", destino.id);
  if (error) return { ok: false, error: "No se pudo actualizar el usuario." };
  await ctx.admin.auth.admin.updateUserById(destino.id, {
    ban_duration: input.activo ? "none" : "876000h",
  });

  revalidatePath("/usuarios");
  return { ok: true };
}

/**
 * Reenvia la invitacion a una cuenta pendiente. Si no hay SMTP, devuelve el
 * link: ACA si se puede mostrar, porque quien lo ve es un administrador
 * verificado de la misma organizacion (en el login publico no; ver
 * login/actions.ts).
 */
export async function reenviarInvitacion(input: { id: unknown }): Promise<Resultado> {
  const ctx = await contexto();
  if (!ctx) return NO_AUTORIZADO;
  if (!ctx.admin) return { ok: false, error: SIN_SERVICE_ROLE };

  const destino = await usuarioDeMiOrg(ctx.admin, ctx.orgId, input.id);
  if (!destino) return NO_AUTORIZADO;
  if (destino.activado_at) return { ok: false, error: "Ese usuario ya activó su cuenta." };
  if (!destino.email) return { ok: false, error: "El usuario no tiene email." };

  return enviarActivacion({
    email: destino.email,
    nombre: destino.nombre,
    organizacionId: ctx.orgId,
    reenvio: false,
  });
}

// ── Roles ───────────────────────────────────────────────────────────────────

export async function guardarRol(input: {
  id: unknown;
  nombre: unknown;
  descripcion: unknown;
  permisos: unknown;
}): Promise<Resultado> {
  const ctx = await contexto();
  if (!ctx) return NO_AUTORIZADO;

  const nombre = typeof input.nombre === "string" ? input.nombre.trim() : "";
  const descripcion = typeof input.descripcion === "string" ? input.descripcion.trim() : "";
  if (!nombre || nombre.length > 60) return { ok: false, error: "Ingresá un nombre (hasta 60 caracteres)." };
  if (descripcion.length > 200) return { ok: false, error: "La descripción es muy larga (hasta 200 caracteres)." };
  if (!Array.isArray(input.permisos)) return { ok: false, error: "Permisos inválidos." };

  // Solo claves del catalogo, con sus dependencias: un rol nunca queda con
  // "registrar ventas" sin poder ver los clientes que el formulario necesita.
  const permisos = conDependencias(input.permisos.filter(esPermiso));
  if (!permisos.length) return { ok: false, error: "Elegí al menos un permiso." };

  const supabase = await createClient();

  if (input.id === null || input.id === undefined) {
    // organizacion_id explicito: roles no tiene default. La RLS igual exige
    // que sea la propia (WITH CHECK), asi que no se puede crear en otra.
    const { error } = await supabase
      .from("roles")
      .insert({ organizacion_id: ctx.orgId, nombre, descripcion: descripcion || null, permisos });
    if (error) {
      return { ok: false, error: error.code === "23505" ? "Ya existe un rol con ese nombre." : "No se pudo crear el rol." };
    }
  } else {
    if (typeof input.id !== "string") return NO_AUTORIZADO;
    // Si es el rol de quien edita, no puede sacarse la gestion de usuarios.
    if (input.id === ctx.sesion.perfil?.rol_id && !permisos.includes("usuarios.gestionar")) {
      return { ok: false, error: "No podés quitarle a tu propio rol la gestión de usuarios." };
    }
    const { data, error } = await supabase
      .from("roles")
      .update({ nombre, descripcion: descripcion || null, permisos })
      .eq("id", input.id)
      .select("id");
    if (error) {
      return { ok: false, error: error.code === "23505" ? "Ya existe un rol con ese nombre." : "No se pudo guardar el rol." };
    }
    // 0 filas: no existe, es de otra organizacion o es el rol Administrador.
    if (!data?.length) return { ok: false, error: "Ese rol no se puede editar." };
  }

  revalidatePath("/usuarios");
  return { ok: true };
}

export async function borrarRol(input: { id: unknown }): Promise<Resultado> {
  const ctx = await contexto();
  if (!ctx) return NO_AUTORIZADO;
  if (typeof input.id !== "string") return NO_AUTORIZADO;

  const supabase = await createClient();
  const { data, error } = await supabase.from("roles").delete().eq("id", input.id).select("id");
  if (error) {
    // 23503: la FK de perfiles es `restrict`, el rol esta asignado.
    return {
      ok: false,
      error: error.code === "23503" ? "Hay usuarios con este rol. Asignales otro antes de borrarlo." : "No se pudo borrar el rol.",
    };
  }
  if (!data?.length) return { ok: false, error: "Ese rol no se puede borrar." };

  revalidatePath("/usuarios");
  return { ok: true };
}
