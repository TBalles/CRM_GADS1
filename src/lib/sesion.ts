import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { rutaInicial, type Permiso } from "@/lib/permisos";

/**
 * Quien esta usando la app y que puede hacer.
 *
 * Se lee con el cliente de SESION (no el admin), asi que pasa por la RLS: un
 * usuario solo puede leerse a si mismo y a su organizacion. `cache` evita
 * repetir la consulta cuando el layout y la pagina la piden en el mismo
 * request.
 *
 * Toda Server Action que haga algo privilegiado empieza por aca: la
 * autorizacion se decide en el SERVIDOR, nunca por lo que la pantalla muestra
 * u oculta.
 */
export const getSesion = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("id, nombre, email, rol_id, es_superadmin, activo, organizacion_id")
    .eq("id", user.id)
    .maybeSingle();

  const [{ data: organizacion }, { data: rol }] = await Promise.all([
    perfil?.organizacion_id
      ? supabase.from("organizaciones").select("id, nombre, activa").eq("id", perfil.organizacion_id).maybeSingle()
      : Promise.resolve({ data: null }),
    perfil?.rol_id
      ? supabase.from("roles").select("id, nombre, es_admin, permisos").eq("id", perfil.rol_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const activo = Boolean(perfil?.activo);
  const puedeOperar = activo && Boolean(organizacion?.activa);
  // Sin poder operar (baja u organizacion suspendida), ningun permiso: igual
  // que en la base, donde tiene_permiso() devuelve false en ese caso.
  const permisos: string[] = puedeOperar ? (rol?.permisos ?? []) : [];

  return {
    user,
    perfil,
    organizacion,
    rol,
    permisos,
    /** Usuario activo en una organizacion activa. */
    puedeOperar,
    puede: (permiso: Permiso) => permisos.includes(permiso),
    esSuperadmin: activo && Boolean(perfil?.es_superadmin),
  };
});

export type Sesion = NonNullable<Awaited<ReturnType<typeof getSesion>>>;

/**
 * Guarda de PAGINA: sin sesion, al login; sin el permiso, a la primera
 * pantalla que si puede ver. Evita que alguien entre escribiendo la URL a una
 * seccion que su rol no tiene (la base igual le devolveria todo vacio, pero
 * asi no ve una pantalla rota).
 */
export async function exigirPermiso(permiso: Permiso): Promise<Sesion> {
  const sesion = await getSesion();
  if (!sesion) redirect("/login");
  if (!sesion.puede(permiso)) redirect(rutaInicial(sesion.permisos));
  return sesion;
}

/**
 * Origen publico del sitio (https://dominio) para los links de los mails.
 *
 * NUNCA sale de los headers del request (Host / X-Forwarded-Host). Si saliera,
 * un atacante podria pedir la recuperacion de contraseña de OTRA persona con
 * un Host falso: el mail le llega a la victima, legitimo, pero con un link al
 * dominio del atacante, y al tocarlo le entrega su token de acceso
 * ("password reset poisoning").
 *
 * Orden: SITE_URL si esta configurada; si no, el dominio que Vercel inyecta
 * solo (produccion o preview); en desarrollo, localhost.
 */
export function origenPublico(): string {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/+$/, "");
  const vercel =
    process.env.VERCEL_ENV === "production"
      ? process.env.VERCEL_PROJECT_PRODUCTION_URL
      : process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}
