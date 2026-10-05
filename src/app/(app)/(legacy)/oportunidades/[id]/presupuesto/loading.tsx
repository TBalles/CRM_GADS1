import { LoadingStatus, Skeleton } from "@/components/crm/Feedback";
import { UI_ROOT, cn } from "@/components/crm/cx";

/**
 * Carga del presupuesto (el editor sigue legacy, dentro del layout de `(legacy)`): esqueleto neutro con los primitivos de
 * CRM 2.0 (encabezado, editor de líneas y la hoja) y "Cargando…" (contrato de MASTER §13.2), en lugar del cargador de
 * marca genérico. No toca la página ni el editor.
 */
export default function CargandoPresupuesto() {
  return (
    <div aria-busy="true" className={cn(UI_ROOT, "flex flex-col gap-4")}>
      <LoadingStatus />
      <Skeleton className="w-40" />
      <div className="flex flex-col gap-2 border-b border-(--crm-border) pb-4">
        <Skeleton className="h-6 w-80 max-w-[70vw]" />
        <Skeleton className="w-56" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-(--crm-radius) border border-(--crm-border) p-4">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className={cn("h-8", i % 2 ? "w-full" : "w-4/5")} />
          ))}
        </div>
        <div className="flex flex-col gap-3 rounded-(--crm-radius) border border-(--crm-border) p-4">
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton key={i} className={i % 3 ? "w-2/3" : "w-full"} />
          ))}
        </div>
      </div>
    </div>
  );
}
