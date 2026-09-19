import { redirect } from "next/navigation";
import { getSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { rutaInicial } from "@/lib/permisos";
import AdminView from "./AdminView";

export const metadata = { title: "Clientes" };

/**
 * Panel del superadmin. La RLS le deja ver todas las organizaciones, perfiles
 * y roles, pero NINGUN dato comercial de los clientes (minimo privilegio).
 */
export default async function AdminPage() {
  const sesion = await getSesion();
  if (!sesion) redirect("/login");
  if (!sesion.esSuperadmin) redirect(rutaInicial(sesion.permisos));

  const supabase = await createClient();
  const [{ data: organizaciones }, { data: perfiles }, { data: roles }] = await Promise.all([
    supabase.from("organizaciones").select("id, nombre, activa, created_at").order("nombre"),
    supabase.from("perfiles").select("id, nombre, email, organizacion_id, rol_id, activo, activado_at"),
    supabase.from("roles").select("id, organizacion_id, es_admin"),
  ]);

  const rolesAdmin = new Set((roles ?? []).filter((r) => r.es_admin).map((r) => r.id));

  const clientes = (organizaciones ?? []).map((o) => {
    const deLaOrg = (perfiles ?? []).filter((p) => p.organizacion_id === o.id);
    return {
      ...o,
      usuarios: deLaOrg.filter((p) => p.activo).length,
      admins: deLaOrg
        .filter((p) => p.rol_id && rolesAdmin.has(p.rol_id))
        .map((p) => ({
          id: p.id,
          nombre: p.nombre,
          email: p.email,
          pendiente: p.activo && !p.activado_at,
          activo: p.activo,
        })),
    };
  });

  return <AdminView clientes={clientes} miOrgId={sesion.perfil?.organizacion_id ?? null} />;
}
