import { ShieldOff } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata = { title: "Sin permisos" };

/** Destino de un usuario cuyo rol no tiene ninguna pantalla habilitada. */
export default function SinPermisosPage() {
  return (
    <EmptyState
      icon={ShieldOff}
      text="Tu rol todavía no tiene secciones habilitadas"
      hint="Pedile a un administrador de tu empresa que te asigne un rol con permisos."
    />
  );
}
