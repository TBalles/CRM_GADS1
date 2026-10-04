"use client";

import { BarraPendiente, FiltroFecha, FiltroSelect, useFiltrosUrl } from "@/components/FiltrosUrl";
import { Button } from "@/components/ui/UIComponents";
import { ORIGEN_SIN } from "@/lib/embudo";

/**
 * Período y origen del embudo. Viven en la URL (`?desde=&hasta=&origen=`), como las listas:
 * la página servidor recalcula y esto solo escribe.
 */
export default function EmbudoFiltros({
  origenes,
  hayFiltro,
}: {
  origenes: { id: string; nombre: string }[];
  hayFiltro: boolean;
}) {
  const filtros = useFiltrosUrl();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtros del embudo">
        <FiltroFecha filtros={filtros} param="desde" etiqueta="Alta desde" max={filtros.valor("hasta")} />
        <FiltroFecha filtros={filtros} param="hasta" etiqueta="hasta" min={filtros.valor("desde")} />
        <FiltroSelect
          filtros={filtros}
          param="origen"
          etiqueta="Filtrar por origen"
          className="sm:w-56"
          opciones={[
            { value: "", label: "Todos los orígenes" },
            { value: ORIGEN_SIN, label: "Sin origen cargado" },
            ...origenes.map((o) => ({ value: o.id, label: o.nombre })),
          ]}
        />
        {hayFiltro && (
          <Button variant="ghost" size="sm" onClick={() => filtros.limpiar()} className="h-9">
            Limpiar filtros
          </Button>
        )}
      </div>
      <BarraPendiente pending={filtros.pending} />
    </div>
  );
}
