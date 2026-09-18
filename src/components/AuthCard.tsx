import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { GoalMark } from "./Logo";
import { APP_NAME } from "@/lib/brand";

/**
 * Marco de las pantallas de cuenta que no son el login: definir contraseña y
 * recuperar acceso. Card centrada con el isotipo, mismo lenguaje visual que el
 * panel del formulario del login.
 */
export default function AuthCard({
  titulo,
  bajada,
  volver = true,
  children,
}: {
  titulo: string;
  bajada: string;
  volver?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-secondary/30 p-6">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-xl sm:p-10">
        <span className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-brand-foreground shadow-lg shadow-brand/25">
          <GoalMark className="h-7 w-7" />
        </span>
        <h1 className="text-2xl font-bold tracking-tight">{titulo}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{bajada}</p>

        {children}

        {volver && (
          <Link
            href="/login"
            className="mt-8 inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="h-4 w-4" /> Volver al ingreso
          </Link>
        )}
        <p className="mt-8 text-xs text-muted-foreground/70">{APP_NAME}</p>
      </div>
    </div>
  );
}
