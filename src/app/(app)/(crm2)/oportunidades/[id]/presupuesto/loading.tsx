import { LoadingStatus, Skeleton } from "@/components/crm/Feedback";
import { UI_ROOT, cn } from "@/components/crm/cx";

/**
 * Carga del editor de presupuesto (MASTER.md §10.20): la forma de la pantalla que viene — franja del encabezado con sus
 * acciones, la grilla de líneas con su pie y, desde 1280, la hoja a la derecha — con esqueletos neutros, `aria-busy` y
 * "Cargando…" (contrato de §13.2). Al entrar desde la ficha de la oportunidad (mismo route group) Next muestra ESTA carga.
 */
export default function CargandoPresupuesto() {
  return (
    <div aria-busy="true" className={cn(UI_ROOT, "flex h-full min-h-0 flex-col bg-(--crm-canvas)")}>
      <LoadingStatus />
      <div className="shrink-0 border-b border-(--crm-border) bg-(--crm-panel) px-4 py-3 xl:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-6 w-72 max-w-[70vw]" />
            <Skeleton className="w-96 max-w-[80vw]" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-44" />
            <Skeleton className="h-8 w-40" />
          </div>
        </div>
      </div>
      <div className="grid min-h-0 flex-1 xl:grid-cols-2">
        <div className="flex flex-col gap-3 px-4 py-4 xl:px-6">
          <Skeleton className="w-24" />
          <div className="flex flex-col gap-3 rounded-(--crm-radius) border border-(--crm-border) bg-(--crm-panel) p-3">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="flex flex-col gap-2 border-b border-(--crm-border) pb-3">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-3/4" />
              </div>
            ))}
            <div className="flex justify-between gap-4">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-16 w-48" />
            </div>
          </div>
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-16 w-full" />
        </div>
        <div className="hidden border-l border-(--crm-border) px-6 py-4 xl:block">
          <div className="mx-auto flex aspect-[210/297] w-full max-w-[56rem] flex-col gap-3 rounded-(--crm-radius) border border-(--crm-border) bg-(--crm-panel) p-6">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className={i % 3 ? "w-2/3" : "w-full"} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
