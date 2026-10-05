import { LoadingStatus, Skeleton } from "@/components/crm/Feedback";
import { TYPE, UI_ROOT, cn } from "@/components/crm/cx";

/**
 * Carga de Configuración con la forma de la pantalla (MASTER.md §9.1): la barra con el h1 real, la sub-navegación (columna
 * desde 1024, fila debajo) y un bloque neutro de contenido (barra de sección + renglones): no dibuja el formulario ni una
 * tabla, porque un deep link (`?s=etapas`) abre una tabla y "Datos de la empresa" un formulario. "Cargando la
 * configuración…" (el texto de siempre) para lectores de pantalla, las guardas y el manual.
 */
export default function CargandoConfiguracion() {
  return (
    <div aria-busy="true" className={cn(UI_ROOT, "flex min-h-full flex-col bg-(--crm-canvas) px-4 xl:px-6")}>
      <LoadingStatus label="Cargando la configuración…" />
      <div className="flex h-12 shrink-0 items-center gap-3">
        <h1 className={TYPE.title}>Configuración</h1>
        <Skeleton className="w-48" />
      </div>
      <div className="flex flex-col gap-4 lg:flex-row lg:gap-8">
        <div className="flex h-10 shrink-0 items-center gap-4 border-b border-(--crm-border) lg:h-auto lg:w-52 lg:flex-col lg:items-stretch lg:gap-5 lg:border-b-0 lg:px-3 lg:py-2">
          {["w-32", "w-14", "w-28", "w-16", "w-32"].map((w, i) => (
            <Skeleton key={i} className={w} />
          ))}
        </div>
        <div className="flex max-w-3xl flex-1 flex-col gap-3">
          <div className="flex h-10 items-center">
            <Skeleton className="w-40" />
          </div>
          <Skeleton className="w-2/3" />
          <div className="mt-2 flex flex-col gap-4">
            {["w-full", "w-5/6", "w-full", "w-3/4", "w-5/6", "w-2/3"].map((w, i) => (
              <Skeleton key={i} className={cn("h-4", w)} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
