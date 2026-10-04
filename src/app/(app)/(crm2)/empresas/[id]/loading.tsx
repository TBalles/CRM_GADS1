import { LoadingStatus, Skeleton } from "@/components/crm/Feedback";
import { UI_ROOT, cn } from "@/components/crm/cx";

/** Carga de la ficha: franja de identidad + tabs + contenido en esqueleto, `aria-busy` y "Cargando…" (MASTER.md §9.1). */
export default function CargandoFicha() {
  return (
    <div aria-busy="true" className={cn(UI_ROOT, "flex min-h-full flex-col bg-(--crm-canvas)")}>
      <LoadingStatus label="Cargando la ficha…" />
      <div className="border-b border-(--crm-border) bg-(--crm-panel) px-4 pt-3 xl:px-6">
        <Skeleton className="h-6 w-72" />
        <div className="mt-2 flex gap-4">
          <Skeleton className="w-20" />
          <Skeleton className="w-24" />
          <Skeleton className="w-32" />
        </div>
        <div className="mt-4 flex h-10 items-center gap-6">
          {["w-16", "w-16", "w-24", "w-20", "w-28"].map((w, i) => (
            <Skeleton key={i} className={w} />
          ))}
        </div>
      </div>
      <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_400px] xl:p-6">
        <div className="flex flex-col gap-4 rounded-(--crm-radius) border border-(--crm-border) bg-(--crm-panel) p-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex flex-col gap-2">
                <Skeleton className="w-20" />
                <Skeleton className="h-6 w-24" />
              </div>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <Skeleton className="w-16" />
                <Skeleton className={i % 2 ? "w-1/2" : "w-2/3"} />
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2 rounded-(--crm-radius) border border-(--crm-border) bg-(--crm-panel) p-4">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className={i % 2 ? "w-2/3" : "w-3/4"} />
          ))}
        </div>
      </div>
    </div>
  );
}
