import { redirect } from "next/navigation";
import { Ban, LogOut } from "lucide-react";
import AppShell from "@/components/AppShell";
import AuthCard from "@/components/AuthCard";
import { getSesion } from "@/lib/sesion";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sesion = await getSesion();
  if (!sesion) redirect("/login");

  // Sesion abierta pero sin permiso para operar: usuario dado de baja u
  // organizacion desactivada. La RLS igual le devolveria todo vacio; esto es
  // para que entienda POR QUE en vez de ver un CRM en blanco. No se puede
  // mandar a /login (el proxy lo rebotaria de vuelta, porque la sesion existe),
  // asi que se muestra el aviso con un boton para cerrarla.
  // El superadmin puede no tener organizacion: entra igual, a su panel.
  if (!sesion.puedeOperar && !sesion.esSuperadmin) {
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

  return (
    <AppShell
      nombre={sesion.perfil?.nombre ?? sesion.user.email ?? ""}
      organizacion={sesion.organizacion?.nombre ?? null}
      rol={sesion.rol?.nombre ?? null}
      permisos={sesion.permisos}
      esSuperadmin={sesion.esSuperadmin}
    >
      {children}
    </AppShell>
  );
}
