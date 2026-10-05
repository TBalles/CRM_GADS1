import { LoadingStatus, Skeleton } from "@/components/crm/Feedback";
import { TYPE, UI_ROOT, cn } from "@/components/crm/cx";
import { getSesion } from "@/lib/sesion";

/**
 * Carga de Oportunidades con la forma del tablero (la vista por defecto; `loading.tsx` no conoce `?vista=`): barra con
 * el h1 real, el segmentado y "Nueva oportunidad" (solo con `oportunidades.editar`, como la pantalla), la toolbar y
 * columnas a todo el alto con tarjetas. "Cargando oportunidades…" (contrato de §13.2).
 */
export default async function CargandoOportunidades() {
  const editar = (await getSesion())?.puede("oportunidades.editar") ?? false;
  return (
    <div aria-busy="true" className={cn(UI_ROOT, "flex h-full min-h-0 flex-col bg-(--crm-canvas) px-4 xl:px-6")}>
      <LoadingStatus label="Cargando oportunidades…" />
      <div className="flex h-12 shrink-0 items-center justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <h1 className={TYPE.title}>Oportunidades</h1>
          <Skeleton className="w-40 max-sm:hidden" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-36" />
          {editar && <Skeleton className="h-8 w-8 sm:w-44" />}
        </div>
      </div>
      <div className="flex min-h-10 items-center gap-2 py-1.5">
        <Skeleton className="h-7 w-48 sm:w-64" />
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-7 w-28 max-sm:hidden" />
      </div>
      <div className="-mx-4 flex min-h-0 flex-1 gap-3 overflow-hidden px-4 pb-3 xl:-mx-6 xl:px-6">
        {Array.from({ length: 5 }, (_, c) => (
          <div key={c} className="flex min-h-0 w-[85%] shrink-0 flex-col sm:w-auto sm:min-w-64 sm:max-w-96 sm:flex-1 sm:basis-0">
            <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-(--crm-border-strong) px-1">
              <Skeleton className="w-28" />
              <Skeleton className="w-12" />
            </div>
            <div className="flex flex-col gap-2 py-2">
              {Array.from({ length: 4 - (c % 3) }, (_, i) => (
                <div key={i} className="flex flex-col gap-2 rounded-(--crm-radius) border border-(--crm-border) bg-(--crm-panel) px-2.5 py-2.5">
                  <Skeleton className={i % 2 ? "w-2/3" : "w-4/5"} />
                  <Skeleton className="w-1/2" />
                  <Skeleton className="w-16" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
