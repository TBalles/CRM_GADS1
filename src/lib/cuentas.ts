import "server-only";
import { createAdminClient, SIN_SERVICE_ROLE } from "@/lib/supabase/admin";
import { origenPublico } from "@/lib/sesion";
import { enviarMail } from "@/lib/email/enviar";
import { mailActivacion, mailRecuperacion } from "@/lib/email/plantillas";

/**
 * Ciclo de vida de las cuentas: alta, activacion, recuperacion y reenvio.
 *
 * TODOS los mails de cuenta salen por nuestro SMTP con nuestro diseño. Supabase
 * no manda ninguno: el alta usa `auth.admin.createUser` (que no envia nada) y
 * los links se generan con `auth.admin.generateLink` (que tampoco). Asi no
 * dependemos del cupo del mailer de Supabase, que en el plan gratuito es de
 * unos pocos mails por hora.
 *
 * Estos helpers NO verifican permisos: cada Server Action que los llama
 * decide antes si quien pide puede hacerlo (ver src/lib/sesion.ts).
 */

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

/**
 * Los emails se comparan EXACTOS y en minuscula (Supabase los guarda asi), nunca
 * con `ilike`: en ilike, `%` y `_` son comodines, y alguien que escribiera "%"
 * en "recuperar contraseña" matchearia cuentas ajenas.
 */
const normalizar = (email: string) => email.trim().toLowerCase();
type TipoEnvio = "activacion" | "recuperacion";

export type ResultadoCuenta =
  | { ok: true; linkManual?: string }
  | { ok: false; error: string };

/**
 * Limite de envios por casilla: 1 por minuto y 5 por hora de cada tipo.
 *
 * La activacion y la recuperacion se piden desde pantallas PUBLICAS. Sin
 * limite, cualquiera podria bombardear una casilla ajena o gastar el cupo
 * diario de Gmail (~500) en minutos.
 */
async function puedeEnviar(admin: Admin, email: string, tipo: TipoEnvio): Promise<boolean> {
  // Chequear y registrar en UN paso, con lock en la base (ver
  // registrar_envio_auth en la migracion 0005). Leer el conteo aca y despues
  // insertar dejaria colarse envios con pedidos en paralelo.
  const { data, error } = await admin.rpc("registrar_envio_auth", {
    p_email: normalizar(email),
    p_tipo: tipo,
  });
  if (error) {
    // Ante la duda, no se manda: mejor un mail de menos que abrir la canilla.
    console.error("[cuentas] registrar_envio_auth fallo:", error);
    return false;
  }
  return data === true;
}

/**
 * Link de un solo uso que abre sesion y lleva a definir la contraseña.
 *
 * No se usa el `action_link` que devuelve Supabase: se arma uno propio a
 * /auth/confirm con el `hashed_token`, que el servidor verifica con
 * `verifyOtp` y convierte en cookie de sesion. Es el flujo recomendado para
 * SSR, y el link apunta a nuestro dominio en vez de al de Supabase.
 */
async function linkDeAcceso(
  admin: Admin,
  email: string,
  tipo: "magiclink" | "recovery",
  modo: "activar" | "recuperar",
): Promise<string | null> {
  const { data, error } = await admin.auth.admin.generateLink({ type: tipo, email });
  const token = data?.properties?.hashed_token;
  if (error || !token) {
    console.error("[cuentas] generateLink fallo:", error);
    return null;
  }
  const url = new URL("/auth/confirm", origenPublico());
  url.searchParams.set("token_hash", token);
  url.searchParams.set("type", tipo);
  url.searchParams.set("next", `/definir-clave?modo=${modo}`);
  return url.toString();
}

async function nombreOrganizacion(admin: Admin, id: string | null): Promise<string | null> {
  if (!id) return null;
  const { data } = await admin.from("organizaciones").select("nombre").eq("id", id).maybeSingle();
  return data?.nombre ?? null;
}

/**
 * Manda (o reenvia) el mail de activacion. Si el SMTP no esta configurado,
 * devuelve el link para que el admin lo comparta a mano: el alta no queda
 * trabada por falta de mail.
 */
export async function enviarActivacion({
  email,
  nombre,
  organizacionId,
  reenvio,
  respetarLimite = true,
}: {
  email: string;
  nombre: string | null;
  organizacionId: string | null;
  reenvio: boolean;
  respetarLimite?: boolean;
}): Promise<ResultadoCuenta> {
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: SIN_SERVICE_ROLE };

  if (respetarLimite && !(await puedeEnviar(admin, email, "activacion"))) {
    return { ok: false, error: "Ya mandamos un mail hace muy poco. Esperá un minuto y probá de nuevo." };
  }

  const link = await linkDeAcceso(admin, email, "magiclink", "activar");
  if (!link) return { ok: false, error: "No se pudo generar el link de activación." };

  const { asunto, contenido } = mailActivacion({
    nombre,
    organizacion: await nombreOrganizacion(admin, organizacionId),
    link,
    reenvio,
  });
  const res = await enviarMail({ para: email, asunto, contenido });
  if (res.ok) return { ok: true };
  if (res.sinSmtp) return { ok: true, linkManual: link };
  return { ok: false, error: res.error };
}

