"use server";

import { revalidatePath } from "next/cache";
import { getSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, SIN_SERVICE_ROLE } from "@/lib/supabase/admin";
import { crearUsuario, emailValido, enviarActivacion, type ResultadoCuenta } from "@/lib/cuentas";

/**
 * Panel del SUPERADMIN (nivel plataforma): alta de clientes y de sus
 * administradores. Todas las acciones empiezan verificando en el servidor que
 * quien llama es superadmin; la pantalla ocultando el menu no protege nada.
 */

type Resultado = ResultadoCuenta;
const NO_AUTORIZADO: Resultado = { ok: false, error: "No tenés permiso para hacer esto." };

async function exigirSuperadmin() {
  const sesion = await getSesion();
  return sesion?.esSuperadmin ? sesion : null;
}

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

async function rolAdministrador(admin: Admin, organizacionId: string) {
  const { data } = await admin
    .from("roles")
    .select("id")
    .eq("organizacion_id", organizacionId)
    .eq("es_admin", true)
    .maybeSingle();
  return data?.id ?? null;
}

function texto(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t && t.length <= max ? t : null;
}

/**
 * Alta de un cliente: la organizacion (el trigger le crea roles y etapas) y
 * su primer usuario, con el rol Administrador y la invitacion por mail. Si el
 * usuario no se puede crear, se borra la organizacion recien creada: un
 * cliente sin nadie que pueda entrar no sirve de nada.
 */
export async function crearCliente(input: {
  nombre: unknown;
  adminNombre: unknown;
  adminEmail: unknown;
}): Promise<Resultado> {
  if (!(await exigirSuperadmin())) return NO_AUTORIZADO;
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: SIN_SERVICE_ROLE };

  const nombre = texto(input.nombre, 120);
  const adminNombre = texto(input.adminNombre, 120);
  if (!nombre) return { ok: false, error: "Ingresá el nombre del cliente." };
  if (!adminNombre) return { ok: false, error: "Ingresá el nombre del administrador." };
  // Antes de crear nada: un email invalido no tiene que dejar una organizacion
  // a medio crear que despues haya que deshacer.
  const adminEmail = emailValido(input.adminEmail);
  if (!adminEmail) return { ok: false, error: "Ingresá un email válido para el administrador." };

  const { data: org, error } = await admin.from("organizaciones").insert({ nombre }).select("id").single();
  if (error || !org) return { ok: false, error: "No se pudo crear el cliente." };

  const rolId = await rolAdministrador(admin, org.id);
  const res = rolId
    ? await crearUsuario({ email: adminEmail, nombre: adminNombre, organizacionId: org.id, rolId })
    : ({ ok: false, error: "No se crearon los roles iniciales del cliente." } as const);

  if (!res.ok) {
    const { error: rollbackError } = await admin.from("organizaciones").delete().eq("id", org.id);
    if (rollbackError) {
      console.error("[admin] no se pudo deshacer la organizacion:", rollbackError);
      return {
        ok: false,
        error: `${res.error} Además quedó creado el cliente "${nombre}" sin administrador: suspendelo o agregale uno.`,
      };
    }
    return res;
  }

  revalidatePath("/admin");
  return res;
}

/** Suma otro administrador a un cliente existente. */
export async function agregarAdministrador(input: {
  organizacionId: unknown;
  nombre: unknown;
  email: unknown;
}): Promise<Resultado> {
  if (!(await exigirSuperadmin())) return NO_AUTORIZADO;
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: SIN_SERVICE_ROLE };
  if (typeof input.organizacionId !== "string") return NO_AUTORIZADO;

  const nombre = texto(input.nombre, 120);
  if (!nombre) return { ok: false, error: "Ingresá el nombre." };
  const email = emailValido(input.email);
  if (!email) return { ok: false, error: "Ingresá un email válido." };
  const rolId = await rolAdministrador(admin, input.organizacionId);
  if (!rolId) return { ok: false, error: "Ese cliente no existe." };

  const res = await crearUsuario({
    email,
    nombre,
    organizacionId: input.organizacionId,
    rolId,
  });
  if (res.ok) revalidatePath("/admin");
  return res;
}

/**
 * Suspender / reactivar un cliente. Suspendido, ninguno de sus usuarios ve
 * nada (la base lo mira en cada consulta). Va con el cliente de SESION: la
 * politica "superadmin" de organizaciones es una segunda barrera.
 */
export async function cambiarEstadoCliente(input: { id: unknown; activa: unknown }): Promise<Resultado> {
  const sesion = await exigirSuperadmin();
  if (!sesion) return NO_AUTORIZADO;
  if (typeof input.id !== "string" || typeof input.activa !== "boolean") return { ok: false, error: "Dato inválido." };
  if (!input.activa && input.id === sesion.perfil?.organizacion_id) {
    return { ok: false, error: "No podés suspender tu propia organización." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizaciones")
    .update({ activa: input.activa })
    .eq("id", input.id)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "No se pudo actualizar el cliente." };

  revalidatePath("/admin");
  return { ok: true };
}

/** Reenvia la invitacion a un administrador que todavia no activo su cuenta. */
export async function reenviarInvitacionAdmin(input: { id: unknown }): Promise<Resultado> {
  if (!(await exigirSuperadmin())) return NO_AUTORIZADO;
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: SIN_SERVICE_ROLE };
  if (typeof input.id !== "string") return NO_AUTORIZADO;

  const { data: perfil } = await admin
    .from("perfiles")
    .select("nombre, email, organizacion_id, activado_at")
    .eq("id", input.id)
    .maybeSingle();
  if (!perfil?.email) return { ok: false, error: "Usuario no encontrado." };
  if (perfil.activado_at) return { ok: false, error: "Ese usuario ya activó su cuenta." };

  return enviarActivacion({
    email: perfil.email,
    nombre: perfil.nombre,
    organizacionId: perfil.organizacion_id,
    reenvio: false,
  });
}
