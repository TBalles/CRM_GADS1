import { LoadingStatus, Skeleton } from "@/components/crm/Feedback";
import { TYPE, UI_ROOT, cn } from "@/components/crm/cx";

/**
 * Carga de Configuración con la forma de la pantalla (MASTER.md §9.1): la barra con el h1 real, la sub-navegación (columna
 * desde 1024, fila debajo) y el formulario de "Datos de la empresa", que es la sección que abre. "Cargando la
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
        <div className="flex h-10 shrink-0 items-center gap-4 border-b border-(--crm-border) lg:h-auto lg:w-52 lg:flex-col lg:items-stretch lg:gap-3 lg:border-b-0 lg:px-3 lg:py-2">
          {["w-32", "w-14", "w-28", "w-16", "w-32"].map((w, i) => (
            <Skeleton key={i} className={w} />
          ))}
        </div>
        <div className="flex max-w-[40rem] flex-1 flex-col gap-5 pt-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="w-24" />
              <Skeleton className="h-8 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
