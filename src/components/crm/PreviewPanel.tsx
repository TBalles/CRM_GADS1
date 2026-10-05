import * as React from "react";
import Link from "next/link";
import { ArrowRight, X } from "lucide-react";
import { buttonClass } from "./Button";
import { LoadingStatus, Skeleton } from "./Feedback";
import { Tag } from "./Status";
import { TYPE, cn } from "./cx";

/**
 * Vista previa del master-detail (MASTER.md §10.13), sin "use client": la dibuja el server component de cada lista
 * (Empresas, Contactos) con sus datos. Solo existe desde 1280 (debajo, la lista quita `sel` de la URL).
 */

const ASIDE = "relative hidden min-h-0 w-[400px] shrink-0 flex-col overflow-y-auto border-l border-(--crm-border) bg-(--crm-panel) xl:flex 2xl:w-[440px]";

/**
 * `aside` de 400 (440 desde 2xl), borde izquierdo, sin sombra. Header fijo: nombre (h2) + "Fuera de la lista actual" si
 * la fila no está en la página que se ve + "Cerrar vista previa" (link que quita `sel`; Esc hace lo mismo), una fila de
 * metadatos y las acciones (UNA visible + `⋮`). Pie fijo: "Abrir ficha completa →".
 */
export function PreviewPanel({
  title,
  outOfList,
  closeHref,
  detailHref,
  meta,
  actions,
  children,
}: {
  title: string;
  outOfList: boolean;
  closeHref: string;
  detailHref: string;
  meta: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <aside aria-labelledby="vista-previa-titulo" data-vista-previa className={ASIDE}>
      <header className="sticky top-0 z-(--crm-z-sticky) flex flex-col gap-2 border-b border-(--crm-border) bg-(--crm-panel) px-4 pb-3 pt-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 id="vista-previa-titulo" className={cn(TYPE.section, "min-w-0 break-words")}>
              {title}
            </h2>
            {outOfList && <Tag className="self-start">Fuera de la lista actual</Tag>}
          </div>
          <Link href={closeHref} scroll={false} aria-label="Cerrar vista previa" aria-keyshortcuts="Escape" className={buttonClass({ variant: "ghost", className: "-mr-2 -mt-1 w-8 px-0" })}>
            <X aria-hidden="true" strokeWidth={1.75} />
          </Link>
        </div>
        <div className={cn(TYPE.table, "flex flex-wrap items-center gap-x-3 gap-y-1 text-(--crm-text-2)")}>{meta}</div>
        {actions}
      </header>

      <div className="flex flex-1 flex-col gap-3 px-4 py-3">{children}</div>

      <footer className="sticky bottom-0 border-t border-(--crm-border) bg-(--crm-panel) px-4 py-1.5">
        <Link href={detailHref} className={buttonClass({ variant: "ghost", size: "sm", className: "-ml-2 text-(--crm-accent-text)" })}>
          Abrir ficha completa
          <ArrowRight aria-hidden="true" strokeWidth={1.75} />
        </Link>
      </footer>
    </aside>
  );
}

/** Mientras llega la vista previa: el mismo panel con esqueletos, `aria-busy` y "Cargando…". */
export function PreviewPanelSkeleton() {
  return (
    <aside aria-busy="true" aria-label="Vista previa" className={ASIDE}>
      <LoadingStatus label="Cargando vista previa…" />
      <div className="flex flex-col gap-3 border-b border-(--crm-border) px-4 py-3">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="w-1/2" />
        <div className="flex gap-2">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-7 w-7" />
        </div>
      </div>
      <div className="flex flex-col gap-3 px-4 py-4">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="grid grid-cols-[7rem_1fr] gap-3">
            <Skeleton className="w-16" />
            <Skeleton className={i % 2 ? "w-2/3" : "w-1/2"} />
          </div>
        ))}
      </div>
    </aside>
  );
}
