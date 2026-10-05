import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import CrmRoot from "@/components/crm/CrmRoot";
import AppFrame from "@/components/crm/shell/AppFrame";
import { RAIL_COOKIE, railColapsado } from "@/components/crm/shell/logica";
import { getSesion } from "@/lib/sesion";
import "../(app)/crm.css";

/**
 * Panel de PLATAFORMA: la interfaz del superadmin, separada del CRM. Aca solo se administran las empresas que usan el
 * sistema (alta, administradores, suspension); ningun modulo comercial. Al reves, el layout del CRM manda al superadmin
 * para aca.
 *
 * CRM 2.0 (Lote F): el mismo marco que el CRM (`AppFrame`) en su variante `plataforma`: un rail de una sola sección
 * ("Plataforma" › Clientes), sin búsqueda global; tema y cerrar sesión en la topbar y el menú de usuario, como en el CRM.
 * Los guardas de acceso son los de siempre: sin sesión, /login; sesión que no es de superadmin, /dashboard.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const sesion = await getSesion();
  if (!sesion) redirect("/login");
  if (!sesion.esSuperadmin) redirect("/dashboard");

  const rail = (await cookies()).get(RAIL_COOKIE)?.value;

  return (
    <CrmRoot>
      <AppFrame
        plataforma
        nombre={sesion.perfil?.nombre ?? sesion.user.email ?? ""}
        organizacion="Plataforma"
        rol="Superadmin"
        permisos={[]}
        railColapsado={railColapsado(rail)}
      >
        {children}
      </AppFrame>
    </CrmRoot>
  );
}
