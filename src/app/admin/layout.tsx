import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { GoalMark } from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import { APP_NAME } from "@/lib/brand";
import { getSesion } from "@/lib/sesion";

/**
 * Panel de PLATAFORMA: la interfaz del superadmin, separada del CRM. Aca solo
 * se administran las empresas que usan el sistema (alta, administradores,
 * suspension); ningun modulo comercial. Al reves, el layout del CRM manda al
 * superadmin para aca.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const sesion = await getSesion();
  if (!sesion) redirect("/login");
  if (!sesion.esSuperadmin) redirect("/dashboard");

  const nombre = sesion.perfil?.nombre ?? sesion.user.email ?? "";

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b bg-card/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/admin" className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-logo text-logo-foreground shadow-sm">
              <GoalMark className="h-[19px] w-[19px]" />
            </span>
            <span className="truncate text-sm font-bold tracking-tight">{APP_NAME}</span>
            <span className="shrink-0 rounded-full bg-violet-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
              Plataforma
            </span>
          </Link>

          <div className="flex items-center gap-1">
            <span className="mr-2 hidden text-right leading-tight sm:block">
              <span className="block text-xs font-semibold">{nombre}</span>
              <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">Superadmin</span>
            </span>
            <div className="w-10">
              <ThemeToggle collapsed />
            </div>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
                className="flex h-10 w-10 items-center justify-center rounded-md text-destructive transition-colors hover:bg-destructive/10"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
