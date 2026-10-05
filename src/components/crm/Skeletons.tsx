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
 * filas de esqueleto, y la banda de pie. `chips`: anchos de los filtros de la toolbar. `toolbar` reemplaza esa fila
 * cuando la pantalla la arma distinto (Alertas: el segmentado primero y la búsqueda a la derecha); `tabs`, anchos de
 * las tabs entre la barra y la toolbar (Usuarios); `footer={false}` si la pantalla no pagina.
 */
export function ListSkeleton({
  title,
  label,
  columns,
  head,
  chips = [],
  toolbar,
  tabs,
  footer = true,
  action = true,
}: {
  title: string;
  label: `Cargando${string}`;
  columns: number;
  head: React.ReactNode;
  chips?: string[];
  toolbar?: React.ReactNode;
  tabs?: string[];
  footer?: boolean;
  /** La acción primaria de la barra ("Nueva…"): solo si el rol la tiene, para que no salte el layout al llegar. */
  action?: boolean;
}) {
  return (
    <div className={cn(UI_ROOT, "flex h-full min-h-0 flex-col bg-(--crm-canvas) px-4 xl:px-6")}>
      <div className="flex h-12 shrink-0 items-center justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <h1 className={TYPE.title}>{title}</h1>
          <Skeleton className="w-40" />
        </div>
        {action && <Skeleton className="h-8 w-36" />}
      </div>
      {tabs && (
        <div className="flex h-10 shrink-0 items-center gap-4 border-b border-(--crm-border)">
          {tabs.map((w, i) => (
            <Skeleton key={i} className={w} />
          ))}
        </div>
      )}
      <div className="flex min-h-10 items-center gap-2 py-1.5">
        {toolbar ?? (
          <>
            <Skeleton className="h-7 w-64" />
            {chips.map((w, i) => (
              <Skeleton key={i} className={cn("h-7", w)} />
            ))}
          </>
        )}
      </div>
      <DataTable label={title} busy className="min-h-0">
        <THead>{head}</THead>
        <TBody>
          <TableSkeleton rows={10} columns={columns} label={label} />
        </TBody>
      </DataTable>
      {footer && <div className="-mx-4 mt-auto h-10 shrink-0 border-t border-(--crm-border) bg-(--crm-panel) xl:-mx-6" />}
    </div>
  );
}

/**
 * Ficha con la forma de la que viene (`DetailHeader` + Tabs + Resumen de §10.13): franja en panel con el h1, la fila de
 * metadatos y la acción primaria + `⋮` a la derecha, las tabs pegadas abajo; debajo, sin caja, la franja de cifras con
 * sus divisores, una sección con su barra y su tabla, y el riel "Datos" (término | valor con hairlines) desde 1280.
 * `tabs`: anchos de las tabs que vienen. `pasos` (ficha de oportunidad, §10.19): en lugar de tabs, el recorrido por el
 * embudo (N etapas + el cierre) con sus acciones, y el cuerpo es el historial (sin cifras ni tabla).
 */
