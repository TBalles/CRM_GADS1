import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Ban, LogOut } from "lucide-react";
import AuthCard from "@/components/AuthCard";
import CrmRoot from "@/components/crm/CrmRoot";
import AppFrame from "@/components/crm/shell/AppFrame";
import { RAIL_COOKIE, railColapsado } from "@/components/crm/shell/logica";
import { getSesion } from "@/lib/sesion";
import "./crm.css";

// La rama «Sin acceso» (AuthCard, sin shell) NO se envuelve en CrmRoot: es una pantalla de acceso, fuera de alcance.

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sesion = await getSesion();
  if (!sesion) redirect("/login");
  // El superadmin opera la PLATAFORMA, no un CRM: tiene su propio panel.
  if (sesion.esSuperadmin) redirect("/admin");

  // Sesion abierta pero sin permiso para operar: usuario dado de baja u
  // organizacion desactivada. La RLS igual le devolveria todo vacio; esto es
  // para que entienda POR QUE en vez de ver un CRM en blanco. No se puede
  // mandar a /login (el proxy lo rebotaria de vuelta, porque la sesion existe),
  // asi que se muestra el aviso con un boton para cerrarla.
  if (!sesion.puedeOperar) {
    const motivo = !sesion.perfil?.activo
      ? "Tu usuario está desactivado."
      : "La cuenta de tu empresa está suspendida.";
    return (
      <AuthCard titulo="Sin acceso" bajada={`${motivo} Si creés que es un error, hablá con tu administrador.`} volver={false}>
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <Ban className="h-5 w-5 shrink-0" />
          No podés ver ni modificar datos con este usuario.
        </div>
        <form action="/auth/signout" method="post" className="mt-6">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <LogOut className="h-4 w-4" /> Cerrar sesión
          </button>
        </form>
      </AuthCard>
    );
  }

  // La preferencia del rail se lee acá para que el primer pintado ya salga colapsado o expandido (sin parpadeo).
  const rail = (await cookies()).get(RAIL_COOKIE)?.value;

  return (
    <CrmRoot>
      <AppFrame
        nombre={sesion.perfil?.nombre ?? sesion.user.email ?? ""}
        organizacion={sesion.organizacion?.nombre ?? null}
        rol={sesion.rol?.nombre ?? null}
        permisos={sesion.permisos}
        railColapsado={railColapsado(rail)}
      >
        {children}
      </AppFrame>
    </CrmRoot>
  );
}
