import { redirect } from "next/navigation";
import { getSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { rutaInicial } from "@/lib/permisos";
import UsuariosView from "./UsuariosView";

export const metadata = { title: "Usuarios" };

export default async function UsuariosPage() {
  const sesion = await getSesion();
  const orgId = sesion?.perfil?.organizacion_id;
  if (!sesion || !orgId) redirect("/login");
  if (!sesion.puede("usuarios.gestionar")) redirect(rutaInicial(sesion.permisos));

  const supabase = await createClient();
  // Filtro explicito por organizacion: si quien mira es ademas superadmin, la
  // RLS le deja ver usuarios y roles de TODOS los clientes, y esta pantalla es
  // solo de la suya.
  const [{ data: usuarios }, { data: roles }] = await Promise.all([
    supabase
      .from("perfiles")
      .select("id, nombre, email, rol_id, activo, activado_at")
      .eq("organizacion_id", orgId)
      .order("nombre"),
    supabase
      .from("roles")
      .select("id, nombre, descripcion, es_admin, permisos")
      .eq("organizacion_id", orgId)
      .order("es_admin", { ascending: false })
      .order("nombre"),
  ]);

  return (
    <UsuariosView
      usuarios={usuarios ?? []}
      roles={roles ?? []}
      yoId={sesion.user.id}
      miRolId={sesion.perfil?.rol_id ?? null}
    />
  );
}
