import { LoadingStatus, Skeleton } from "@/components/crm/Feedback";
import { TYPE, UI_ROOT, cn } from "@/components/crm/cx";
import { getSesion } from "@/lib/sesion";

/**
 * Carga de Oportunidades: barra con el h1 real, el segmentado y "Nueva oportunidad" (solo con `oportunidades.editar`,
 * como la pantalla), la toolbar y un bloque neutro de renglones (ni columnas ni tabla: `loading.tsx` no conoce
 * `?vista=`). "Cargando oportunidades…" (contrato de §13.2).
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
          <Skeleton className="h-8 w-20 sm:w-36" />
          {editar && <Skeleton className="h-8 w-8 sm:w-44" />}
        </div>
      </div>
      <div className="flex min-h-10 items-center gap-2 py-1.5">
        <Skeleton className="h-7 w-48 sm:w-64" />
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-7 w-28 max-sm:hidden" />
      </div>
      {/* Neutro: sirve igual para el tablero y para la lista (`loading.tsx` no conoce `?vista=`), así un link directo a
          la lista no salta de columnas a tabla. */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden pt-1 pb-3">
        <Skeleton className="h-8 w-full" />
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className={i % 3 === 0 ? "w-2/5" : i % 3 === 1 ? "w-1/3" : "w-1/2"} />
            <Skeleton className="ml-auto w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
