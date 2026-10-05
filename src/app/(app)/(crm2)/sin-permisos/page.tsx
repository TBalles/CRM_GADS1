import { TYPE, UI_ROOT, cn } from "@/components/crm/cx";

export const metadata = { title: "Sin permisos" };

/**
 * Destino de un usuario cuyo rol no tiene ninguna pantalla habilitada (`rutaInicial` sin permisos). CRM 2.0: el mismo
 * texto de siempre como h1 + la indicación, en el área de trabajo; sin escena ni ícono. Sin acción: el legacy no tenía
 * ninguna y no hay a dónde mandar a alguien sin secciones (cerrar sesión ya está en el menú de usuario).
 */
export default function SinPermisosPage() {
  return (
    <div className={cn(UI_ROOT, "flex min-h-full flex-col gap-1 bg-(--crm-canvas) px-4 py-3 xl:px-6")}>
      <h1 className={TYPE.title}>Tu rol todavía no tiene secciones habilitadas</h1>
      <p className="max-w-prose text-(--crm-text-2)">Pedile a un administrador de tu empresa que te asigne un rol con permisos.</p>
    </div>
  );
}
