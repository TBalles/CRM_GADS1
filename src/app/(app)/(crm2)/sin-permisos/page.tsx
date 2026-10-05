import Link from "next/link";
import { buttonClass } from "@/components/crm/Button";
import { TYPE, UI_ROOT, cn } from "@/components/crm/cx";
import { getSesion } from "@/lib/sesion";
import { rutaInicial } from "@/lib/permisos";

export const metadata = { title: "Sin permisos" };

/**
 * Destino de un usuario cuyo rol no tiene ninguna pantalla habilitada (`rutaInicial` sin permisos). CRM 2.0: texto + una
 * acción discreta, en el área de trabajo; sin escena ni ícono.
 *
 * - Rol sin ninguna sección: el texto de siempre ("Tu rol todavía no tiene secciones habilitadas") y la indicación.
 * - Alguien que SÍ tiene secciones y entró directo (el rail las muestra al lado): un texto neutro que no lo contradiga.
 * "Volver al inicio" va a /dashboard, que manda a cada rol a su primera pantalla (o de vuelta acá si no tiene ninguna).
 * La sesión ya la leyó el layout en este pedido (`getSesion` está en `cache`): no es otra consulta.
 */
export default async function SinPermisosPage() {
  const sesion = await getSesion();
  const sinSecciones = !sesion || rutaInicial(sesion.permisos) === "/sin-permisos";
  return (
    <div className={cn(UI_ROOT, "flex min-h-full flex-col items-start gap-1 bg-(--crm-canvas) px-4 py-3 xl:px-6")}>
      <h1 className={TYPE.title}>{sinSecciones ? "Tu rol todavía no tiene secciones habilitadas" : "No tenés permisos para ver esta sección."}</h1>
      <p className="max-w-prose text-(--crm-text-2)">Pedile a un administrador de tu empresa que te asigne un rol con permisos.</p>
      <Link href="/dashboard" className={buttonClass({ variant: "secondary", className: "mt-3" })}>
        Volver al inicio
      </Link>
    </div>
  );
}
