import * as React from "react";
import { DataTable, TBody, THead, TableSkeleton } from "./DataTable";
import { LoadingStatus, Skeleton } from "./Feedback";
import { TYPE, UI_ROOT, cn } from "./cx";

/**
 * Cargas (`loading.tsx`) de las pantallas de CRM 2.0 con la forma de la pantalla que viene (MASTER.md §9.1): esqueletos
 * `aria-hidden`, la región `aria-busy` y un `role="status"` que empieza con "Cargando" (contrato de §13.2). Sin "use client".
 */

/**
 * Lista: barra de página con el h1 real, toolbar, la grilla con sus cabeceras reales (`head`: los `Th` de la lista) y
 * filas de esqueleto, y la banda de pie. `chips`: anchos de los filtros de la toolbar.
 */
export function ListSkeleton({
  title,
  label,
  columns,
  head,
  chips,
}: {
  title: string;
  label: `Cargando${string}`;
  columns: number;
  head: React.ReactNode;
  chips: string[];
}) {
  return (
    <div className={cn(UI_ROOT, "flex h-full min-h-0 flex-col bg-(--crm-canvas) px-4 xl:px-6")}>
      <div className="flex h-12 shrink-0 items-center justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <h1 className={TYPE.title}>{title}</h1>
          <Skeleton className="w-40" />
        </div>
        <Skeleton className="h-8 w-36" />
      </div>
      <div className="flex min-h-10 items-center gap-2 py-1.5">
        <Skeleton className="h-7 w-64" />
        {chips.map((w, i) => (
          <Skeleton key={i} className={cn("h-7", w)} />
        ))}
      </div>
      <DataTable label={title} busy className="min-h-0">
        <THead>{head}</THead>
        <TBody>
          <TableSkeleton rows={10} columns={columns} label={label} />
        </TBody>
      </DataTable>
      <div className="-mx-4 mt-auto h-10 shrink-0 border-t border-(--crm-border) bg-(--crm-panel) xl:-mx-6" />
    </div>
  );
}

/** Ficha: franja de identidad + tabs + contenido en esqueleto. `tabs`: anchos de las tabs que vienen. */
export function DetailSkeleton({ tabs }: { tabs: string[] }) {
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
          {tabs.map((w, i) => (
            <Skeleton key={i} className={w} />
          ))}
        </div>
      </div>
      <div className="grid gap-x-6 gap-y-5 p-4 xl:grid-cols-[minmax(0,1fr)_340px] xl:p-6">
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex flex-col gap-2">
                <Skeleton className="w-20" />
                <Skeleton className="h-6 w-24" />
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2 rounded-(--crm-radius) border border-(--crm-border) bg-(--crm-panel) p-3">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className={i % 2 ? "w-1/2" : "w-2/3"} />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3 xl:border-l xl:border-(--crm-border) xl:pl-6">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="grid grid-cols-[7rem_1fr] gap-3">
              <Skeleton className="w-16" />
              <Skeleton className={i % 2 ? "w-2/3" : "w-1/2"} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
