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
 * servidor recalcula y esto solo escribe. Envuelve el resultado (`children`, lo dibuja el servidor): mientras llega el
 * recálculo queda `aria-busy`, una línea fina en acento pulsa arriba y una región viva dice "Actualizando…". El resultado
 * NO se atenúa (bajaría el contraste de lo que se está leyendo; el legacy tampoco lo hacía).
 */
export default function EmbudoFiltros({
  origenes,
  origenAplicado,
  hayFiltro,
  children,
}: {
  origenes: { id: string; nombre: string }[];
  /** El origen con el que filtró el servidor ("" si ninguno: sin parámetro o con uno que no es "sin" ni un uuid). */
  origenAplicado: string;
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
  // Lo que filtra el servidor: un `?origen=` que no es "sin" ni un uuid no filtra (se ve "Todos"); un uuid que no es un
  // origen de la lista (borrado, de otra organización, tipeado a mano) SÍ filtra —y da 0—, así que se muestra como
  // "Origen desconocido" en vez de mentir "Todos" (el FiltroSelect legacy mostraba "Todos").
  const crudo = filtros.valor("origen");
  const desconocido = crudo !== "" && crudo === origenAplicado && !opciones.some((o) => o.value === crudo);
  if (desconocido) opciones.push({ value: crudo, label: "Origen desconocido" });
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
      {/* Reserva su lugar siempre (no empuja el resultado). */}
      <div aria-hidden="true" className="h-0.5 overflow-hidden rounded-(--crm-radius-sm)">
        <div
          className={cn(
            "h-full bg-(--crm-accent)",
            filtros.pending ? "animate-[crm-pulse_1.6s_ease-in-out_infinite] motion-reduce:animate-none" : "invisible",
          )}
        />
      </div>
      <p role="status" className="sr-only">
        {filtros.pending ? "Actualizando…" : ""}
      </p>
      <div aria-busy={filtros.pending || undefined}>{children}</div>
    </>
  );
}
