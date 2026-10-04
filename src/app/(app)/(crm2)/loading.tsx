import { LoadingStatus, Skeleton } from "@/components/crm/Feedback";
import { UI_ROOT, cn } from "@/components/crm/cx";

/**
 * Carga de una pantalla CRM 2.0 (MASTER.md §9.1 y §13.2): esqueleto de barra de página + grilla, `aria-busy` y el
 * `role="status"` "Cargando…" que esperan las guardas y el manual (se va del DOM al terminar). Cada pantalla migrada
 * puede tener el suyo, más fiel a su forma.
 */
export default function CargandoCrm() {
  return (
    <div aria-busy="true" className={cn(UI_ROOT, "flex min-h-full flex-col gap-4 bg-(--crm-canvas) p-4 xl:p-6")}>
      <LoadingStatus />
      <div className="flex h-12 items-center justify-between gap-4">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-8 w-32" />
      </div>
      <div className="flex flex-col rounded-(--crm-radius) border border-(--crm-border) bg-(--crm-panel)">
        <div className="flex h-8 items-center border-b border-(--crm-border-strong) px-3">
          <Skeleton className="w-1/4" />
        </div>
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="flex h-9 items-center gap-6 border-b border-(--crm-border) px-3 last:border-b-0">
            <Skeleton className={i % 3 === 0 ? "w-1/3" : "w-1/4"} />
            <Skeleton className="w-1/6" />
            <Skeleton className="ml-auto w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
