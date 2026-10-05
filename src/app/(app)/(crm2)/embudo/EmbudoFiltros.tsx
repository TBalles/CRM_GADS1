"use client";

import * as React from "react";
import { useFiltrosUrl } from "@/components/FiltrosUrl";
import { Button } from "@/components/crm/Button";
import { Select } from "@/components/crm/Select";
import { FechaFiltro, Toolbar } from "@/components/crm/Toolbar";
import { cn } from "@/components/crm/cx";
import { ORIGEN_SIN } from "@/lib/embudo";

/**
 * Período y origen del embudo (MASTER.md §10.23). Viven en la URL (`?desde=&hasta=&origen=`), como siempre: la página
 * servidor recalcula y esto solo escribe. Envuelve el resultado (`children`, lo dibuja el servidor) para atenuarlo con
 * `aria-busy` mientras llega el recálculo (antes, la línea de `BarraPendiente`).
 */
export default function EmbudoFiltros({
  origenes,
  hayFiltro,
  children,
}: {
  origenes: { id: string; nombre: string }[];
  hayFiltro: boolean;
  children: React.ReactNode;
}) {
  const filtros = useFiltrosUrl();
  const desde = filtros.valor("desde");
  const hasta = filtros.valor("hasta");
  const opciones = [
    { value: "", label: "Todos los orígenes" },
    { value: ORIGEN_SIN, label: "Sin origen cargado" },
    ...origenes.map((o) => ({ value: o.id, label: o.nombre })),
  ];
  // Un valor de la URL que no es una opción se ve como "Todos", igual que en el servidor (el FiltroSelect legacy).
  const crudo = filtros.valor("origen");
  const origen = opciones.some((o) => o.value === crudo) ? crudo : "";
  return (
    <>
      <Toolbar label="Filtros del embudo">
        <FechaFiltro inline filtros={filtros} param="desde" label="Alta desde" max={hasta} />
        <FechaFiltro inline filtros={filtros} param="hasta" label="hasta" min={desde} />
        <Select
          dense
          aria-label="Filtrar por origen"
          className="w-56"
          value={origen}
          onChange={(v) => filtros.aplicar({ origen: v || null })}
          options={opciones}
        />
        {hayFiltro && (
          <Button variant="ghost" size="sm" onClick={() => filtros.limpiar()}>
            Limpiar filtros
          </Button>
        )}
      </Toolbar>
      <div
        aria-busy={filtros.pending || undefined}
        className={cn("transition-opacity duration-(--crm-dur-fast) motion-reduce:transition-none", filtros.pending && "opacity-60")}
      >
        {children}
      </div>
    </>
  );
}