/**
 * Da de alta un usuario en una organizacion y le manda la invitacion.
 *
 * La organizacion y el rol van en APP_metadata, que solo puede escribir el
 * servidor: el trigger handle_new_user los lee de ahi. Ademas se hace upsert
 * del perfil aca mismo, por si el trigger no lo creo: no depende de un solo
 * camino.
 */
export async function crearUsuario({
  email,
  nombre,
  organizacionId,
  rolId,
}: {
  email: string;
  nombre: string;
  organizacionId: string;
  /** Tiene que ser un rol de `organizacionId`: lo verifica quien llama (y la FK compuesta). */
  rolId: string;
}): Promise<ResultadoCuenta> {
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: SIN_SERVICE_ROLE };

  const emailLimpio = normalizar(email);
  const { data, error } = await admin.auth.admin.createUser({
    email: emailLimpio,
    email_confirm: false,
    user_metadata: { nombre },
    app_metadata: { organizacion_id: organizacionId, rol_id: rolId },
  });

  if (error || !data.user) {
    // Solo el codigo especifico: un 422 tambien sale por un email mal escrito.
    if (error?.code === "email_exists" || /already/i.test(error?.message ?? "")) {
      return { ok: false, error: "Ya existe un usuario con ese email." };
    }
    console.error("[cuentas] createUser fallo:", error);
    return { ok: false, error: "No se pudo crear el usuario." };
  }

  const { error: perfilError } = await admin.from("perfiles").upsert({
    id: data.user.id,
    nombre,
    email: emailLimpio,
    organizacion_id: organizacionId,
    rol_id: rolId,
    activo: true,
    activado_at: null,
  });
  if (perfilError) {
    // Sin perfil el usuario no podria hacer nada: se deshace el alta entera
    // en vez de dejar una cuenta a medias.
    console.error("[cuentas] perfil fallo, se borra el usuario:", perfilError);
    await admin.auth.admin.deleteUser(data.user.id);
    return { ok: false, error: "No se pudo crear el usuario." };
  }

  return enviarActivacion({
    email: emailLimpio,
    nombre,
    organizacionId,
    reenvio: false,
    respetarLimite: false,
  });
}

/**
 * Busca una cuenta por email y dice en que estado esta. Usa el cliente admin:
 * se llama desde pantallas publicas (login, recuperar), donde no hay sesion.
 */
export async function estadoCuenta(email: string) {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data: perfil } = await admin
    .from("perfiles")
    .select("id, nombre, email, organizacion_id, activo, activado_at")
    .eq("email", normalizar(email))
    .maybeSingle();
  if (!perfil) return null;
  return {
    perfil,
    pendiente: perfil.activo && !perfil.activado_at,
    activa: perfil.activo && Boolean(perfil.activado_at),
  };
}

/**
 * "Olvide mi contraseña". Si la cuenta todavia no se activo, manda la
 * ACTIVACION en su lugar (no tiene contraseña que recuperar). Si no existe o
 * esta dada de baja, no manda nada; quien llama responde lo mismo en todos los
 * casos, para no revelar que emails tienen cuenta.
 */
export async function pedirRecuperacion(email: string): Promise<void> {
  const cuenta = await estadoCuenta(email);
  if (!cuenta || !cuenta.perfil.activo) return;

  if (cuenta.pendiente) {
    await enviarActivacion({
      email: cuenta.perfil.email ?? email,
      nombre: cuenta.perfil.nombre,
      organizacionId: cuenta.perfil.organizacion_id,
      reenvio: true,
    });
    return;
  }

  const admin = createAdminClient();
  if (!admin || !(await puedeEnviar(admin, email, "recuperacion"))) return;

  const link = await linkDeAcceso(admin, email, "recovery", "recuperar");
  if (!link) return;
  const { asunto, contenido } = mailRecuperacion({ nombre: cuenta.perfil.nombre, link });
  await enviarMail({ para: cuenta.perfil.email ?? email, asunto, contenido });
}

/** Email normalizado si tiene forma valida, o null. */
export function emailValido(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const email = normalizar(valor);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254 ? email : null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Valida los datos de un alta que llegan de un formulario. Los argumentos de
 * una Server Action vienen del navegador y pueden ser CUALQUIER cosa (no solo
 * lo que el formulario manda): se chequea tipo, forma y largo. Que el rol sea
 * de la organizacion correcta lo verifica cada accion contra la base.
 */
export function validarAlta(input: {
  nombre: unknown;
  email: unknown;
  rolId: unknown;
}):
  | { ok: true; valor: { nombre: string; email: string; rolId: string } }
  | { ok: false; error: string } {
  const nombre = typeof input.nombre === "string" ? input.nombre.trim() : "";
  const email = emailValido(input.email);
  if (!nombre || nombre.length > 120) return { ok: false, error: "Ingresá un nombre (hasta 120 caracteres)." };
  if (!email) return { ok: false, error: "Ingresá un email válido." };
  if (typeof input.rolId !== "string" || !UUID.test(input.rolId)) return { ok: false, error: "Elegí un rol." };
  return { ok: true, valor: { nombre, email, rolId: input.rolId } };
}