export function DetailSkeleton({ tabs, pasos }: { tabs?: string[]; pasos?: number }) {
  return (
    <div aria-busy="true" className={cn(UI_ROOT, "flex min-h-full flex-col bg-(--crm-canvas)")}>
      <LoadingStatus label="Cargando la ficha…" />
      <div className="border-b border-(--crm-border) bg-(--crm-panel) px-4 xl:px-6">
        <div className="flex items-start justify-between gap-6 pt-3">
          <div className="flex flex-col gap-2 pt-0.5">
            <Skeleton className="h-6 w-72 max-w-[60vw]" />
            <div className="flex gap-4">
              <Skeleton className="w-16" />
              <Skeleton className="w-40" />
              <Skeleton className="w-28" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="size-8" />
          </div>
        </div>
        {tabs && (
          <div className="mt-2 flex h-10 items-center gap-6">
            {tabs.map((w, i) => (
              <Skeleton key={i} className={w} />
            ))}
          </div>
        )}
        {pasos !== undefined && (
          <div className="mt-2 flex flex-wrap items-end justify-between gap-x-6 gap-y-2 pb-3">
            <div className="flex min-w-0 flex-1 basis-full gap-1 overflow-hidden xl:basis-0">
              {Array.from({ length: pasos + 1 }, (_, i) => (
                <div key={i} className="flex min-w-24 flex-1 basis-0 flex-col border-t-2 border-(--crm-border) pt-1.5">
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-7 w-28" />
              <Skeleton className="h-7 w-28" />
              <Skeleton className="h-7 w-28" />
            </div>
          </div>
        )}
        {!tabs && pasos === undefined && <div className="h-3" />}
      </div>
      <div className="grid items-start gap-x-6 gap-y-5 px-4 py-4 xl:grid-cols-[minmax(0,1fr)_340px] xl:px-6">
        <div className="flex min-w-0 flex-col gap-5">
          {pasos === undefined && (
            <>
              <div className="grid grid-cols-2 gap-y-3 sm:grid-cols-5 [&>div]:border-l [&>div]:border-(--crm-border) [&>div]:px-4 [&>div:first-child]:border-l-0 [&>div:first-child]:pl-0">
                {Array.from({ length: 5 }, (_, i) => (
                  <div key={i} className="flex flex-col gap-2">
                    <Skeleton className="w-20" />
                    <Skeleton className="h-5 w-24" />
                  </div>
                ))}
              </div>
              <div className="flex flex-col">
                <div className="flex h-10 items-center">
                  <Skeleton className="w-40" />
                </div>
                <div className="rounded-(--crm-radius) border border-(--crm-border) bg-(--crm-panel)">
                  <div className="h-8 border-b border-(--crm-border-strong)" />
                  {Array.from({ length: 3 }, (_, i) => (
                    <div key={i} className="flex h-9 items-center justify-between border-b border-(--crm-border) px-3 last:border-b-0">
                      <Skeleton className={i % 2 ? "w-1/3" : "w-1/2"} />
                      <Skeleton className="w-20" />
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
          <div className="flex flex-col">
            <div className="flex h-10 items-center">
              <Skeleton className="w-36" />
            </div>
            <div className="border-t border-(--crm-border)">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="flex flex-col gap-1.5 border-b border-(--crm-border) py-2.5">
                  <Skeleton className={i % 2 ? "w-1/2" : "w-2/3"} />
                  <Skeleton className="w-1/3" />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex min-w-0 flex-col xl:border-l xl:border-(--crm-border) xl:pl-6">
          <div className="flex h-10 items-center">
            <Skeleton className="w-12" />
          </div>
          <div className="divide-y divide-(--crm-border)">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3 py-2">
                <Skeleton className="w-16" />
                <Skeleton className={i % 2 ? "w-2/3" : "w-1/2"} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Tablero (Inicio, Tablero comercial, Embudo; MASTER.md §10.21–§10.23): barra con el h1 real, la toolbar si la pantalla
 * filtra, la franja de cifras (`kpis`) y las secciones con su barra y su tabla, en la MISMA grilla que la pantalla
 * (`secciones[i].className` = las clases de columna de esa sección; `rows` = filas de esqueleto).
 */
export function TableroSkeleton({
  title,
  label,
  kpis,
  toolbar = false,
  secciones,
  gridClassName,
}: {
  title: string;
  label: `Cargando${string}`;
  kpis: number;
  toolbar?: boolean;
  secciones: { className?: string; rows: number }[];
  gridClassName?: string;
}) {
  return (
    <div aria-busy="true" className={cn(UI_ROOT, "min-h-full bg-(--crm-canvas) px-4 pb-6 xl:px-6")}>
      <LoadingStatus label={label} />
      <div className="flex h-12 items-center">
        <h1 className={TYPE.title}>{title}</h1>
      </div>
      {toolbar && (
        <div className="flex min-h-10 flex-wrap items-center gap-2 py-1.5">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-7 w-52" />
        </div>
      )}
      <div className="flex flex-col gap-6 pt-2">
        <div
          style={{ "--n": kpis } as React.CSSProperties}
          className="grid grid-cols-2 gap-y-3 sm:grid-cols-[repeat(var(--n),minmax(0,1fr))] [&>div]:border-l [&>div]:border-(--crm-border) [&>div]:px-4 [&>div:first-child]:border-l-0 [&>div:first-child]:pl-0 max-sm:[&>div:nth-child(odd)]:border-l-0 max-sm:[&>div:nth-child(odd)]:pl-0"
        >
          {Array.from({ length: kpis }, (_, i) => (
            <div key={i} className="flex flex-col gap-2 py-0.5">
              <Skeleton className="w-24" />
              <Skeleton className="h-7 w-28" />
            </div>
          ))}
        </div>
        <div className={cn("grid items-start gap-6", gridClassName)}>
          {secciones.map((sec, i) => (
            <div key={i} className={cn("flex min-w-0 flex-col", sec.className)}>
              <div className="flex h-10 items-center">
                <Skeleton className="w-44" />
              </div>
              <div className="rounded-(--crm-radius) border border-(--crm-border) bg-(--crm-panel)">
                <div className="h-8 border-b border-(--crm-border-strong)" />
                {Array.from({ length: sec.rows }, (_, r) => (
                  <div key={r} className="flex h-9 items-center gap-6 border-b border-(--crm-border) px-3 last:border-b-0">
                    <Skeleton className={r % 2 ? "w-1/3" : "w-1/2"} />
                    <Skeleton className="w-1/5" />
                    <Skeleton className="ml-auto w-16" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
